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
import { computeLayout } from "@/lib/treeUtils";
import type { StoryNode } from "@/lib/types";
import { StoryNodeCard, type StoryNodeData } from "./StoryNodeCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoryTreeProps {
  nodes: StoryNode[];
  activePathIds: string[];
  onNodeClick: (nodeId: string) => void;
  onGenerateBranches: (nodeId: string) => void;
}

// ─── Node type registry — defined outside component to be referentially stable ─

const nodeTypes: NodeTypes = {
  storyNode: StoryNodeCard,
};

// ─── Inner component that has access to useReactFlow() ───────────────────────

function StoryTreeInner({
  nodes: storyNodes,
  activePathIds,
  onNodeClick,
  onGenerateBranches,
}: StoryTreeProps) {
  const { fitView } = useReactFlow();

  const activeSet = useMemo(() => new Set(activePathIds), [activePathIds]);

  // Recompute layout whenever the node list changes.
  const layout = useMemo(() => computeLayout(storyNodes), [storyNodes]);

  // Build React Flow node descriptors.
  const rfNodes: Node[] = useMemo(
    () =>
      storyNodes.map((sn): Node => ({
        id: sn.id,
        type: "storyNode",
        position: layout[sn.id] ?? { x: 0, y: 0 },
        data: {
          ...sn,
          isOnActivePath: activeSet.has(sn.id),
          onNodeClick,
          onGenerateBranches,
        } satisfies StoryNodeData,
        width: 224,
        height: 200,
      })),
    [storyNodes, layout, activeSet, onNodeClick, onGenerateBranches]
  );

  // Build React Flow edge descriptors.
  const rfEdges: Edge[] = useMemo(
    () =>
      storyNodes
        .filter((n) => n.parentId !== null)
        .map((n) => {
          const isActive = activeSet.has(n.id) && activeSet.has(n.parentId!);
          return {
            id: `e-${n.parentId}-${n.id}`,
            source: n.parentId!,
            target: n.id,
            type: "smoothstep",
            style: {
              stroke: isActive ? "#fbbf24" : "#4b5563",
              strokeWidth: isActive ? 2.5 : 1.5,
            },
            animated: false,
          };
        }),
    [storyNodes, activeSet]
  );

  // Fit the view whenever nodes are added so new content is always visible.
  useEffect(() => {
    if (storyNodes.length > 0) {
      const id = setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
      return () => clearTimeout(id);
    }
  }, [storyNodes.length, fitView]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
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
        nodeColor={(n) =>
          (n.data as StoryNodeData).isOnActivePath ? "#fbbf24" : "#374151"
        }
        maskColor="rgba(3,7,18,0.7)"
        className="!bg-gray-900 !border !border-gray-700"
      />
    </ReactFlow>
  );
}

// ─── Public export — wraps inner in ReactFlowProvider ────────────────────────

export default function StoryTree(props: StoryTreeProps) {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <StoryTreeInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
