"use client";

import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import type { CharacterThread } from "@/lib/types";
import { THREAD_PALETTE } from "@/lib/threadPalette";
import {
  CharacterUniverseNode,
  type CharacterUniverseNodeData,
} from "./CharacterUniverseNode";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UniverseGraphProps {
  threads: CharacterThread[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
}

// ─── Node-type registry — stable, outside component ──────────────────────────

const nodeTypes: NodeTypes = {
  universeCharacter: CharacterUniverseNode,
};

// ─── Circular layout helper ───────────────────────────────────────────────────
// Places n nodes evenly on a circle. Special cases for n ≤ 2 to avoid
// a degenerate single-point or tiny-arc layout.

const RADIUS    = 260; // px from centre to node centre
const NODE_W    = 192; // declared RF node width (matches w-48 = 192px)
const NODE_H    = 140; // declared RF node height

function circularPositions(count: number): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  if (count === 1) return [{ x: 0, y: 0 }];
  if (count === 2) return [{ x: -RADIUS, y: 0 }, { x: RADIUS, y: 0 }];
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2; // start at top
    return {
      x: Math.round(RADIUS * Math.cos(angle)),
      y: Math.round(RADIUS * Math.sin(angle)),
    };
  });
}

// ─── Inner component (has useReactFlow) ──────────────────────────────────────

function UniverseGraphInner({ threads, selectedThreadId, onSelectThread }: UniverseGraphProps) {
  const { fitView } = useReactFlow();

  const positions = useMemo(() => circularPositions(threads.length), [threads.length]);

  // ── Build RF nodes ──────────────────────────────────────────────────────────
  const rfNodes: Node[] = useMemo(
    () =>
      threads.map((t, i) => ({
        id:   t.id,
        type: "universeCharacter",
        position: positions[i] ?? { x: 0, y: 0 },
        data: {
          ...t,
          isSelected: t.id === selectedThreadId,
          onSelect:   onSelectThread,
        } satisfies CharacterUniverseNodeData,
        width:  NODE_W,
        height: NODE_H,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [threads, positions, selectedThreadId, onSelectThread]
  );

  // ── Build relationship edges ────────────────────────────────────────────────
  // One edge per declared relationship pair. Deduped by sorted pair key
  // (same pattern as StoryTree.tsx) so bidirectional declarations don't
  // produce duplicate edges.
  const rfEdges: Edge[] = useMemo(() => {
    const edges: Edge[]             = [];
    const processed = new Set<string>();

    for (const thread of threads) {
      if (!thread.relatedToThreadId || !thread.relationshipLabel) continue;
      const target = threads.find((t) => t.id === thread.relatedToThreadId);
      if (!target) continue;

      const pairKey = [thread.id, thread.relatedToThreadId].sort().join("|");
      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const srcPalette = THREAD_PALETTE[thread.paletteIndex] ?? THREAD_PALETTE[0];
      const tgtPalette = THREAD_PALETTE[target.paletteIndex] ?? THREAD_PALETTE[0];

      edges.push({
        id:     `urel-${pairKey}`,
        source: thread.id,
        target: target.id,
        type:   "smoothstep",
        label:  thread.relationshipLabel,
        labelStyle: {
          fontSize:      10,
          fontWeight:    700,
          fill:          "#e5e7eb",
          fontFamily:    "inherit",
          textTransform: "uppercase" as const,
          letterSpacing: "0.06em",
        },
        labelBgStyle: {
          fill:        "#111827",
          fillOpacity: 0.9,
        },
        labelBgPadding:      [5, 7] as [number, number],
        labelBgBorderRadius: 6,
        style: {
          stroke:          "#e5e7eb",
          strokeWidth:     1.5,
          strokeDasharray: "5 4",
          opacity:         0.55,
        },
        // tint stroke with source + target palette colours via a custom data field
        // (RF doesn't support gradient strokes natively, so we just use white/gray)
        data: {
          srcRing: srcPalette.ring,
          tgtRing: tgtPalette.ring,
        },
        animated: false,
      });
    }
    return edges;
  }, [threads]);

  // ── fitView whenever threads change ────────────────────────────────────────
  useEffect(() => {
    if (threads.length > 0) {
      const id = setTimeout(() => fitView({ padding: 0.25, duration: 400 }), 50);
      return () => clearTimeout(id);
    }
  }, [threads.length, fitView]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      minZoom={0.3}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: false }}
      className="bg-gray-950"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={28}
        size={1}
        color="#1f2937"
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

// ─── Public export (wraps provider) ──────────────────────────────────────────

export default function UniverseGraph(props: UniverseGraphProps) {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <UniverseGraphInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
