"use client";

import { useReducer, useCallback, useRef, useState } from "react";
import type { TreeState, StoryNode, BranchOption } from "@/lib/types";
import { buildImageUrl } from "@/lib/ai/generateImage";
import { getPath, pathToText } from "@/lib/treeUtils";
import StoryTree from "@/components/StoryTree";
import BranchPanel from "@/components/BranchPanel";
import PathDrawer from "@/components/PathDrawer";
import BackgroundScene from "@/components/BackgroundScene";

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: TreeState = {
  nodes: [],
  pendingOptions: null,
  selectedNodeId: null,
  activePathIds: [],
  isLoading: false,
  drawerOpen: false,
  openingCollapsed: false,
  pendingReset: false,
  pendingOpeningText: "",
  styleDescription: "",
  previousTree: null,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_ROOT"; node: StoryNode }
  | { type: "ADD_NODE"; node: StoryNode }
  | { type: "UNDO_NODE"; nodeId: string; restoredOptions: BranchOption[] }
  | { type: "SELECT_NODE"; nodeId: string; pathIds: string[] }
  | { type: "SET_OPTIONS"; options: BranchOption[] }
  | { type: "SET_LOADING" }
  | { type: "SHOW_EXISTING_CHILDREN"; options: BranchOption[]; nodeId: string; pathIds: string[] }
  | { type: "TOGGLE_DRAWER" }
  | { type: "TOGGLE_OPENING" }
  | { type: "CONFIRM_RESET"; pendingText: string }
  | { type: "COMMIT_RESET"; snapshot: import("@/lib/types").TreeSnapshot }
  | { type: "CANCEL_RESET" }
  | { type: "UPDATE_IMAGE_STATUS"; nodeId: string; status: StoryNode["imageStatus"]; retriesLeft?: number }
  | { type: "RESTORE_TREE" }
  | { type: "DISMISS_ARCHIVE" }
  | { type: "SET_STYLE"; styleDescription: string }
  | { type: "SET_PREVIEW_URL"; optionId: string; previewUrl: string };

function reducer(state: TreeState, action: Action): TreeState {
  switch (action.type) {
    case "SET_ROOT":
      return {
        ...INITIAL_STATE,
        nodes: [action.node],
        selectedNodeId: action.node.id,
        activePathIds: [action.node.id],
        openingCollapsed: true,
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
      };
    }

    case "UNDO_NODE": {
      // Remove the node and restore the parent as selected.
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
      };
    }

    case "SELECT_NODE":
      return {
        ...state,
        selectedNodeId: action.nodeId,
        activePathIds: action.pathIds,
        pendingOptions: null,
        isLoading: false,
      };

    case "SET_OPTIONS":
      return { ...state, pendingOptions: action.options, isLoading: false };

    case "SET_LOADING":
      return { ...state, isLoading: true, pendingOptions: null };

    case "SHOW_EXISTING_CHILDREN":
      return {
        ...state,
        selectedNodeId: action.nodeId,
        activePathIds: action.pathIds,
        pendingOptions: action.options,
        isLoading: false,
      };

    case "TOGGLE_DRAWER":
      return { ...state, drawerOpen: !state.drawerOpen };

    case "TOGGLE_OPENING":
      return { ...state, openingCollapsed: !state.openingCollapsed };

    case "CONFIRM_RESET":
      return { ...state, pendingReset: true, pendingOpeningText: action.pendingText };

    case "COMMIT_RESET":
      return { ...INITIAL_STATE, previousTree: action.snapshot };

    case "CANCEL_RESET":
      return { ...state, pendingReset: false, pendingOpeningText: "" };

    case "UPDATE_IMAGE_STATUS":
      return {
        ...state,
        nodes: state.nodes.map((n) => {
          if (n.id !== action.nodeId) return n;
          return {
            ...n,
            imageStatus: action.status,
            ...(action.retriesLeft !== undefined ? { imageRetries: action.retriesLeft } : {}),
          };
        }),
      };

    case "SET_PREVIEW_URL":
      return {
        ...state,
        pendingOptions: state.pendingOptions
          ? state.pendingOptions.map((o) =>
              o.id === action.optionId ? { ...o, previewImageUrl: action.previewUrl } : o
            )
          : null,
      };

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
      };
    }

    case "DISMISS_ARCHIVE":
      return { ...state, previousTree: null };

    case "SET_STYLE":
      return { ...state, styleDescription: action.styleDescription };

    default:
      return state;
  }
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function Page() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [openingText, setOpeningText] = useState("");
  const [styleText, setStyleText] = useState("");
  // undoToast: { nodeId, restoredOptions, timeoutId } — set after committing a node
  const [undoToast, setUndoToast] = useState<{
    nodeId: string;
    restoredOptions: BranchOption[];
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  // ── fetchBranches ──────────────────────────────────────────────────────────
  const fetchBranches = useCallback(async (nodeId: string, nodes: StoryNode[]) => {
    dispatch({ type: "SET_LOADING" });
    const path = getPath(nodes, nodeId);
    const pathText = pathToText(path);
    try {
      const res = await fetch("/api/generate-branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathText }),
      });
      if (!res.ok) throw new Error("API error");
      const data = (await res.json()) as { branches: BranchOption[] };
      dispatch({ type: "SET_OPTIONS", options: data.branches });

      // ── Prefetch 512px preview images for all 3 branches in parallel ──────
      const { styleDescription } = stateRef.current;
      data.branches.forEach((branch) => {
        const proxyNode = { id: branch.id, text: branch.text, tone: branch.tone } as StoryNode;
        const previewUrl = buildImageUrl(proxyNode, styleDescription, 512);
        const img = new Image();
        img.onload = () => {
          dispatch({ type: "SET_PREVIEW_URL", optionId: branch.id, previewUrl });
        };
        img.src = previewUrl;
      });
    } catch {
      dispatch({ type: "SET_OPTIONS", options: [] });
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

    // Sync the local styleText into reducer state before any tree operations.
    dispatch({ type: "SET_STYLE", styleDescription: styleText });

    // Tree already exists → ask for confirmation first.
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
      imageStatus: "idle",
      imageRetries: 0,
    };
    dispatch({ type: "SET_ROOT", node: root });
    fetchBranches(root.id, [root]);
  }, [openingText, styleText, state.nodes.length, fetchBranches]);

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
      // "New story" path — go to blank landing screen; user types fresh opening.
      setOpeningText("");
      return;
    }

    // "Edit opening" / normal submit path — start tree immediately with new text.
    setOpeningText(text);
    const root: StoryNode = {
      id: crypto.randomUUID(),
      text,
      tone: "Opening",
      why: "",
      parentId: null,
      depth: 0,
      siblingIndex: 0,
      imageStatus: "idle",
      imageRetries: 0,
    };
    setTimeout(() => {
      dispatch({ type: "SET_ROOT", node: root });
      fetchBranches(root.id, [root]);
    }, 0);
  }, [fetchBranches]);

  // ── handleEditOpening ──────────────────────────────────────────────────────
  // Pre-fills the opening textarea with the root node's text, then opens the
  // accordion. On submit the existing CONFIRM_RESET flow handles the wipe.
  const handleEditOpening = useCallback(() => {
    const { nodes } = stateRef.current;
    const root = nodes.find((n) => n.parentId === null);
    if (root) setOpeningText(root.text);
    // Ensure the accordion is open (if it was already open this is a no-op).
    if (stateRef.current.openingCollapsed) {
      dispatch({ type: "TOGGLE_OPENING" });
    }
  }, []);

  // ── handleNewStory ─────────────────────────────────────────────────────────
  // Immediately triggers the confirm-before-wipe banner with empty pending
  // text — on confirm the tree is archived and the app returns to the blank
  // landing screen (no pre-filled textarea).
  const handleNewStory = useCallback(() => {
    const { nodes } = stateRef.current;
    if (nodes.length === 0) return;
    // Collapse the opening area first so the confirm banner isn't hidden behind it.
    if (!stateRef.current.openingCollapsed) {
      dispatch({ type: "TOGGLE_OPENING" });
    }
    // "" signals handleConfirmReset to go to blank landing screen.
    dispatch({ type: "CONFIRM_RESET", pendingText: "" });
  }, []);

  // ── handleNodeClick ────────────────────────────────────────────────────────
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const { nodes } = stateRef.current;
      const children = nodes.filter((n) => n.parentId === nodeId);
      if (children.length > 0) {
        showExistingChildren(nodeId, nodes);
      } else {
        const path = getPath(nodes, nodeId);
        dispatch({
          type: "SELECT_NODE",
          nodeId,
          pathIds: path.map((n) => n.id),
        });
      }
    },
    [showExistingChildren]
  );

  // ── handleGenerateBranches ─────────────────────────────────────────────────
  const handleGenerateBranches = useCallback(
    (nodeId: string) => {
      fetchBranches(nodeId, stateRef.current.nodes);
      // Also update selectedNodeId / activePathIds to reflect this node.
      const path = getPath(stateRef.current.nodes, nodeId);
      dispatch({
        type: "SELECT_NODE",
        nodeId,
        pathIds: path.map((n) => n.id),
      });
    },
    [fetchBranches]
  );

  // ── handleImageStatusChange ────────────────────────────────────────────────
  const handleImageStatusChange = useCallback(
    (nodeId: string, status: StoryNode["imageStatus"], retriesLeft?: number) => {
      dispatch({ type: "UPDATE_IMAGE_STATUS", nodeId, status, retriesLeft });
    },
    []
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
        imageUrl: buildImageUrl(
          { id, text: option.text, tone: option.tone } as StoryNode,
          stateRef.current.styleDescription
        ),
        imageStatus: "loading",
        imageRetries: 3,
      };
      dispatch({ type: "ADD_NODE", node: newNode });

      // ── Undo toast: show for 5 s, then auto-dismiss ────────────────────────
      // Capture the current branch options so undo can restore them without a new API call.
      const restoredOptions = (pendingOptions ?? []).map((o) => ({ ...o }));
      setUndoToast((prev) => {
        if (prev) clearTimeout(prev.timeoutId);
        const timeoutId = setTimeout(() => setUndoToast(null), 5000);
        return { nodeId: id, restoredOptions, timeoutId };
      });
    },
    []
  );

  // ── handleUndo ─────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (!undoToast) return;
    clearTimeout(undoToast.timeoutId);
    dispatch({ type: "UNDO_NODE", nodeId: undoToast.nodeId, restoredOptions: undoToast.restoredOptions });
    setUndoToast(null);
  }, [undoToast]);

  // ── handleNavigateUp ───────────────────────────────────────────────────────
  // Navigate to the parent node. If the parent already has children (i.e. the
  // branch panel would be non-empty), re-show them so the panel updates visibly
  // rather than silently emptying. If the parent is a leaf, just select it.
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

  // ── Derived values ─────────────────────────────────────────────────────────
  const { nodes, pendingOptions, isLoading, drawerOpen, openingCollapsed,
          activePathIds, pendingReset, previousTree } = state;

  const hasTree = nodes.length > 0;
  const showOpeningArea = !hasTree || !openingCollapsed;

  const activePath = activePathIds.length > 0
    ? getPath(nodes, activePathIds[activePathIds.length - 1])
    : [];

  // Breadcrumb: tone labels along the active path (skip root's "Opening" label
  // only when there is just the root so the crumb still shows on a fresh tree).
  const breadcrumb = activePath.map((n) => n.tone);

  // "← Back" is only meaningful when a non-root node is selected.
  const selectedNode = state.selectedNodeId
    ? nodes.find((n) => n.id === state.selectedNodeId) ?? null
    : null;
  const canGoUp = selectedNode !== null && selectedNode.parentId !== null;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-gray-950 text-gray-100 overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center gap-3
                         border-b border-gray-800 px-4 py-2.5 min-w-0">

        {/* Left cluster: logo + back button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-amber-400">Story</span>
            <span className="text-gray-100"> Loom</span>
          </h1>

          {canGoUp && (
            <button
              onClick={handleNavigateUp}
              title="Navigate to parent node"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]
                         font-medium text-gray-400 hover:text-gray-100 hover:bg-gray-800
                         border border-gray-700 transition-colors duration-100"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M6.5 1.5L3 5l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </button>
          )}
        </div>

        {/* Centre: breadcrumb trail — truncates gracefully */}
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
                    i === breadcrumb.length - 1
                      ? "text-amber-400"          /* current node — amber */
                      : "text-gray-500"           /* ancestor — muted */
                  }`}
                >
                  {tone}
                </span>
              </span>
            ))}
          </nav>
        )}

        {/* Right cluster: action buttons */}
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
          <p className="text-[12px] text-gray-300">
            Previous story archived.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Capture styleDescription before dispatch clears previousTree.
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

      {/* ── Opening input accordion (only shown when tree exists) ─────── */}
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
              {/* Style chips + free-text input */}
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
      <div className="flex-1 min-h-0 relative">
        {hasTree ? (
          <StoryTree
            nodes={nodes}
            activePathIds={activePathIds}
            onNodeClick={handleNodeClick}
            onGenerateBranches={handleGenerateBranches}
            onImageStatusChange={handleImageStatusChange}
          />
        ) : (
          /* ── Landing screen ─────────────────────────────────────────── */
          <div
            className="relative overflow-hidden flex h-full items-center justify-center px-6"
            style={{ background: "radial-gradient(ellipse at 50% 30%, #1c1917 0%, #030712 70%)" }}
          >
            <BackgroundScene />
            <div className="relative z-10 w-full max-w-xl flex flex-col gap-6">
              {/* Hero heading */}
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-100 tracking-tight mb-1">
                  Where does your story begin?
                </h2>
                <p className="text-[14px] text-gray-500">
                  Write an opening. AI proposes three directions. You pick one and branch from anywhere.
                </p>
              </div>

              {/* Story textarea */}
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

              {/* Style section */}
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

              {/* CTA */}
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

      {/* ── Branch panel ──────────────────────────────────────────────── */}
      <BranchPanel
        options={pendingOptions}
        isLoading={isLoading}
        onSelect={handleSelectBranch}
      />

      {/* ── Side drawer ───────────────────────────────────────────────── */}
      <PathDrawer
        isOpen={drawerOpen}
        activePath={activePath}
        onClose={() => dispatch({ type: "TOGGLE_DRAWER" })}
      />
    </div>
  );
}
