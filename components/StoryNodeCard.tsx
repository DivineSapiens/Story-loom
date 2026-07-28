"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { StoryNode } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

// React Flow v12 requires node data to extend Record<string, unknown>.
// We satisfy that constraint by intersecting with it here.
export type StoryNodeData = StoryNode & {
  isOnActivePath: boolean;
  onNodeClick: (id: string) => void;
  onGenerateBranches: (id: string) => void;
  [key: string]: unknown;
};

// ─── Tone badge colours ───────────────────────────────────────────────────────

const TONE_COLOURS: Record<string, string> = {
  Opening:    "bg-sky-800 text-sky-200",
  Tense:      "bg-red-900 text-red-200",
  Revelatory: "bg-purple-900 text-purple-200",
  Melancholy: "bg-blue-900 text-blue-200",
  Hopeful:    "bg-green-900 text-green-200",
  Mysterious: "bg-indigo-900 text-indigo-200",
  Humorous:   "bg-yellow-800 text-yellow-200",
  Dark:       "bg-gray-800 text-gray-300",
};

function toneBadgeClass(tone: string): string {
  return TONE_COLOURS[tone] ?? "bg-gray-700 text-gray-300";
}

// ─── Component ────────────────────────────────────────────────────────────────

function StoryNodeCardInner({ data }: NodeProps) {
  const d = data as StoryNodeData;
  const {
    id,
    text,
    tone,
    why,
    parentId,
    isOnActivePath,
    onNodeClick,
    onGenerateBranches,
  } = d;

  const handleBodyClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onNodeClick(id);
    },
    [id, onNodeClick]
  );

  const handleGenerate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onGenerateBranches(id);
    },
    [id, onGenerateBranches]
  );

  const ringClass = isOnActivePath
    ? "ring-2 ring-amber-400 shadow-amber-400/20 shadow-lg"
    : "ring-1 ring-gray-700 hover:ring-gray-500";

  return (
    <>
      {/* Incoming handle — hidden on root node */}
      {parentId !== null && (
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-gray-600 !w-2 !h-2 !border-0"
        />
      )}

      <div
        onClick={handleBodyClick}
        className={`
          relative flex flex-col gap-2 w-56 rounded-xl bg-gray-900 p-3
          cursor-pointer transition-all duration-150 ${ringClass}
        `}
      >
        {/* Tone badge */}
        <span
          className={`self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneBadgeClass(tone)}`}
        >
          {tone}
        </span>

        {/* Story text */}
        <p className="text-[13px] leading-relaxed text-gray-100 line-clamp-5">
          {text}
        </p>

        {/* Why rationale — hidden on root node (why is empty) */}
        {why && (
          <p className="text-[11px] text-gray-400 italic border-t border-gray-700 pt-2">
            <span className="not-italic font-semibold text-gray-500">Why: </span>
            {why}
          </p>
        )}

        {/* ＋ New directions button */}
        <button
          onClick={handleGenerate}
          className="
            mt-1 self-end rounded-md bg-gray-800 px-2 py-1 text-[11px]
            font-medium text-amber-400 hover:bg-gray-700 hover:text-amber-300
            transition-colors duration-100 border border-gray-700
          "
        >
          ＋ New directions
        </button>
      </div>

      {/* Outgoing handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-600 !w-2 !h-2 !border-0"
      />
    </>
  );
}

export const StoryNodeCard = memo(StoryNodeCardInner);
export default StoryNodeCard;
