"use client";

import { useReducer, useCallback, useRef, useState } from "react";
import type { TreeState, StoryNode, BranchOption } from "@/lib/types";
import { getPath, pathToText } from "@/lib/treeUtils";
import StoryTree from "@/components/StoryTree";
import BranchPanel from "@/components/BranchPanel";
import PathDrawer from "@/components/PathDrawer";

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
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_ROOT"; node: StoryNode }
  | { type: "ADD_NODE"; node: StoryNode }
  | { type: "SELECT_NODE"; nodeId: string; pathIds: string[] }
  | { type: "SET_OPTIONS"; options: BranchOption[] }
  | { type: "SET_LOADING" }
  | { type: "SHOW_EXISTING_CHILDREN"; options: BranchOption[]; nodeId: string; pathIds: string[] }
  | { type: "TOGGLE_DRAWER" }
  | { type: "TOGGLE_OPENING" }
  | { type: "CONFIRM_RESET"; pendingText: string }
  | { type: "COMMIT_RESET" }
  | { type: "CANCEL_RESET" };

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
      return { ...INITIAL_STATE };

    case "CANCEL_RESET":
      return { ...state, pendingReset: false, pendingOpeningText: "" };

    default:
      return state;
  }
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function Page() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [openingText, setOpeningText] = useState("");
  // After COMMIT_RESET we need to immediately kick off a branch fetch using
  // the pending text; use a ref so the async callback always sees the latest.
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
    } catch {
      // On failure just clear loading — user can retry via ＋ New directions.
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
    };
    dispatch({ type: "SET_ROOT", node: root });
    fetchBranches(root.id, [root]);
  }, [openingText, state.nodes.length, fetchBranches]);

  // ── handleConfirmReset ─────────────────────────────────────────────────────
  const handleConfirmReset = useCallback(() => {
    const text = state.pendingOpeningText;
    dispatch({ type: "COMMIT_RESET" });
    setOpeningText(text);
    const root: StoryNode = {
      id: crypto.randomUUID(),
      text,
      tone: "Opening",
      why: "",
      parentId: null,
      depth: 0,
      siblingIndex: 0,
    };
    // We need to re-dispatch SET_ROOT with the new root after COMMIT_RESET.
    // Use setTimeout(0) to let COMMIT_RESET render first.
    setTimeout(() => {
      dispatch({ type: "SET_ROOT", node: root });
      fetchBranches(root.id, [root]);
    }, 0);
  }, [state.pendingOpeningText, fetchBranches]);

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

  // ── handleSelectBranch ─────────────────────────────────────────────────────
  const handleSelectBranch = useCallback(
    (option: BranchOption) => {
      const { nodes, selectedNodeId } = stateRef.current;
      if (!selectedNodeId) return;

      // If the option id already exists in nodes (re-showing existing children),
      // just select that node rather than duplicating it.
      const existing = nodes.find((n) => n.id === option.id);
      if (existing) {
        const path = getPath(nodes, existing.id);
        dispatch({
          type: "SELECT_NODE",
          nodeId: existing.id,
          pathIds: path.map((n) => n.id),
        });
        return;
      }

      const siblings = nodes.filter((n) => n.parentId === selectedNodeId);
      const newNode: StoryNode = {
        id: crypto.randomUUID(),
        text: option.text,
        tone: option.tone,
        why: option.why,
        parentId: selectedNodeId,
        depth: (nodes.find((n) => n.id === selectedNodeId)?.depth ?? 0) + 1,
        siblingIndex: siblings.length,
      };
      dispatch({ type: "ADD_NODE", node: newNode });
    },
    []
  );

  // ── handleNavigateUp ───────────────────────────────────────────────────────
  const handleNavigateUp = useCallback(() => {
    const { nodes, selectedNodeId } = stateRef.current;
    if (!selectedNodeId) return;
    const current = nodes.find((n) => n.id === selectedNodeId);
    if (!current || current.parentId === null) return;
    const parentId = current.parentId;
    const path = getPath(nodes, parentId);
    dispatch({ type: "SELECT_NODE", nodeId: parentId, pathIds: path.map((n) => n.id) });
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const { nodes, pendingOptions, isLoading, drawerOpen, openingCollapsed,
          activePathIds, pendingReset } = state;

  const hasTree = nodes.length > 0;
  const showOpeningArea = !hasTree || !openingCollapsed;

  const activePath = activePathIds.length > 0
    ? getPath(nodes, activePathIds[activePathIds.length - 1])
    : [];
  const drawerText = pathToText(activePath);

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
            <button
              onClick={() => dispatch({ type: "TOGGLE_OPENING" })}
              className="rounded-md px-3 py-1.5 text-[11px] font-medium text-gray-400
                         hover:text-gray-100 hover:bg-gray-800 border border-gray-700
                         transition-colors duration-100"
            >
              ✏ Edit opening
            </button>
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

      {/* ── Reset confirmation banner ─────────────────────────────────── */}
      {pendingReset && (
        <div className="flex-shrink-0 flex items-center justify-between gap-4
                        bg-red-950 border-b border-red-800 px-4 py-3">
          <p className="text-[13px] text-red-200">
            This will clear your current story tree — continue?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleConfirmReset}
              className="rounded-md bg-red-700 px-3 py-1.5 text-[12px] font-semibold
                         text-white hover:bg-red-600 transition-colors duration-100"
            >
              Yes, start over
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
      {showOpeningArea && (
        <div className="flex-shrink-0 border-b border-gray-800 bg-gray-950 px-4 py-3">
          {!hasTree && (
            <p className="mb-2 text-center text-[13px] text-gray-500 italic">
              Where does your story begin?
            </p>
          )}
          <div className="flex gap-2">
            <textarea
              value={openingText}
              onChange={(e) => setOpeningText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleBeginStory();
              }}
              placeholder="Write your opening sentence or two…"
              rows={2}
              className="flex-1 resize-none rounded-lg bg-gray-900 px-3 py-2 text-[13px]
                         text-gray-100 placeholder-gray-600 ring-1 ring-gray-700
                         focus:outline-none focus:ring-amber-500 transition-all duration-150"
            />
            <button
              onClick={handleBeginStory}
              disabled={!openingText.trim()}
              className="self-end rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-semibold
                         text-gray-950 hover:bg-amber-400 disabled:opacity-30
                         disabled:cursor-not-allowed transition-colors duration-150"
            >
              {hasTree ? "Restart" : "Begin story"}
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
          />
        ) : (
          /* Empty state hero */
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-5xl mb-4 select-none">📖</p>
              <p className="text-[15px] text-gray-500">
                Write your opening above and press{" "}
                <span className="text-amber-400 font-medium">Begin story</span>.
              </p>
              <p className="mt-1 text-[12px] text-gray-600">
                ⌘ Enter to submit
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Branch panel ──────────────────────────────────────────────── */}
      <BranchPanel
        options={pendingOptions}
        isLoading={isLoading}
        onSelect={handleSelectBranch}
      />

      {/* ── Side drawer ───────────────────────────────────────────────── */}
      <PathDrawer
        isOpen={drawerOpen}
        pathText={drawerText}
        onClose={() => dispatch({ type: "TOGGLE_DRAWER" })}
      />
    </div>
  );
}
