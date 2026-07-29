"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { StoryNode } from "@/lib/types";
import { THREAD_PALETTE } from "@/lib/threadPalette";
import NodeMenu from "./NodeMenu";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThreadNodeData = StoryNode & {
  /** The thread this node belongs to. */
  threadId: string;
  characterName: string;
  paletteIndex: number;
  isNewest?: boolean;
  /** True while a weave call for the whole canvas is in flight. */
  weaveLoading: boolean;
  onThreadNodeClick:        (threadId: string, nodeId: string) => void;
  onThreadGenerateBranches: (threadId: string, nodeId: string) => void;
  onWeaveNode:              (threadId: string, nodeId: string) => void;
  /** Opens the appearances panel for this character. Only on root thread nodes. */
  onShowAppearances:        (threadId: string) => void;
  onThreadPruneNode:  (threadId: string, nodeId: string) => void;
  onThreadEditNode:   (threadId: string, nodeId: string, text: string) => void;
  onThreadInsertNode: (threadId: string, afterNodeId: string, text: string) => void;
  [key: string]: unknown;
};

// ─── Tone badge colours (re-used from StoryNodeCard) ─────────────────────────

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
function toneBadgeClass(tone: string) {
  return TONE_COLOURS[tone] ?? "bg-gray-700 text-gray-300";
}

// ─── Component ────────────────────────────────────────────────────────────────

function ThreadNodeCardInner({ data }: NodeProps) {
  const d = data as ThreadNodeData;
  const {
    id, text, tone, why, parentId, woven, authorType,
    threadId, characterName, paletteIndex, isNewest, weaveLoading,
    onThreadNodeClick, onThreadGenerateBranches, onWeaveNode, onShowAppearances,
    onThreadPruneNode, onThreadEditNode, onThreadInsertNode,
  } = d;

  const palette = THREAD_PALETTE[paletteIndex] ?? THREAD_PALETTE[0];

  const handleBodyClick = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onThreadNodeClick(threadId, id); },
    [id, threadId, onThreadNodeClick]
  );
  const handleGenerate = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onThreadGenerateBranches(threadId, id); },
    [id, threadId, onThreadGenerateBranches]
  );
  const handleWeave = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onWeaveNode(threadId, id); },
    [id, threadId, onWeaveNode]
  );
  const handleShowAppearances = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onShowAppearances(threadId); },
    [threadId, onShowAppearances]
  );

  // Is this the root node of its thread (depth 0, no parent within the thread)?
  const isThreadRoot = parentId === null;

  const isUser = authorType === "user";

  return (
    <>
      {parentId !== null && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2 !h-2 !border-0"
          style={{ background: palette.edge }}
        />
      )}

      {/* pointer-events fix: same as StoryNodeCard — elementsSelectable={false} kills clicks */}
      <div
        onClick={handleBodyClick}
        style={{
          pointerEvents: "all",
          background: palette.bg,
          borderLeft: `4px solid ${palette.ring}`,
          boxShadow: `0 0 0 1px ${palette.edge}40`,
        }}
        className={`
          relative flex flex-col gap-2 w-56 rounded-xl p-3
          cursor-pointer transition-colors duration-150
          ${isNewest ? "animate-node-enter" : ""}
        `}
      >
        {/* Header row: character name + woven badge + appearances icon + ⋯ menu */}
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: palette.text }}
          >
            {characterName}
          </span>
          <div className="flex items-center gap-1">
            {woven && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                style={{ background: `${palette.ring}30`, color: palette.text, border: `1px solid ${palette.ring}60` }}
              >
                woven ✦
              </span>
            )}
            {/* Appearances icon — only on the thread root node */}
            {isThreadRoot && (
              <button
                onClick={handleShowAppearances}
                title={`Where does ${characterName} appear?`}
                className="nopan rounded p-0.5 transition-colors duration-100"
                style={{ color: `${palette.text}99` }}
                onMouseEnter={(e) => (e.currentTarget.style.color = palette.text)}
                onMouseLeave={(e) => (e.currentTarget.style.color = `${palette.text}99`)}
              >
                {/* Search/eye icon */}
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            <NodeMenu
              currentText={text}
              isRoot={parentId === null}
              accentColor={palette.text}
              onPrune={() => onThreadPruneNode(threadId, id)}
              onEdit={(newText) => onThreadEditNode(threadId, id, newText)}
              onInsert={(insertedText) => onThreadInsertNode(threadId, id, insertedText)}
            />
          </div>
        </div>

        {/* Tone badge — smaller, secondary */}
        {!isUser && (
          <span className={`self-start rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${toneBadgeClass(tone)}`}>
            {tone}
          </span>
        )}
        {isUser && (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-teal-400">
            ✏ Your words
          </span>
        )}

        <p className="text-[12px] leading-relaxed text-gray-100 line-clamp-5">{text}</p>

        {/* Why rationale */}
        {!isUser && why && (
          <p className="text-[10px] text-gray-400 italic border-t pt-1.5" style={{ borderColor: `${palette.ring}40` }}>
            <span className="not-italic font-semibold" style={{ color: `${palette.text}99` }}>Why: </span>
            {why}
          </p>
        )}

        {/* Action row — "nopan" class required for RF to pass pointer events through */}
        <div className="mt-1 flex items-center justify-between gap-1">
          <button
            onClick={handleGenerate}
            className="nopan rounded-md px-2 py-1 text-[10px] font-medium
                       transition-colors duration-100 border btn-interactive"
            style={{
              background: `${palette.ring}18`,
              borderColor: `${palette.ring}50`,
              color: palette.text,
            }}
          >
            ＋ Continue thread
          </button>
          <button
            onClick={handleWeave}
            disabled={weaveLoading}
            title="Weave this moment into the main story"
            className="nopan rounded-md px-2 py-1 text-[10px] font-semibold
                       transition-colors duration-100 border btn-interactive
                       disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: weaveLoading ? `${palette.ring}10` : `${palette.ring}30`,
              borderColor: palette.ring,
              color: palette.text,
            }}
          >
            {weaveLoading ? "Weaving…" : "Weave →"}
          </button>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !border-0"
        style={{ background: palette.edge }}
      />
    </>
  );
}

export const ThreadNodeCard = memo(ThreadNodeCardInner);
export default ThreadNodeCard;
