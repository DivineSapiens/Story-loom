"use client";

import { useReducer, useCallback, useRef, useState } from "react";
import type { TreeState, StoryNode, BranchOption, CharacterThread } from "@/lib/types";
import { getPath, pathToText } from "@/lib/treeUtils";
import { THREAD_PALETTE } from "@/lib/threadPalette";
import StoryTree from "@/components/StoryTree";
import BranchPanel from "@/components/BranchPanel";
import PathDrawer from "@/components/PathDrawer";
import BackgroundScene from "@/components/BackgroundScene";
import CreateThreadModal from "@/components/CreateThreadModal";
import AppearancesPanel from "@/components/AppearancesPanel";
import CharacterUniverseView from "@/components/CharacterUniverseView";

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: TreeState = {
  nodes: [],
  pendingOptions: null,
  branchError: null,
  selectedNodeId: null,
  activePathIds: [],
  isLoading: false,
  drawerOpen: false,
  openingCollapsed: false,
  pendingReset: false,
  pendingOpeningText: "",
  styleDescription: "",
  previousTree: null,
  wrapUpRequested: false,
  // ── Character universe ──────────────────────────────────────
  canonSummary: "",
  canonSummaryPending: false,
  characterThreads: {},
  branchContext: null,
  lastMainNodeId: null,
  weaveLoading: false,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  // ── Existing main-tree actions ────────────────────────────────────────────
  | { type: "SET_ROOT"; node: StoryNode }
  | { type: "ADD_NODE"; node: StoryNode }
  | { type: "UNDO_NODE"; nodeId: string; restoredOptions: BranchOption[] }
  | { type: "SELECT_NODE"; nodeId: string; pathIds: string[] }
  | { type: "SET_OPTIONS"; options: BranchOption[] }
  | { type: "SET_ERROR"; message: string }
  | { type: "SET_LOADING" }
  | { type: "SHOW_EXISTING_CHILDREN"; options: BranchOption[]; nodeId: string; pathIds: string[] }
  | { type: "DISMISS_PANEL" }
  | { type: "TOGGLE_DRAWER" }
  | { type: "TOGGLE_OPENING" }
  | { type: "CONFIRM_RESET"; pendingText: string }
  | { type: "COMMIT_RESET"; snapshot: import("@/lib/types").TreeSnapshot }
  | { type: "CANCEL_RESET" }
  | { type: "RESTORE_TREE" }
  | { type: "DISMISS_ARCHIVE" }
  | { type: "SET_STYLE"; styleDescription: string }
  | { type: "TOGGLE_WRAP_UP" }
  /** Auto-opens the drawer when an ending node is committed. */
  | { type: "OPEN_DRAWER" }
  // ── Canon summary ─────────────────────────────────────────────────────────
  | { type: "CANON_SUMMARY_PENDING" }
  | { type: "SET_CANON_SUMMARY"; summary: string }
  // ── Thread lifecycle ──────────────────────────────────────────────────────
  | { type: "CREATE_THREAD"; thread: CharacterThread }
  | { type: "DELETE_THREAD"; threadId: string }
  // ── Thread branching (mirrors main-tree flow, scoped to one thread) ───────
  | { type: "THREAD_SET_LOADING";  threadId: string }
  | { type: "THREAD_SET_OPTIONS";  threadId: string; options: BranchOption[] }
  | { type: "THREAD_SET_ERROR";    threadId: string; message: string }
  | { type: "THREAD_ADD_NODE";     threadId: string; node: StoryNode }
  | { type: "THREAD_SELECT_NODE";  threadId: string; nodeId: string }
  // ── Branch context ────────────────────────────────────────────────────────
  | { type: "SET_BRANCH_CONTEXT";
      context: TreeState["branchContext"] }
  // ── Weave ─────────────────────────────────────────────────────────────────
  | { type: "WEAVE_LOADING" }
  | { type: "WEAVE_DONE";
      node: StoryNode;         // new main-tree node
      threadId: string;        // which thread was woven
      threadNodeId: string }   // which thread node was the source
  // ── Node management ───────────────────────────────────────────────────────
  /** Delete nodeId and every descendant below it in the main tree. */
  | { type: "PRUNE_NODE"; nodeId: string }
  /** Update the text (and reset imageStatus) of a main-tree node in place. */
  | { type: "EDIT_NODE"; nodeId: string; text: string }
  /**
   * Insert a new node between targetId and ALL of its current children.
   * The new node's parentId = target.parentId; target's children are reparented
   * to the new node; depth of the whole subtree below is incremented by 1.
   */
  | { type: "INSERT_NODE"; afterNodeId: string; newNode: StoryNode }
  /** Delete nodeId and every descendant below it in a character thread. */
  | { type: "THREAD_PRUNE_NODE"; threadId: string; nodeId: string }
  /** Update text of a thread node in place. */
  | { type: "THREAD_EDIT_NODE"; threadId: string; nodeId: string; text: string }
  /** Insert a new node between afterNodeId and its children in a thread. */
  | { type: "THREAD_INSERT_NODE"; threadId: string; afterNodeId: string; newNode: StoryNode }
  /** Edit an existing character thread's metadata (name, backstory, relationship). */
  | {
      type: "EDIT_THREAD";
      threadId: string;
      characterName: string;
      backstory: string;
      relatedToThreadId?: string;
      relationshipLabel?: string;
    };

function reducer(state: TreeState, action: Action): TreeState {
  switch (action.type) {

    // ── Existing cases — same logic, extended where noted ──────────────────

    case "SET_ROOT":
      return {
        ...INITIAL_STATE,
        nodes: [action.node],
        selectedNodeId: action.node.id,
        activePathIds: [action.node.id],
        openingCollapsed: true,
        styleDescription: state.styleDescription,
        // Preserve new fields that should survive a story reset:
        characterThreads: {},
        branchContext: { kind: "main" },
        lastMainNodeId: action.node.id,
        canonSummaryPending: true, // fire-and-forget will update this
      };

    case "ADD_NODE": {
      const newNodes = [...state.nodes, action.node];
      const path = getPath(newNodes, action.node.id);
      return {
        ...state,
        nodes: newNodes,
        selectedNodeId: action.node.id,
        activePathIds: path.map((n) => n.id),
        pendingOptions: null,
        isLoading: false,
        lastMainNodeId: action.node.id,
        branchContext: { kind: "main" },
        canonSummaryPending: true,
      };
    }

    case "UNDO_NODE": {
      const withoutNode = state.nodes.filter((n) => n.id !== action.nodeId);
      const undone = state.nodes.find((n) => n.id === action.nodeId);
      const parentId = undone?.parentId ?? null;
      const newSelected = parentId ?? (withoutNode[0]?.id ?? null);
      const path = newSelected ? getPath(withoutNode, newSelected) : [];
      return {
        ...state,
        nodes: withoutNode,
        selectedNodeId: newSelected,
        activePathIds: path.map((n) => n.id),
        pendingOptions: action.restoredOptions,
        isLoading: false,
        // Restore lastMainNodeId to the parent of the undone node
        lastMainNodeId: parentId ?? state.lastMainNodeId,
        branchContext: { kind: "main" },
      };
    }

    case "SELECT_NODE":
      return {
        ...state,
        selectedNodeId: action.nodeId,
        activePathIds: action.pathIds,
        pendingOptions: null,
        isLoading: false,
        branchContext: { kind: "main" },
      };

    case "SET_OPTIONS":
      return { ...state, pendingOptions: action.options, branchError: null, isLoading: false };

    case "SET_ERROR":
      return { ...state, branchError: action.message, pendingOptions: null, isLoading: false };

    case "SET_LOADING":
      return { ...state, isLoading: true, pendingOptions: null, branchError: null };

    case "SHOW_EXISTING_CHILDREN":
      return {
        ...state,
        selectedNodeId: action.nodeId,
        activePathIds: action.pathIds,
        pendingOptions: action.options,
        isLoading: false,
        branchContext: { kind: "main" },
      };

    case "DISMISS_PANEL":
      // Canvas background click — hide the branch panel without touching
      // node selection, active path, or any other state.
      return {
        ...state,
        pendingOptions: null,
        branchError: null,
        isLoading: false,
        branchContext: null,
      };

    case "TOGGLE_DRAWER":
      return { ...state, drawerOpen: !state.drawerOpen };

    case "OPEN_DRAWER":
      return { ...state, drawerOpen: true };

    case "TOGGLE_OPENING":
      return { ...state, openingCollapsed: !state.openingCollapsed };

    case "CONFIRM_RESET":
      return { ...state, pendingReset: true, pendingOpeningText: action.pendingText };

    case "COMMIT_RESET":
      return { ...INITIAL_STATE, previousTree: action.snapshot };

    case "CANCEL_RESET":
      return { ...state, pendingReset: false, pendingOpeningText: "" };

    case "RESTORE_TREE": {
      if (!state.previousTree) return state;
      const snap = state.previousTree;
      return {
        ...state,
        nodes: snap.nodes,
        selectedNodeId: snap.selectedNodeId,
        activePathIds: snap.activePathIds,
        styleDescription: snap.styleDescription,
        pendingOptions: null,
        isLoading: false,
        openingCollapsed: snap.nodes.length > 0,
        previousTree: null,
        // Clear threads when restoring an archived story
        characterThreads: {},
        branchContext: null,
        lastMainNodeId: snap.nodes.length > 0
          ? snap.nodes[snap.nodes.length - 1].id
          : null,
      };
    }

    case "DISMISS_ARCHIVE":
      return { ...state, previousTree: null };

    case "SET_STYLE":
      return { ...state, styleDescription: action.styleDescription };

    case "TOGGLE_WRAP_UP":
      return { ...state, wrapUpRequested: !state.wrapUpRequested };

    // ── Canon summary ────────────────────────────────────────────────────────

    case "CANON_SUMMARY_PENDING":
      return { ...state, canonSummaryPending: true };

    case "SET_CANON_SUMMARY":
      return { ...state, canonSummary: action.summary, canonSummaryPending: false };

    // ── Thread lifecycle ─────────────────────────────────────────────────────

    case "CREATE_THREAD":
      return {
        ...state,
        characterThreads: {
          ...state.characterThreads,
          [action.thread.id]: action.thread,
        },
      };

    case "DELETE_THREAD": {
      const { [action.threadId]: _removed, ...rest } = state.characterThreads;
      return {
        ...state,
        characterThreads: rest,
        branchContext:
          state.branchContext?.kind === "thread" &&
          state.branchContext.threadId === action.threadId
            ? null
            : state.branchContext,
      };
    }

    // ── Thread branching ─────────────────────────────────────────────────────

    case "THREAD_SET_LOADING": {
      const t = state.characterThreads[action.threadId];
      if (!t) return state;
      return {
        ...state,
        characterThreads: {
          ...state.characterThreads,
          [action.threadId]: { ...t, isLoading: true, pendingOptions: null, branchError: null },
        },
      };
    }

    case "THREAD_SET_OPTIONS": {
      const t = state.characterThreads[action.threadId];
      if (!t) return state;
      return {
        ...state,
        characterThreads: {
          ...state.characterThreads,
          [action.threadId]: {
            ...t,
            isLoading: false,
            pendingOptions: action.options,
            branchError: null,
          },
        },
      };
    }

    case "THREAD_SET_ERROR": {
      const t = state.characterThreads[action.threadId];
      if (!t) return state;
      return {
        ...state,
        characterThreads: {
          ...state.characterThreads,
          [action.threadId]: {
            ...t,
            isLoading: false,
            pendingOptions: null,
            branchError: action.message,
          },
        },
      };
    }

    case "THREAD_ADD_NODE": {
      const t = state.characterThreads[action.threadId];
      if (!t) return state;
      return {
        ...state,
        characterThreads: {
          ...state.characterThreads,
          [action.threadId]: {
            ...t,
            nodes: [...t.nodes, action.node],
            selectedNodeId: action.node.id,
            pendingOptions: null,
            isLoading: false,
          },
        },
        branchContext: { kind: "thread", threadId: action.threadId },
      };
    }

    case "THREAD_SELECT_NODE": {
      const t = state.characterThreads[action.threadId];
      if (!t) return state;
      return {
        ...state,
        characterThreads: {
          ...state.characterThreads,
          [action.threadId]: { ...t, selectedNodeId: action.nodeId },
        },
        branchContext: { kind: "thread", threadId: action.threadId },
      };
    }

    // ── Branch context ────────────────────────────────────────────────────────

    case "SET_BRANCH_CONTEXT":
      return { ...state, branchContext: action.context };

    // ── Weave ─────────────────────────────────────────────────────────────────

    case "WEAVE_LOADING":
      return { ...state, weaveLoading: true };

    case "WEAVE_DONE": {
      const t = state.characterThreads[action.threadId];
      // Commit new main-tree node
      const newNodes = [...state.nodes, action.node];
      const path = getPath(newNodes, action.node.id);
      // Mark the source thread node as woven
      const updatedThread = t
        ? {
            ...t,
            nodes: t.nodes.map((n) =>
              n.id === action.threadNodeId ? { ...n, woven: true } : n
            ),
          }
        : t;
      return {
        ...state,
        nodes: newNodes,
        selectedNodeId: action.node.id,
        activePathIds: path.map((n) => n.id),
        pendingOptions: null,
        isLoading: false,
        lastMainNodeId: action.node.id,
        weaveLoading: false,
        branchContext: { kind: "main" },
        canonSummaryPending: true,
        characterThreads: updatedThread
          ? { ...state.characterThreads, [action.threadId]: updatedThread }
          : state.characterThreads,
      };
    }

    // ── Node management — main tree ──────────────────────────────────────────

    case "PRUNE_NODE": {
      // Collect all descendant ids (including nodeId itself) via BFS.
      const toRemove = new Set<string>();
      const queue = [action.nodeId];
      while (queue.length) {
        const id = queue.shift()!;
        toRemove.add(id);
        state.nodes.filter((n) => n.parentId === id).forEach((n) => queue.push(n.id));
      }
      const remaining = state.nodes.filter((n) => !toRemove.has(n.id));
      // Fix selection: if selected node was pruned, move to remaining root.
      const newSelected = toRemove.has(state.selectedNodeId ?? "")
        ? (remaining[0]?.id ?? null)
        : state.selectedNodeId;
      const newPath = newSelected ? getPath(remaining, newSelected) : [];
      return {
        ...state,
        nodes: remaining,
        selectedNodeId: newSelected,
        activePathIds: newPath.map((n) => n.id),
        pendingOptions: null,
        branchContext: { kind: "main" },
        lastMainNodeId: remaining.length > 0
          ? (remaining.find((n) => n.id === state.lastMainNodeId) ? state.lastMainNodeId : remaining[remaining.length - 1].id)
          : null,
      };
    }

    case "EDIT_NODE": {
      const updated = state.nodes.map((n) =>
        n.id === action.nodeId
          ? { ...n, text: action.text, imageStatus: "idle" as const }
          : n
      );
      return { ...state, nodes: updated };
    }

    case "INSERT_NODE": {
      const target = state.nodes.find((n) => n.id === action.afterNodeId);
      if (!target) return state;
      const newId = action.newNode.id;
      // Increment depth of every descendant of target (they now sit one level deeper).
      const updated = state.nodes.map((n) => {
        if (n.parentId === action.afterNodeId) {
          // Direct children of target become children of the new node.
          return { ...n, parentId: newId, depth: n.depth + 1 };
        }
        // Deeper descendants also shift depth by 1 — we handle this with a recursive walk.
        return n;
      });
      // Bump depth for all nodes that are descendants of target's old children.
      // We already incremented direct children; now recursively bump deeper descendants.
      const newIdSet = new Set(
        updated.filter((n) => n.parentId === newId).map((n) => n.id)
      );
      const bumpedDeeper = updated.map((n) => {
        if (newIdSet.has(n.parentId ?? "")) {
          // This is a grandchild or deeper — also needs depth bump.
          // We handle this by doing a BFS post-pass below.
          return n;
        }
        return n;
      });
      // BFS depth-bump pass for all descendants below the inserted node.
      const depthBumped = bumpedDeeper.slice();
      const visitQueue = [...newIdSet];
      while (visitQueue.length) {
        const parentId = visitQueue.shift()!;
        for (let i = 0; i < depthBumped.length; i++) {
          if (depthBumped[i].parentId === parentId && depthBumped[i].id !== newId) {
            depthBumped[i] = { ...depthBumped[i], depth: depthBumped[i].depth + 1 };
            visitQueue.push(depthBumped[i].id);
          }
        }
      }
      // Insert the new node right after target in the array (preserves BFS order).
      const targetIdx = depthBumped.findIndex((n) => n.id === action.afterNodeId);
      const withInserted = [
        ...depthBumped.slice(0, targetIdx + 1),
        action.newNode,
        ...depthBumped.slice(targetIdx + 1),
      ];
      return {
        ...state,
        nodes: withInserted,
        selectedNodeId: newId,
        activePathIds: getPath(withInserted, newId).map((n) => n.id),
        pendingOptions: null,
        branchContext: { kind: "main" },
      };
    }

    // ── Node management — character threads ──────────────────────────────────

    case "THREAD_PRUNE_NODE": {
      const t = state.characterThreads[action.threadId];
      if (!t) return state;
      const toRemove = new Set<string>();
      const queue = [action.nodeId];
      while (queue.length) {
        const id = queue.shift()!;
        toRemove.add(id);
        t.nodes.filter((n) => n.parentId === id).forEach((n) => queue.push(n.id));
      }
      const remaining = t.nodes.filter((n) => !toRemove.has(n.id));
      const newSelected = toRemove.has(t.selectedNodeId ?? "")
        ? (remaining[0]?.id ?? null)
        : t.selectedNodeId;
      return {
        ...state,
        characterThreads: {
          ...state.characterThreads,
          [action.threadId]: {
            ...t,
            nodes: remaining,
            selectedNodeId: newSelected,
            pendingOptions: null,
          },
        },
        branchContext:
          remaining.length === 0 &&
          state.branchContext?.kind === "thread" &&
          state.branchContext.threadId === action.threadId
            ? null
            : state.branchContext,
      };
    }

    case "THREAD_EDIT_NODE": {
      const t = state.characterThreads[action.threadId];
      if (!t) return state;
      return {
        ...state,
        characterThreads: {
          ...state.characterThreads,
          [action.threadId]: {
            ...t,
            nodes: t.nodes.map((n) =>
              n.id === action.nodeId
                ? { ...n, text: action.text, imageStatus: "idle" as const }
                : n
            ),
          },
        },
      };
    }

    case "THREAD_INSERT_NODE": {
      const t = state.characterThreads[action.threadId];
      if (!t) return state;
      const newId = action.newNode.id;
      // Reparent direct children of afterNodeId to the new node, bump their depth.
      let updated = t.nodes.map((n) =>
        n.parentId === action.afterNodeId
          ? { ...n, parentId: newId, depth: n.depth + 1 }
          : n
      );
      // BFS depth-bump for deeper descendants.
      const visitQueue = updated
        .filter((n) => n.parentId === newId)
        .map((n) => n.id);
      const processedIds = new Set(visitQueue);
      while (visitQueue.length) {
        const pid = visitQueue.shift()!;
        updated = updated.map((n) => {
          if (n.parentId === pid && !processedIds.has(n.id)) {
            processedIds.add(n.id);
            visitQueue.push(n.id);
            return { ...n, depth: n.depth + 1 };
          }
          return n;
        });
      }
      const targetIdx = updated.findIndex((n) => n.id === action.afterNodeId);
      const withInserted = [
        ...updated.slice(0, targetIdx + 1),
        action.newNode,
        ...updated.slice(targetIdx + 1),
      ];
      return {
        ...state,
        characterThreads: {
          ...state.characterThreads,
          [action.threadId]: {
            ...t,
            nodes: withInserted,
            selectedNodeId: newId,
            pendingOptions: null,
          },
        },
        branchContext: { kind: "thread", threadId: action.threadId },
      };
    }

    case "EDIT_THREAD": {
      const t = state.characterThreads[action.threadId];
      if (!t) return state;
      return {
        ...state,
        characterThreads: {
          ...state.characterThreads,
          [action.threadId]: {
            ...t,
            characterName:      action.characterName,
            backstory:          action.backstory,
            relatedToThreadId:  action.relatedToThreadId,
            relationshipLabel:  action.relationshipLabel,
          },
        },
      };
    }

    default:
      return state;
  }
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function Page() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [openingText, setOpeningText] = useState("");
  const [styleText, setStyleText] = useState("");
  const [undoToast, setUndoToast] = useState<{
    nodeId: string;
    restoredOptions: BranchOption[];
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);
  // Local state for the CreateThreadModal — which node it was opened from.
  const [creatingThreadForNodeId, setCreatingThreadForNodeId] = useState<string | null>(null);
  // Local state for the AppearancesPanel — which thread to inspect.
  const [appearancePanelThreadId, setAppearancePanelThreadId] = useState<string | null>(null);
  // Active view: Story Tree canvas or Character Universe screen.
  const [activeView, setActiveView] = useState<"tree" | "universe">("tree");

  const stateRef = useRef(state);
  stateRef.current = state;

  // ── fireSummarise ──────────────────────────────────────────────────────────
  // Fires a summarise call fire-and-forget. Never blocks the caller.
  // The summary is stored in canonSummary and used in thread/weave prompts.
  const fireSummarise = useCallback((pathText: string) => {
    dispatch({ type: "CANON_SUMMARY_PENDING" });
    fetch("/api/summarise-story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathText }),
    })
      .then((r) => r.json())
      .then((data: { summary?: string }) => {
        if (data.summary) dispatch({ type: "SET_CANON_SUMMARY", summary: data.summary });
      })
      .catch(() => {
        // Silent failure — canonSummary stays as last known value.
        dispatch({ type: "SET_CANON_SUMMARY", summary: stateRef.current.canonSummary });
      });
  }, []);

  // ── fetchBranches ──────────────────────────────────────────────────────────
  const fetchBranches = useCallback(async (nodeId: string, nodes: StoryNode[]) => {
    dispatch({ type: "SET_LOADING" });
    const path = getPath(nodes, nodeId);
    const pathText = pathToText(path);
    const { wrapUpRequested } = stateRef.current;
    try {
      const res = await fetch("/api/generate-branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathText, wrapUp: wrapUpRequested }),
      });
      const data = await res.json() as { branches?: BranchOption[]; error?: string; detail?: string };
      if (!res.ok) {
        const msg = data.detail ?? data.error ?? `Server error ${res.status}`;
        dispatch({ type: "SET_ERROR", message: msg });
        return;
      }
      dispatch({ type: "SET_OPTIONS", options: data.branches ?? [] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error — could not reach the server.";
      dispatch({ type: "SET_ERROR", message: msg });
    }
  }, []);

  // ── showExistingChildren ───────────────────────────────────────────────────
  const showExistingChildren = useCallback(
    (nodeId: string, nodes: StoryNode[]) => {
      const children = nodes.filter((n) => n.parentId === nodeId);
      const options: BranchOption[] = children.map((c) => ({
        id: c.id,
        text: c.text,
        tone: c.tone,
        why: c.why,
      }));
      const path = getPath(nodes, nodeId);
      dispatch({
        type: "SHOW_EXISTING_CHILDREN",
        options,
        nodeId,
        pathIds: path.map((n) => n.id),
      });
    },
    []
  );

  // ── handleBeginStory ───────────────────────────────────────────────────────
  const handleBeginStory = useCallback(() => {
    const text = openingText.trim();
    if (!text) return;
    dispatch({ type: "SET_STYLE", styleDescription: styleText });
    if (state.nodes.length > 0) {
      dispatch({ type: "CONFIRM_RESET", pendingText: text });
      return;
    }
    const root: StoryNode = {
      id: crypto.randomUUID(),
      text,
      tone: "Opening",
      why: "",
      parentId: null,
      depth: 0,
      siblingIndex: 0,
      authorType: "ai",
      imageStatus: "idle",
    };
    dispatch({ type: "SET_ROOT", node: root });
    fetchBranches(root.id, [root]);
    // Fire summarise immediately after root (confirmed: F — summarise from root too)
    fireSummarise(text);
  }, [openingText, styleText, state.nodes.length, fetchBranches, fireSummarise]);

  // ── handleConfirmReset ─────────────────────────────────────────────────────
  const handleConfirmReset = useCallback(() => {
    const { pendingOpeningText, nodes, selectedNodeId, activePathIds, styleDescription } =
      stateRef.current;
    const text = pendingOpeningText;
    const snapshot: import("@/lib/types").TreeSnapshot = {
      nodes, selectedNodeId, activePathIds, styleDescription,
    };
    dispatch({ type: "COMMIT_RESET", snapshot });
    setUndoToast(null);

    if (!text) {
      setOpeningText("");
      return;
    }
    setOpeningText(text);
    const root: StoryNode = {
      id: crypto.randomUUID(),
      text,
      tone: "Opening",
      why: "",
      parentId: null,
      depth: 0,
      siblingIndex: 0,
      authorType: "ai",
      imageStatus: "idle",
    };
    setTimeout(() => {
      dispatch({ type: "SET_ROOT", node: root });
      fetchBranches(root.id, [root]);
      fireSummarise(text);
    }, 0);
  }, [fetchBranches, fireSummarise]);

  // ── handleEditOpening ──────────────────────────────────────────────────────
  const handleEditOpening = useCallback(() => {
    const root = stateRef.current.nodes.find((n) => n.parentId === null);
    if (root) setOpeningText(root.text);
    if (stateRef.current.openingCollapsed) dispatch({ type: "TOGGLE_OPENING" });
  }, []);

  // ── handleNewStory (also used by logo click) ───────────────────────────────
  const handleNewStory = useCallback(() => {
    const { nodes } = stateRef.current;
    if (nodes.length === 0) return;
    if (!stateRef.current.openingCollapsed) dispatch({ type: "TOGGLE_OPENING" });
    dispatch({ type: "CONFIRM_RESET", pendingText: "" });
  }, []);

  // ── handleNodeClick ────────────────────────────────────────────────────────
  // Node BODY click:
  //   - Has existing children → show them in the branch panel (navigate existing tree).
  //   - Is a leaf node → just SELECT it (highlight path) WITHOUT auto-fetching new branches.
  //     New AI branches are only generated when the user explicitly clicks "＋ New directions".
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const { nodes } = stateRef.current;
      const children = nodes.filter((n) => n.parentId === nodeId);
      if (children.length > 0) {
        // Show existing children as branch options so the user can navigate them.
        showExistingChildren(nodeId, nodes);
      } else {
        // Leaf node — just select + highlight path. Do NOT fetch new branches.
        const path = getPath(nodes, nodeId);
        dispatch({ type: "SELECT_NODE", nodeId, pathIds: path.map((n) => n.id) });
        // Dismiss any open branch panel from a previous node click.
        dispatch({ type: "DISMISS_PANEL" });
      }
    },
    [showExistingChildren]
  );

  // ── handleGenerateBranches ─────────────────────────────────────────────────
  const handleGenerateBranches = useCallback(
    (nodeId: string) => {
      // Block generation from ending nodes — the story is complete there.
      const node = stateRef.current.nodes.find((n) => n.id === nodeId);
      if (node?.isEnding) return;
      fetchBranches(nodeId, stateRef.current.nodes);
      const path = getPath(stateRef.current.nodes, nodeId);
      dispatch({ type: "SELECT_NODE", nodeId, pathIds: path.map((n) => n.id) });
    },
    [fetchBranches]
  );

  // ── handleSelectBranch ─────────────────────────────────────────────────────
  const handleSelectBranch = useCallback(
    (option: BranchOption) => {
      const { nodes, selectedNodeId, pendingOptions } = stateRef.current;
      if (!selectedNodeId) return;

      // Re-showing existing children: just navigate, no new node.
      const existing = nodes.find((n) => n.id === option.id);
      if (existing) {
        const path = getPath(nodes, existing.id);
        dispatch({ type: "SELECT_NODE", nodeId: existing.id, pathIds: path.map((n) => n.id) });
        return;
      }

      const siblings = nodes.filter((n) => n.parentId === selectedNodeId);
      const id = crypto.randomUUID();
      const newNode: StoryNode = {
        id,
        text: option.text,
        tone: option.tone,
        why: option.why,
        parentId: selectedNodeId,
        depth: (nodes.find((n) => n.id === selectedNodeId)?.depth ?? 0) + 1,
        siblingIndex: siblings.length,
        authorType: "ai",
        imageStatus: "idle",
        // Propagate ending flag from the chosen option.
        ...(option.isEnding ? { isEnding: true } : {}),
      };
      dispatch({ type: "ADD_NODE", node: newNode });

      // Fire-and-forget summary update after each main commit
      const newNodes = [...nodes, newNode];
      fireSummarise(pathToText(getPath(newNodes, id)));

      // If this is the ending node, auto-open the path drawer after a short delay
      // so the reader immediately sees the full illustrated story.
      if (option.isEnding) {
        setTimeout(() => dispatch({ type: "OPEN_DRAWER" }), 400);
      }

      // Undo toast: 5 s auto-dismiss (suppress on ending — can't undo the end cleanly)
      if (!option.isEnding) {
        const restoredOptions = (pendingOptions ?? []).map((o) => ({ ...o }));
        setUndoToast((prev) => {
          if (prev) clearTimeout(prev.timeoutId);
          const timeoutId = setTimeout(() => setUndoToast(null), 5000);
          return { nodeId: id, restoredOptions, timeoutId };
        });
      }
    },
    [fireSummarise]
  );

  // ── handleAddUserText — fires summarise after user node commit ─────────────
  const handleAddUserText = useCallback((text: string) => {
    const { nodes, selectedNodeId } = stateRef.current;
    if (!selectedNodeId) return;
    const siblings = nodes.filter((n) => n.parentId === selectedNodeId);
    const id = crypto.randomUUID();
    const userNode: StoryNode = {
      id,
      text,
      tone: "User",
      why: "",
      parentId: selectedNodeId,
      depth: (nodes.find((n) => n.id === selectedNodeId)?.depth ?? 0) + 1,
      siblingIndex: siblings.length,
      authorType: "user",
      imageStatus: "idle",
    };
    dispatch({ type: "ADD_NODE", node: userNode });
    const newNodes = [...nodes, userNode];
    fetchBranches(id, newNodes);
    fireSummarise(pathToText(getPath(newNodes, id)));
  }, [fetchBranches, fireSummarise]);

  // ── handleUndo ─────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (!undoToast) return;
    clearTimeout(undoToast.timeoutId);
    dispatch({ type: "UNDO_NODE", nodeId: undoToast.nodeId, restoredOptions: undoToast.restoredOptions });
    setUndoToast(null);
  }, [undoToast]);

  // ── handleNavigateUp ───────────────────────────────────────────────────────
  const handleNavigateUp = useCallback(() => {
    const { nodes, selectedNodeId } = stateRef.current;
    if (!selectedNodeId) return;
    const current = nodes.find((n) => n.id === selectedNodeId);
    if (!current || current.parentId === null) return;
    const parentId = current.parentId;
    const children = nodes.filter((n) => n.parentId === parentId);
    if (children.length > 0) {
      showExistingChildren(parentId, nodes);
    } else {
      const path = getPath(nodes, parentId);
      dispatch({ type: "SELECT_NODE", nodeId: parentId, pathIds: path.map((n) => n.id) });
    }
  }, [showExistingChildren]);

  // ── handleOpenCreateThread ─────────────────────────────────────────────────
  const handleOpenCreateThread = useCallback((originNodeId: string) => {
    const { characterThreads } = stateRef.current;
    const threadCount = Object.keys(characterThreads).length;
    if (threadCount >= 6) return; // cap enforced via disabled button; guard here too
    setCreatingThreadForNodeId(originNodeId);
  }, []);

  // ── handleConfirmCreateThread ──────────────────────────────────────────────
  const handleConfirmCreateThread = useCallback(
    (
      characterName: string,
      backstory: string,
      relatedToThreadId?: string,
      relationshipLabel?: string
    ) => {
      const originNodeId = creatingThreadForNodeId;
      if (!originNodeId) return;
      setCreatingThreadForNodeId(null);

      const { characterThreads, canonSummary } = stateRef.current;
      const paletteIndex = Object.keys(characterThreads).length % 6;
      const threadId = crypto.randomUUID();

      const newThread: import("@/lib/types").CharacterThread = {
        id: threadId,
        characterName,
        backstory,
        originNodeId,
        nodes: [],
        selectedNodeId: null,
        pendingOptions: null,
        isLoading: false,
        branchError: null,
        paletteIndex,
        ...(relatedToThreadId ? { relatedToThreadId } : {}),
        ...(relationshipLabel  ? { relationshipLabel }  : {}),
      };

      dispatch({ type: "CREATE_THREAD", thread: newThread });
      dispatch({ type: "SET_BRANCH_CONTEXT", context: { kind: "thread", threadId } });

      // Immediately fetch the first set of branch options for this thread.
      dispatch({ type: "THREAD_SET_LOADING", threadId });
      fetch("/api/generate-thread-branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonSummary,
          characterName,
          backstory,
          threadPathText: "",
          wrapUp: false,
        }),
      })
        .then((r) => r.json())
        .then((data: { branches?: import("@/lib/types").BranchOption[]; error?: string; detail?: string }) => {
          if (data.branches) {
            dispatch({ type: "THREAD_SET_OPTIONS", threadId, options: data.branches });
          } else {
            dispatch({ type: "THREAD_SET_ERROR", threadId, message: data.detail ?? data.error ?? "Unknown error" });
          }
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Network error";
          dispatch({ type: "THREAD_SET_ERROR", threadId, message: msg });
        });
    },
    [creatingThreadForNodeId]
  );

  // ── handleShowAppearances ──────────────────────────────────────────────────
  const handleShowAppearances = useCallback((threadId: string) => {
    setAppearancePanelThreadId(threadId);
  }, []);

  // ── handleThreadGenerateBranches ───────────────────────────────────────────
  const handleThreadGenerateBranches = useCallback(
    (threadId: string, nodeId: string) => {
      const { characterThreads, canonSummary, wrapUpRequested } = stateRef.current;
      const thread = characterThreads[threadId];
      if (!thread) return;

      dispatch({ type: "THREAD_SET_LOADING", threadId });
      dispatch({ type: "THREAD_SELECT_NODE", threadId, nodeId });
      dispatch({ type: "SET_BRANCH_CONTEXT", context: { kind: "thread", threadId } });

      const threadPath = getPath(thread.nodes, nodeId);
      const threadPathText = pathToText(threadPath);

      fetch("/api/generate-thread-branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonSummary,
          characterName: thread.characterName,
          backstory: thread.backstory,
          threadPathText,
          wrapUp: wrapUpRequested,
        }),
      })
        .then((r) => r.json())
        .then((data: { branches?: import("@/lib/types").BranchOption[]; error?: string; detail?: string }) => {
          if (data.branches) {
            dispatch({ type: "THREAD_SET_OPTIONS", threadId, options: data.branches });
          } else {
            dispatch({ type: "THREAD_SET_ERROR", threadId, message: data.detail ?? data.error ?? "Unknown error" });
          }
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Network error";
          dispatch({ type: "THREAD_SET_ERROR", threadId, message: msg });
        });
    },
    []
  );

  // ── handleThreadNodeClick ──────────────────────────────────────────────────
  const handleThreadNodeClick = useCallback(
    (threadId: string, nodeId: string) => {
      dispatch({ type: "THREAD_SELECT_NODE", threadId, nodeId });
      dispatch({ type: "SET_BRANCH_CONTEXT", context: { kind: "thread", threadId } });
    },
    []
  );

  // ── handleSelectThreadBranch ───────────────────────────────────────────────
  const handleSelectThreadBranch = useCallback(
    (threadId: string, option: import("@/lib/types").BranchOption) => {
      const { characterThreads } = stateRef.current;
      const thread = characterThreads[threadId];
      if (!thread) return;

      const selectedNodeId = thread.selectedNodeId;
      const parentId = selectedNodeId; // null means root
      const siblings = thread.nodes.filter((n) => n.parentId === parentId);
      const parentDepth = parentId
        ? (thread.nodes.find((n) => n.id === parentId)?.depth ?? 0)
        : -1;

      const newNode: import("@/lib/types").StoryNode = {
        id: crypto.randomUUID(),
        text: option.text,
        tone: option.tone,
        why: option.why,
        parentId,
        depth: parentDepth + 1,
        siblingIndex: siblings.length,
        authorType: "ai",
        imageStatus: "idle",
      };
      dispatch({ type: "THREAD_ADD_NODE", threadId, node: newNode });
    },
    []
  );

  // ── handleAddUserThreadText — "Add & continue" inside a character thread ──
  // Mirrors handleAddUserText but operates on the active thread, not the main tree.
  const handleAddUserThreadText = useCallback((text: string) => {
    const { characterThreads } = stateRef.current;
    // Resolve the active thread from branchContext at call-time (not render-time)
    // to avoid stale closure issues when branchContext hasn't been set yet.
    const ctx = stateRef.current.branchContext;
    if (!ctx || ctx.kind !== "thread") return;
    const { threadId } = ctx;
    const thread = characterThreads[threadId];
    if (!thread) return;

    const parentId   = thread.selectedNodeId;
    const siblings   = thread.nodes.filter((n) => n.parentId === parentId);
    const parentDepth = parentId
      ? (thread.nodes.find((n) => n.id === parentId)?.depth ?? 0)
      : -1;

    const userNode: import("@/lib/types").StoryNode = {
      id: crypto.randomUUID(),
      text,
      tone: "User",
      why: "",
      parentId,
      depth: parentDepth + 1,
      siblingIndex: siblings.length,
      authorType: "user",
      imageStatus: "idle",
    };

    // Commit the user node into the thread.
    dispatch({ type: "THREAD_ADD_NODE", threadId, node: userNode });

    // Immediately kick off AI branch generation from the new user node so the
    // panel shows fresh options (same behaviour as handleAddUserText on the main tree).
    dispatch({ type: "THREAD_SET_LOADING", threadId });
    const { canonSummary, wrapUpRequested } = stateRef.current;
    fetch("/api/generate-thread-branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        canonSummary,
        characterName: thread.characterName,
        backstory: thread.backstory,
        // Build the thread path including the new user node.
        threadPathText: [...thread.nodes, userNode].map((n) => n.text).join("\n\n"),
        wrapUp: wrapUpRequested,
      }),
    })
      .then((r) => r.json())
      .then((data: { branches?: import("@/lib/types").BranchOption[]; error?: string; detail?: string }) => {
        if (data.branches) {
          dispatch({ type: "THREAD_SET_OPTIONS", threadId, options: data.branches });
        } else {
          dispatch({ type: "THREAD_SET_ERROR", threadId, message: data.detail ?? data.error ?? "Unknown error" });
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Network error";
        dispatch({ type: "THREAD_SET_ERROR", threadId, message: msg });
      });
  }, []);

  // ── handleWeaveNode ────────────────────────────────────────────────────────
  const handleWeaveNode = useCallback(
    async (threadId: string, threadNodeId: string) => {
      const { characterThreads, canonSummary, nodes, lastMainNodeId } = stateRef.current;
      const thread = characterThreads[threadId];
      if (!thread || !lastMainNodeId) return;

      const threadNode = thread.nodes.find((n) => n.id === threadNodeId);
      if (!threadNode) return;

      dispatch({ type: "WEAVE_LOADING" });

      const mainPath     = getPath(nodes, lastMainNodeId);
      const mainPathText = pathToText(mainPath);
      const threadPath   = getPath(thread.nodes, threadNodeId);
      const threadPathText = pathToText(threadPath);

      try {
        const res = await fetch("/api/weave-thread", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canonSummary,
            mainPathText,
            characterName: thread.characterName,
            backstory: thread.backstory,
            threadPathText,
            threadNodeText: threadNode.text,
          }),
        });
        const data = await res.json() as {
          node?: { text: string; tone: string; why: string };
          error?: string;
          detail?: string;
        };
        if (!res.ok || !data.node) {
          // Weave failed — undo the loading state without crashing
          dispatch({ type: "WEAVE_DONE",
            node: {
              // Synthesise a minimal fallback so state is consistent
              id: "", text: "", tone: "", why: "",
              parentId: null, depth: 0, siblingIndex: 0,
              authorType: "ai", imageStatus: "idle",
            } as import("@/lib/types").StoryNode,
            threadId, threadNodeId,
          });
          return;
        }
        const siblings = nodes.filter((n) => n.parentId === lastMainNodeId);
        const weavedNode: import("@/lib/types").StoryNode = {
          id: crypto.randomUUID(),
          text: data.node.text,
          tone: data.node.tone,
          why: data.node.why,
          parentId: lastMainNodeId,
          depth: (nodes.find((n) => n.id === lastMainNodeId)?.depth ?? 0) + 1,
          siblingIndex: siblings.length,
          authorType: "ai",
          imageStatus: "idle",
        };
        dispatch({ type: "WEAVE_DONE", node: weavedNode, threadId, threadNodeId });
        // Fire-and-forget summary update
        const newNodes = [...nodes, weavedNode];
        fireSummarise(pathToText(getPath(newNodes, weavedNode.id)));
      } catch (err) {
        // Network error — reset weave loading state
        dispatch({ type: "WEAVE_DONE",
          node: {
            id: "", text: "", tone: "", why: "",
            parentId: null, depth: 0, siblingIndex: 0,
            authorType: "ai", imageStatus: "idle",
          } as import("@/lib/types").StoryNode,
          threadId, threadNodeId,
        });
        console.error("[handleWeaveNode] failed:", err);
      }
    },
    [fireSummarise]
  );

  // ── handlePruneNode / handleEditNode / handleInsertNode ───────────────────
  const handlePruneNode = useCallback((nodeId: string) => {
    dispatch({ type: "PRUNE_NODE", nodeId });
  }, []);

  const handleEditNode = useCallback((nodeId: string, text: string) => {
    dispatch({ type: "EDIT_NODE", nodeId, text });
  }, []);

  const handleInsertNode = useCallback((afterNodeId: string, text: string) => {
    const { nodes } = stateRef.current;
    const after = nodes.find((n) => n.id === afterNodeId);
    if (!after) return;
    const newNode: StoryNode = {
      id: crypto.randomUUID(),
      text,
      tone: "User",
      why: "",
      parentId: afterNodeId,
      depth: after.depth + 1,
      siblingIndex: 0,
      authorType: "user",
      imageStatus: "idle",
    };
    dispatch({ type: "INSERT_NODE", afterNodeId, newNode });
  }, []);

  // ── handleThreadPruneNode / handleThreadEditNode / handleThreadInsertNode ──
  const handleThreadPruneNode = useCallback((threadId: string, nodeId: string) => {
    dispatch({ type: "THREAD_PRUNE_NODE", threadId, nodeId });
  }, []);

  const handleThreadEditNode = useCallback((threadId: string, nodeId: string, text: string) => {
    dispatch({ type: "THREAD_EDIT_NODE", threadId, nodeId, text });
  }, []);

  const handleThreadInsertNode = useCallback((threadId: string, afterNodeId: string, text: string) => {
    const { characterThreads } = stateRef.current;
    const thread = characterThreads[threadId];
    if (!thread) return;
    const after = thread.nodes.find((n) => n.id === afterNodeId);
    if (!after) return;
    const newNode: StoryNode = {
      id: crypto.randomUUID(),
      text,
      tone: "User",
      why: "",
      parentId: afterNodeId,
      depth: after.depth + 1,
      siblingIndex: 0,
      authorType: "user",
      imageStatus: "idle",
    };
    dispatch({ type: "THREAD_INSERT_NODE", threadId, afterNodeId, newNode });
  }, []);

  // ── handleEditThread ──────────────────────────────────────────────────────
  const handleEditThread = useCallback((
    threadId: string,
    characterName: string,
    backstory: string,
    relatedToThreadId?: string,
    relationshipLabel?: string
  ) => {
    dispatch({ type: "EDIT_THREAD", threadId, characterName, backstory, relatedToThreadId, relationshipLabel });
  }, []);

  // ── Jump handlers (Universe → Tree) ───────────────────────────────────────
  const handleJumpToMainNode = useCallback((nodeId: string) => {
    handleNodeClick(nodeId);
    setActiveView("tree");
  }, [handleNodeClick]);

  const handleJumpToThreadNode = useCallback((threadId: string, nodeId: string) => {
    handleThreadNodeClick(threadId, nodeId);
    setActiveView("tree");
  }, [handleThreadNodeClick]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const { nodes, pendingOptions, branchError, isLoading, drawerOpen, openingCollapsed,
          activePathIds, pendingReset, previousTree, wrapUpRequested, styleDescription,
          characterThreads, branchContext, weaveLoading, canonSummaryPending } = state;

  const hasTree = nodes.length > 0;
  const showOpeningArea = !hasTree || !openingCollapsed;
  const threadCount = Object.keys(characterThreads).length;
  const threadCapReached = threadCount >= 6;

  const activePath = activePathIds.length > 0
    ? getPath(nodes, activePathIds[activePathIds.length - 1])
    : [];

  const breadcrumb = activePath.map((n) => n.tone);

  // ── branchContext-aware panel props ────────────────────────────────────────
  const isThreadContext = branchContext?.kind === "thread";
  const activeThreadId  = isThreadContext ? (branchContext as { kind: "thread"; threadId: string }).threadId : null;
  const activeThread    = activeThreadId ? characterThreads[activeThreadId] ?? null : null;

  const panelOptions  = isThreadContext ? (activeThread?.pendingOptions ?? null) : pendingOptions;
  const panelLoading  = isThreadContext ? (activeThread?.isLoading ?? false)     : isLoading;
  const panelError    = isThreadContext ? (activeThread?.branchError ?? null)     : branchError;

  const handlePanelSelect = useCallback(
    (option: BranchOption) => {
      if (isThreadContext && activeThreadId) {
        handleSelectThreadBranch(activeThreadId, option);
      } else {
        handleSelectBranch(option);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isThreadContext, activeThreadId, handleSelectBranch, handleSelectThreadBranch]
  );

  const handlePanelRetry = useCallback(() => {
    if (isThreadContext && activeThreadId && activeThread) {
      const { selectedNodeId } = activeThread;
      if (selectedNodeId) handleThreadGenerateBranches(activeThreadId, selectedNodeId);
    } else {
      const { selectedNodeId: mainSel, nodes: ns } = stateRef.current;
      if (mainSel) fetchBranches(mainSel, ns);
    }
  }, [isThreadContext, activeThreadId, activeThread, handleThreadGenerateBranches, fetchBranches]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-gray-950 text-gray-100 overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center gap-3
                         border-b border-gray-800 px-4 py-2.5 min-w-0">

        {/* Logo — clicking triggers New Story when a tree exists */}
        <h1
          onClick={hasTree ? handleNewStory : undefined}
          className={`text-lg font-bold tracking-tight flex-shrink-0 ${hasTree ? "cursor-pointer" : ""}`}
          title={hasTree ? "New story" : undefined}
        >
          <span className="text-amber-400">fAIry</span>
          <span className="text-gray-100">talee</span>
        </h1>

        {/* ── View toggle tabs ──────────────────────────────────────────── */}
        {hasTree && (
          <div className="flex items-center gap-1 flex-shrink-0 rounded-lg bg-gray-900 border border-gray-800 p-0.5">
            <button
              onClick={() => setActiveView("tree")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors duration-100 ${
                activeView === "tree"
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Story Tree
            </button>
            <button
              onClick={() => setActiveView("universe")}
              disabled={threadCount === 0}
              title={threadCount === 0 ? "No characters yet" : "Character Universe"}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors duration-100 disabled:opacity-30 disabled:cursor-not-allowed ${
                activeView === "universe"
                  ? "bg-gray-700 text-purple-300"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              ✦ Universe
            </button>
          </div>
        )}

        {/* Centre: breadcrumb trail */}
        {breadcrumb.length > 0 && (
          <nav aria-label="Story path breadcrumb"
               className="flex-1 min-w-0 flex items-center gap-0 overflow-hidden">
            {breadcrumb.map((tone, i) => (
              <span key={i} className="flex items-center min-w-0 shrink">
                {i > 0 && (
                  <span className="mx-1 flex-shrink-0 text-gray-600 text-[10px]" aria-hidden="true">›</span>
                )}
                <span
                  className={`truncate text-[11px] font-medium ${
                    i === breadcrumb.length - 1 ? "text-amber-400" : "text-gray-500"
                  }`}
                >
                  {tone}
                </span>
              </span>
            ))}
          </nav>
        )}

        {/* Right cluster */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {hasTree && (
            <>
              <button
                onClick={handleNewStory}
                className="rounded-md px-3 py-1.5 text-[11px] font-medium text-gray-400
                           hover:text-gray-100 hover:bg-gray-800 border border-gray-700
                           transition-colors duration-100"
              >
                New story
              </button>
              <button
                onClick={handleEditOpening}
                className="rounded-md px-3 py-1.5 text-[11px] font-medium text-gray-400
                           hover:text-gray-100 hover:bg-gray-800 border border-gray-700
                           transition-colors duration-100"
              >
                ✏ Edit opening
              </button>
            </>
          )}

          <button
            onClick={() => dispatch({ type: "TOGGLE_DRAWER" })}
            disabled={activePathIds.length === 0}
            className="rounded-md px-3 py-1.5 text-[11px] font-medium text-amber-400
                       hover:bg-gray-800 border border-gray-700 disabled:opacity-30
                       disabled:cursor-not-allowed transition-colors duration-100"
          >
            Read this path
          </button>
        </div>
      </header>

      {/* ── Archive restore banner ────────────────────────────────────── */}
      {previousTree && !pendingReset && (
        <div className="flex-shrink-0 flex items-center justify-between gap-4
                        bg-gray-800 border-b border-gray-700 px-4 py-2.5">
          <p className="text-[12px] text-gray-300">Previous story archived.</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const restoredStyle = stateRef.current.previousTree?.styleDescription ?? "";
                dispatch({ type: "RESTORE_TREE" });
                setStyleText(restoredStyle);
              }}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-[12px] font-semibold
                         text-gray-950 hover:bg-amber-400 transition-colors duration-100"
            >
              Restore it
            </button>
            <button
              onClick={() => dispatch({ type: "DISMISS_ARCHIVE" })}
              aria-label="Dismiss archive banner"
              className="rounded-md p-1.5 text-gray-400 hover:text-gray-100 hover:bg-gray-700
                         transition-colors duration-100"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Reset confirmation banner ─────────────────────────────────── */}
      {pendingReset && (
        <div className="flex-shrink-0 flex items-center justify-between gap-4
                        bg-red-950 border-b border-red-800 px-4 py-3">
          <p className="text-[13px] text-red-200">
            {state.pendingOpeningText
              ? "Replace the opening with your new text? Current tree will be archived."
              : "Start a new story? Your current one will be archived."}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleConfirmReset}
              className="rounded-md bg-red-700 px-3 py-1.5 text-[12px] font-semibold
                         text-white hover:bg-red-600 transition-colors duration-100"
            >
              {state.pendingOpeningText ? "Yes, replace" : "Yes, start fresh"}
            </button>
            <button
              onClick={() => dispatch({ type: "CANCEL_RESET" })}
              className="rounded-md bg-gray-800 px-3 py-1.5 text-[12px] font-medium
                         text-gray-300 hover:bg-gray-700 border border-gray-700
                         transition-colors duration-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Opening input accordion ───────────────────────────────────── */}
      {hasTree && showOpeningArea && (
        <div className="flex-shrink-0 border-b border-gray-800 bg-gray-950 px-4 py-3">
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-2">
              <textarea
                value={openingText}
                onChange={(e) => setOpeningText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleBeginStory();
                }}
                placeholder="Write your opening sentence or two…"
                rows={2}
                className="w-full resize-none rounded-lg bg-gray-900 px-3 py-2 text-[13px]
                           text-gray-100 placeholder-gray-600 ring-1 ring-gray-700
                           focus:outline-none focus:ring-amber-500 transition-all duration-150"
              />
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {["Watercolor storybook", "Noir comic", "Pop art", "Cute cartoon", "Manga"].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => setStyleText(chip)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors duration-100
                        ${styleText === chip
                          ? "bg-amber-500 border-amber-500 text-gray-950"
                          : "bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                        }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={styleText}
                  onChange={(e) => setStyleText(e.target.value)}
                  placeholder="Or describe a custom visual style…"
                  className="w-full rounded-lg bg-gray-900 px-3 py-2 text-[12px]
                             text-gray-100 placeholder-gray-600 ring-1 ring-gray-700
                             focus:outline-none focus:ring-amber-500 transition-all duration-150"
                />
              </div>
            </div>
            <button
              onClick={handleBeginStory}
              disabled={!openingText.trim()}
              className="self-end rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-semibold
                         text-gray-950 hover:bg-amber-400 disabled:opacity-30
                         disabled:cursor-not-allowed transition-colors duration-150"
            >
              Restart
            </button>
          </div>
        </div>
      )}

      {/* ── Canvas area ───────────────────────────────────────────────── */}
      {activeView === "tree" && (
        <div className="flex-1 min-h-0 relative">
          {hasTree ? (
            <StoryTree
              nodes={nodes}
              activePathIds={activePathIds}
              onNodeClick={handleNodeClick}
              onGenerateBranches={handleGenerateBranches}
              onCreateThread={handleOpenCreateThread}
              onPaneClick={() => dispatch({ type: "DISMISS_PANEL" })}
              onPruneNode={handlePruneNode}
              onEditNode={handleEditNode}
              onInsertNode={handleInsertNode}
              characterThreads={characterThreads}
              weaveLoading={weaveLoading}
              onThreadNodeClick={handleThreadNodeClick}
              onThreadGenerateBranches={handleThreadGenerateBranches}
              onWeaveNode={handleWeaveNode}
              onShowAppearances={handleShowAppearances}
              onThreadPruneNode={handleThreadPruneNode}
              onThreadEditNode={handleThreadEditNode}
              onThreadInsertNode={handleThreadInsertNode}
            />
          ) : (
            /* ── Landing screen ─────────────────────────────────────────── */
            <div
              className="relative overflow-hidden flex h-full items-center justify-center px-6"
              style={{ background: "radial-gradient(ellipse at 50% 30%, #1c1917 0%, #030712 70%)" }}
            >
              <BackgroundScene />
              <div className="relative z-10 w-full max-w-xl flex flex-col gap-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-gray-100 tracking-tight mb-1">
                    Where does your story begin?
                  </h2>
                  <p className="text-[14px] text-gray-500">
                    Write an opening. AI proposes four directions. You pick one and branch from anywhere.
                  </p>
                </div>

                <textarea
                  value={openingText}
                  onChange={(e) => setOpeningText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleBeginStory();
                  }}
                  placeholder="It was the last train out of the city…"
                  rows={3}
                  className="w-full resize-none rounded-2xl bg-gray-900/80 px-5 py-4 text-[14px]
                             text-gray-100 placeholder-gray-600 ring-1 ring-gray-700
                             focus:outline-none focus:ring-2 focus:ring-amber-500
                             transition-all duration-150 shadow-lg"
                />

                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 text-center">
                    Visual style (optional)
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {["Watercolor storybook", "Noir comic", "Pop art", "Cute cartoon", "Manga"].map((chip) => (
                      <button
                        key={chip}
                        onClick={() => setStyleText(chip)}
                        className={`rounded-full px-3 py-1 text-[12px] font-medium border transition-colors duration-100
                          ${styleText === chip
                            ? "bg-amber-500 border-amber-500 text-gray-950"
                            : "bg-transparent border-gray-700 text-gray-400 hover:border-gray-400 hover:text-gray-200"
                          }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={styleText}
                    onChange={(e) => setStyleText(e.target.value)}
                    placeholder="Or describe a custom visual style…"
                    className="w-full rounded-2xl bg-gray-900/80 px-5 py-3 text-[13px]
                               text-gray-100 placeholder-gray-600 ring-1 ring-gray-700
                               focus:outline-none focus:ring-2 focus:ring-amber-500
                               transition-all duration-150"
                  />
                </div>

                <button
                  onClick={handleBeginStory}
                  disabled={!openingText.trim()}
                  className="w-full rounded-2xl bg-amber-500 py-3 text-[15px] font-bold text-gray-950
                             hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed
                             transition-colors duration-150 shadow-lg shadow-amber-900/20"
                >
                  Begin story
                </button>
                <p className="text-center text-[11px] text-gray-600">⌘ Enter to submit</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Character Universe view ────────────────────────────────────── */}
      {activeView === "universe" && (
        <div className="flex-1 min-h-0">
          <CharacterUniverseView
            threads={Object.values(characterThreads)}
            mainNodes={nodes}
            allThreads={characterThreads}
            onJumpToMainNode={handleJumpToMainNode}
            onJumpToThreadNode={handleJumpToThreadNode}
            onEditThread={handleEditThread}
          />
        </div>
      )}

      {/* ── Undo toast ────────────────────────────────────────────────── */}
      {undoToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3
                        rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 shadow-xl">
          <p className="text-[12px] text-gray-300">Branch committed.</p>
          <button
            onClick={handleUndo}
            className="rounded-md bg-amber-500 px-3 py-1 text-[12px] font-semibold
                       text-gray-950 hover:bg-amber-400 transition-colors duration-100"
          >
            Undo
          </button>
          <button
            onClick={() => setUndoToast(null)}
            aria-label="Dismiss"
            className="text-gray-500 hover:text-gray-200 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Branch panel — context-aware (main tree or character thread) ── */}
      {/* Shows a thread label when the active context is a thread */}
      {activeView === "tree" && isThreadContext && activeThread && (panelLoading || panelOptions || panelError) && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-1.5 border-t border-gray-800 bg-gray-950">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: THREAD_PALETTE[activeThread.paletteIndex]?.ring ?? "#6b7280" }}
          />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            {activeThread.characterName}&apos;s thread
          </span>
          {canonSummaryPending && (
            <span className="text-[9px] text-purple-400/60 animate-pulse ml-auto">
              Updating story context…
            </span>
          )}
        </div>
      )}

      {/* ── Wrap-up heads-up banner — shown when options arrive in wrapUp mode ── */}
      {activeView === "tree" && wrapUpRequested && !isThreadContext && panelOptions && !panelLoading && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-1.5 border-t border-amber-900/40 bg-amber-950/30">
          {/* Hourglass icon */}
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 text-amber-400" aria-hidden="true">
            <path d="M2 1h8M2 11h8M3 1v2l3 3-3 3v2M9 1v2L6 6l3 3v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[10px] text-amber-400/80 font-medium">
            {(() => {
              // Find the minimum nodesRemaining across non-ending options.
              const nonEnding = panelOptions.filter((o) => !o.isEnding);
              const hasEnding = panelOptions.some((o) => o.isEnding);
              const minRemaining = nonEnding.reduce(
                (min, o) => (o.nodesRemaining != null && o.nodesRemaining < min ? o.nodesRemaining : min),
                999
              );
              if (hasEnding) {
                return `Story conclusion ready — one of the options below ends the story. Others lead ~${minRemaining === 999 ? 1 : minRemaining + 1} node${minRemaining !== 0 ? "s" : ""} from the end.`;
              }
              return minRemaining < 999
                ? `Wrapping up — ~${minRemaining} more node${minRemaining !== 1 ? "s" : ""} to conclusion.`
                : "Wrapping up — conclusion approaching.";
            })()}
          </span>
        </div>
      )}

      {activeView === "tree" && (
        <BranchPanel
          options={panelOptions}
          isLoading={panelLoading}
          error={panelError}
          wrapUpRequested={wrapUpRequested}
          onSelect={handlePanelSelect}
          onAddUserText={isThreadContext ? handleAddUserThreadText : handleAddUserText}
          onToggleWrapUp={() => dispatch({ type: "TOGGLE_WRAP_UP" })}
          onRetry={handlePanelRetry}
        />
      )}

      {/* ── Side drawer ───────────────────────────────────────────────── */}
      {activeView === "tree" && (
        <PathDrawer
          isOpen={drawerOpen}
          activePath={activePath}
          styleDescription={styleDescription}
          onClose={() => dispatch({ type: "TOGGLE_DRAWER" })}
        />
      )}

      {/* ── Create thread modal ────────────────────────────────────────── */}
      {creatingThreadForNodeId && (
        <CreateThreadModal
          paletteIndex={threadCount % 6}
          existingThreads={Object.values(characterThreads)}
          onConfirm={handleConfirmCreateThread}
          onCancel={() => setCreatingThreadForNodeId(null)}
        />
      )}

      {/* ── Appearances panel ─────────────────────────────────────────── */}
      {appearancePanelThreadId && characterThreads[appearancePanelThreadId] && (
        <AppearancesPanel
          thread={characterThreads[appearancePanelThreadId]}
          mainNodes={nodes}
          allThreads={characterThreads}
          onClose={() => setAppearancePanelThreadId(null)}
        />
      )}
    </div>
  );
}
