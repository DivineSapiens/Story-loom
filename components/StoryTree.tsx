"use client";

import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
  BackgroundVariant,
  ReactFlowProvider,
} from "@xyflow/react";
import { computeLayout, computeThreadLayout } from "@/lib/treeUtils";
import { THREAD_PALETTE } from "@/lib/threadPalette";
import type { StoryNode, CharacterThread } from "@/lib/types";
import { StoryNodeCard, type StoryNodeData } from "./StoryNodeCard";
import { ThreadNodeCard, type ThreadNodeData } from "./ThreadNodeCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoryTreeProps {
  // ── Main tree ──────────────────────────────────────────────────────────────
  nodes: StoryNode[];
  activePathIds: string[];
  onNodeClick: (nodeId: string) => void;
  onGenerateBranches: (nodeId: string) => void;
  /** Called when user clicks "Branch a character's story →" on a main node. */
  onCreateThread: (originNodeId: string) => void;
  /** Called when user clicks the canvas background — dismisses the branch panel. */
  onPaneClick: () => void;
  onPruneNode:  (nodeId: string) => void;
  onEditNode:   (nodeId: string, text: string) => void;
  onInsertNode: (afterNodeId: string, text: string) => void;
  // ── Character threads ──────────────────────────────────────────────────────
  characterThreads: Record<string, CharacterThread>;
  weaveLoading: boolean;
  onThreadNodeClick: (threadId: string, nodeId: string) => void;
  onThreadGenerateBranches: (threadId: string, nodeId: string) => void;
  onWeaveNode: (threadId: string, nodeId: string) => void;
  /** Opens the appearances panel for a character thread. */
  onShowAppearances: (threadId: string) => void;
  onThreadPruneNode:  (threadId: string, nodeId: string) => void;
  onThreadEditNode:   (threadId: string, nodeId: string, text: string) => void;
  onThreadInsertNode: (threadId: string, afterNodeId: string, text: string) => void;
}

// ─── Node type registry — must be referentially stable (outside component) ────

const nodeTypes: NodeTypes = {
  storyNode:  StoryNodeCard,
  threadNode: ThreadNodeCard,
};

// ─── Inner component (has access to useReactFlow) ─────────────────────────────

function StoryTreeInner({
  nodes: storyNodes,
  activePathIds,
  onNodeClick,
  onGenerateBranches,
  onCreateThread,
  onPaneClick,
  onPruneNode,
  onEditNode,
  onInsertNode,
  characterThreads,
  weaveLoading,
  onThreadNodeClick,
  onThreadGenerateBranches,
  onWeaveNode,
  onShowAppearances,
  onThreadPruneNode,
  onThreadEditNode,
  onThreadInsertNode,
}: StoryTreeProps) {
  const { fitView } = useReactFlow();

  const activeSet = useMemo(() => new Set(activePathIds), [activePathIds]);

  // ── Main tree layout ───────────────────────────────────────────────────────
  const mainLayout = useMemo(() => computeLayout(storyNodes), [storyNodes]);

  const newestMainNodeId = storyNodes.length > 0
    ? storyNodes[storyNodes.length - 1].id
    : null;

  // ── Build main-tree RF nodes ───────────────────────────────────────────────
  const mainRfNodes: Node[] = useMemo(
    () =>
      storyNodes.map((sn): Node => ({
        id: sn.id,
        type: "storyNode",
        position: mainLayout[sn.id] ?? { x: 0, y: 0 },
        data: {
          ...sn,
          isOnActivePath: activeSet.has(sn.id),
          isNewest: sn.id === newestMainNodeId,
          onNodeClick,
          onGenerateBranches,
          onCreateThread,
          onPruneNode,
          onEditNode,
          onInsertNode,
        } satisfies StoryNodeData,
        width: 224,
        // 240px matches the tallest realistic card (tone badge + 5-line text +
        // "Why:" line). React Flow uses this for minimap and overlap detection.
        height: 240,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storyNodes, mainLayout, activeSet, onNodeClick, onGenerateBranches, onCreateThread, onPruneNode, onEditNode, onInsertNode]
  );

  // ── Build main-tree RF edges ───────────────────────────────────────────────
  const newestMainEdgeId = storyNodes.length > 1
    ? `e-${storyNodes[storyNodes.length - 1].parentId}-${storyNodes[storyNodes.length - 1].id}`
    : null;

  const mainRfEdges: Edge[] = useMemo(
    () =>
      storyNodes
        .filter((n) => n.parentId !== null)
        .map((n) => {
          const isActive = activeSet.has(n.id) && activeSet.has(n.parentId!);
          const edgeId = `e-${n.parentId}-${n.id}`;
          return {
            id: edgeId,
            source: n.parentId!,
            target: n.id,
            type: "smoothstep",
            className: edgeId === newestMainEdgeId ? "edge-new" : undefined,
            style: {
              stroke: isActive ? "#fbbf24" : "#4b5563",
              strokeWidth: isActive ? 2.5 : 1.5,
            },
            animated: false,
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storyNodes, activeSet]
  );

  // ── Build thread RF nodes + edges ─────────────────────────────────────────
  const { threadRfNodes, threadRfEdges } = useMemo(() => {
    const tNodes: Node[] = [];
    const tEdges: Edge[] = [];

    const threads = Object.values(characterThreads);
    for (const thread of threads) {
      const palette = THREAD_PALETTE[thread.paletteIndex] ?? THREAD_PALETTE[0];
      const threadLayout = computeThreadLayout(thread, mainLayout);

      // Thread nodes
      const newestThreadNodeId = thread.nodes.length > 0
        ? thread.nodes[thread.nodes.length - 1].id
        : null;

      for (const tn of thread.nodes) {
        tNodes.push({
          id: tn.id,
          type: "threadNode",
          position: threadLayout[tn.id] ?? { x: 0, y: 0 },
          data: {
            ...tn,
            threadId: thread.id,
            characterName: thread.characterName,
            paletteIndex: thread.paletteIndex,
            isNewest: tn.id === newestThreadNodeId,
            weaveLoading,
            onThreadNodeClick,
            onThreadGenerateBranches,
            onWeaveNode,
            onShowAppearances,
            onThreadPruneNode,
            onThreadEditNode,
            onThreadInsertNode,
          } satisfies ThreadNodeData,
          width: 224,
          height: 220,
        });
      }

      // Intra-thread edges (parent → child within the thread)
      for (const tn of thread.nodes) {
        if (tn.parentId === null) continue;
        tEdges.push({
          id: `te-${tn.parentId}-${tn.id}`,
          source: tn.parentId,
          target: tn.id,
          type: "smoothstep",
          style: { stroke: palette.edge, strokeWidth: 1.5 },
          animated: false,
        });
      }

      // Origin edge: dashed line from main-tree origin node → first thread node
      if (thread.nodes.length > 0) {
        const threadRoot = thread.nodes.find((n) => n.parentId === null);
        if (threadRoot) {
          tEdges.push({
            id: `thread-entry-${thread.id}`,
            source: thread.originNodeId,
            target: threadRoot.id,
            type: "straight",
            style: {
              stroke: palette.ring,
              strokeWidth: 1.5,
              strokeDasharray: "6 4",
            },
            animated: false,
          });
        }
      }

    }

    // ── Relationship edges — drawn between the origin nodes of two related threads ─
    // These are dotted white/gray, styled distinctly from the dashed origin-connector.
    // We only emit one edge per pair (the thread that declares relatedToThreadId
    // is the "source"; we skip if the target thread doesn't exist).
    // Source anchor: the origin node of this thread (a main-tree node).
    // Target anchor: the origin node of the related thread (also a main-tree node).
    // Because both endpoints are main-tree nodes, they are already in the RF graph.
    const processedRelationPairs = new Set<string>();
    for (const thread of threads) {
      if (!thread.relatedToThreadId || !thread.relationshipLabel) continue;
      const targetThread = characterThreads[thread.relatedToThreadId];
      if (!targetThread) continue;

      // Deduplicate: skip if we already emitted A→B or B→A
      const pairKey = [thread.id, thread.relatedToThreadId].sort().join("|");
      if (processedRelationPairs.has(pairKey)) continue;
      processedRelationPairs.add(pairKey);

      const thisPalette   = THREAD_PALETTE[thread.paletteIndex]   ?? THREAD_PALETTE[0];
      const targetPalette = THREAD_PALETTE[targetThread.paletteIndex] ?? THREAD_PALETTE[0];

      // Edge colour: blend the two thread colours by using white with low opacity.
      // This keeps it visually distinct from the palette-coloured origin edges.
      tEdges.push({
        id: `rel-${pairKey}`,
        source: thread.originNodeId,
        target: targetThread.originNodeId,
        type: "straight",
        label: thread.relationshipLabel,
        labelStyle: {
          fontSize: 9,
          fontWeight: 700,
          fill: "#e5e7eb",
          fontFamily: "inherit",
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
        },
        labelBgStyle: {
          fill: "#111827",
          fillOpacity: 0.85,
        },
        labelBgPadding: [4, 6] as [number, number],
        labelBgBorderRadius: 4,
        style: {
          stroke: "#e5e7eb",
          strokeWidth: 1,
          strokeDasharray: "3 3",
          opacity: 0.45,
        },
        animated: false,
        // Suppress the default arrowhead — this is a bidirectional relationship
        markerEnd: undefined,
        data: { thisPaletteRing: thisPalette.ring, targetPaletteRing: targetPalette.ring },
      });
    }

    return { threadRfNodes: tNodes, threadRfEdges: tEdges };
  }, [characterThreads, mainLayout, weaveLoading, onThreadNodeClick, onThreadGenerateBranches, onWeaveNode, onShowAppearances, onThreadPruneNode, onThreadEditNode, onThreadInsertNode]);

  // ── Merge all nodes + edges ────────────────────────────────────────────────
  const allNodes = useMemo(
    () => [...mainRfNodes, ...threadRfNodes],
    [mainRfNodes, threadRfNodes]
  );
  const allEdges = useMemo(
    () => [...mainRfEdges, ...threadRfEdges],
    [mainRfEdges, threadRfEdges]
  );

  // ── Fit view whenever anything is added ───────────────────────────────────
  useEffect(() => {
    const totalNodes = storyNodes.length +
      Object.values(characterThreads).reduce((s, t) => s + t.nodes.length, 0);
    if (totalNodes > 0) {
      const id = setTimeout(() => fitView({ padding: 0.18, duration: 400 }), 50);
      return () => clearTimeout(id);
    }
  }, [
    storyNodes.length,
    // Re-fit when any thread gains or loses nodes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(characterThreads).reduce((s, t) => s + t.nodes.length, 0),
    fitView,
  ]);

  return (
    <ReactFlow
      nodes={allNodes}
      edges={allEdges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.15}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      onPaneClick={onPaneClick}
      proOptions={{ hideAttribution: false }}
      className="bg-gray-950"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="#374151"
      />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={(n) => {
          const d = n.data as (StoryNodeData | ThreadNodeData);
          // Thread nodes coloured by their palette
          if ("paletteIndex" in d) {
            return THREAD_PALETTE[(d as ThreadNodeData).paletteIndex]?.ring ?? "#374151";
          }
          return (d as StoryNodeData).isOnActivePath ? "#fbbf24" : "#374151";
        }}
        maskColor="rgba(3,7,18,0.7)"
        className="!bg-gray-900 !border !border-gray-700"
      />
    </ReactFlow>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export default function StoryTree(props: StoryTreeProps) {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <StoryTreeInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
