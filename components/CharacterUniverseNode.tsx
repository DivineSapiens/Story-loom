"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CharacterThread } from "@/lib/types";
import { THREAD_PALETTE } from "@/lib/threadPalette";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CharacterUniverseNodeData extends CharacterThread {
  /** True when this character is selected in the sidebar. */
  isSelected: boolean;
  /** Called when the user clicks this node in the graph. */
  onSelect: (threadId: string) => void;
  [key: string]: unknown;
}

// ─── Component ────────────────────────────────────────────────────────────────

function CharacterUniverseNodeInner({ data }: NodeProps) {
  const d       = data as CharacterUniverseNodeData;
  const palette = THREAD_PALETTE[d.paletteIndex] ?? THREAD_PALETTE[0];

  const hasWovenNode  = d.nodes.some((n) => n.woven);
  const nodeCount     = d.nodes.length;

  return (
    <>
      {/* Handles on all four sides so RF can route relationship edges freely */}
      <Handle type="source" position={Position.Top}    className="!opacity-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" id="b" />
      <Handle type="source" position={Position.Left}   className="!opacity-0 !w-0 !h-0" id="l" />
      <Handle type="source" position={Position.Right}  className="!opacity-0 !w-0 !h-0" id="r" />
      <Handle type="target" position={Position.Top}    className="!opacity-0 !w-0 !h-0" id="tt" />
      <Handle type="target" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" id="tb" />
      <Handle type="target" position={Position.Left}   className="!opacity-0 !w-0 !h-0" id="tl" />
      <Handle type="target" position={Position.Right}  className="!opacity-0 !w-0 !h-0" id="tr" />

      <div
        onClick={(e) => { e.stopPropagation(); d.onSelect(d.id); }}
        style={{
          pointerEvents:  "all",
          background:     palette.bg,
          borderColor:    d.isSelected ? "#ffffff" : palette.ring,
          borderWidth:    d.isSelected ? 3 : 2,
          borderStyle:    "solid",
          boxShadow:      d.isSelected
            ? `0 0 0 4px ${palette.ring}55, 0 8px 32px rgba(0,0,0,0.6)`
            : `0 0 0 1px ${palette.edge}40, 0 4px 16px rgba(0,0,0,0.4)`,
          transition:     "border-color 0.15s, box-shadow 0.15s",
        }}
        className="flex flex-col gap-2 w-48 rounded-2xl p-3.5 cursor-pointer"
      >
        {/* ── Top row: name + woven badge ─────────────────────────────── */}
        <div className="flex items-start justify-between gap-1">
          <span
            className="text-[13px] font-bold leading-tight tracking-tight"
            style={{ color: palette.text }}
          >
            {d.characterName}
          </span>
          {hasWovenNode && (
            <span
              className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold
                         uppercase tracking-wider"
              style={{
                background: `${palette.ring}25`,
                color:       palette.text,
                border:      `1px solid ${palette.ring}50`,
              }}
            >
              ✦ woven
            </span>
          )}
        </div>

        {/* ── Backstory snippet ────────────────────────────────────────── */}
        <p
          className="text-[10px] leading-relaxed line-clamp-2"
          style={{ color: `${palette.text}99` }}
        >
          {d.backstory}
        </p>

        {/* ── Footer: node count ───────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 pt-0.5"
             style={{ borderTop: `1px solid ${palette.ring}25` }}>
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"
                    style={{ color: `${palette.text}60` }}/>
          </svg>
          <span className="text-[9px]" style={{ color: `${palette.text}70` }}>
            {nodeCount} {nodeCount === 1 ? "node" : "nodes"}
          </span>
        </div>
      </div>
    </>
  );
}

export const CharacterUniverseNode = memo(CharacterUniverseNodeInner);
export default CharacterUniverseNode;
