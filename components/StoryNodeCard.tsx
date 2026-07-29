"use client";

import { memo, useCallback, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { StoryNode } from "@/lib/types";
import NodeMenu from "./NodeMenu";

// ─── Why tooltip ──────────────────────────────────────────────────────────────
// Pure React state tooltip — avoids CSS :hover which can be unreliable inside
// React Flow's canvas. The tooltip floats above the card using absolute positioning
// with a fixed max-width so it never overflows the viewport edge.

function WhyTooltip({ why }: { why: string }) {
  const [open, setOpen] = useState(false);

  return (
    // "nopan" stops RF drag handler eating the mouse events on this button.
    <div className="nopan relative flex items-center" style={{ pointerEvents: "all" }}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="Why this direction?"
        className="flex items-center justify-center w-5 h-5 rounded-full
                   bg-gray-800 border border-gray-600 text-gray-500
                   hover:border-amber-500/60 hover:text-amber-400
                   transition-colors duration-100 focus:outline-none focus-visible:ring-1
                   focus-visible:ring-amber-500 flex-shrink-0"
      >
        {/* Lightbulb-style "why" icon */}
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M4.5 8h3M5 9.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M6 1V0.5M10 5h.5M1.5 5H1M8.5 2.5l.4-.4M3.1 2.1l-.4-.4"
                stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Floating tooltip — rendered above the button, left-aligned, fixed width */}
      {open && (
        <div
          // Stop card body click from firing when tooltip is tapped on mobile
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
                     w-48 rounded-xl bg-gray-800 border border-gray-700
                     px-3 py-2.5 shadow-2xl shadow-black/60
                     pointer-events-none"
          style={{ animation: "tooltipIn 0.12s ease-out both" }}
          role="tooltip"
        >
          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
               style={{
                 borderLeft: "5px solid transparent",
                 borderRight: "5px solid transparent",
                 borderTop: "5px solid #374151",
               }} />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/80 mb-1">
            Why this direction
          </p>
          <p className="text-[11px] leading-relaxed text-gray-300 italic">{why}</p>
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type StoryNodeData = StoryNode & {
  isOnActivePath: boolean;
  /** True only on the most recently-committed node; drives enter animation. */
  isNewest?: boolean;
  onNodeClick: (id: string) => void;
  onGenerateBranches: (id: string) => void;
  /** Opens the CreateThreadModal for this node. Only called on depth >= 1. */
  onCreateThread: (id: string) => void;
  onPruneNode:  (id: string) => void;
  onEditNode:   (id: string, text: string) => void;
  onInsertNode: (afterId: string, text: string) => void;
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

// ─── Quill loader — reusable in branch generation loading state ───────────────

export function QuillLoader({ size = 28 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-1" aria-label="Loading">
      <svg
        width={size} height={size}
        viewBox="0 0 24 24" fill="none"
        className="animate-quill-bob text-amber-400"
        aria-hidden="true"
      >
        <path d="M20 4C16 2 8 6 4 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M20 4L8 16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
        <path d="M17 7L9 15" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.35"/>
        <path d="M4 20l2-3 1 2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
      <div
        className="w-1 h-1 rounded-full bg-amber-400/70 animate-ink-drip"
        style={{ marginTop: -4 }}
        aria-hidden="true"
      />
    </div>
  );
}

// ─── Card component ───────────────────────────────────────────────────────────

function StoryNodeCardInner({ data }: NodeProps) {
  const d = data as StoryNodeData;
  const {
    id, text, tone, why, parentId, depth, authorType,
    isOnActivePath, isNewest, isEnding, onNodeClick, onGenerateBranches, onCreateThread,
    onPruneNode, onEditNode, onInsertNode,
  } = d;

  const handleBodyClick = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onNodeClick(id); },
    [id, onNodeClick]
  );
  const handleGenerate = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onGenerateBranches(id); },
    [id, onGenerateBranches]
  );
  const handleCreateThread = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onCreateThread(id); },
    [id, onCreateThread]
  );

  // User-authored nodes get a teal accent ring; AI nodes get the standard amber-on-active.
  // Ending nodes get a golden "The End" ring regardless of path state.
  const isUser = authorType === "user";
  const ringClass = isEnding
    ? "ring-2 ring-amber-500 shadow-amber-500/30 shadow-lg"
    : isUser
      ? "ring-2 ring-teal-500 shadow-teal-500/20 shadow-md"
      : isOnActivePath
        ? "ring-2 ring-amber-400 shadow-amber-400/20 shadow-lg"
        : "ring-1 ring-gray-700 hover:ring-gray-500";

  return (
    <>
      {parentId !== null && (
        <Handle type="target" position={Position.Top} className="!bg-gray-600 !w-2 !h-2 !border-0" />
      )}

      {/*
        IMPORTANT — pointer-events fix for React Flow v12:
        elementsSelectable={false} sets pointer-events:none on the RF node
        wrapper, which silently swallows every click inside the node.
        We restore pointer events on the card div itself with style, and
        add the "nopan" class to every interactive button so RF's internal
        drag handler also passes those events through.
      */}
      <div
        onClick={handleBodyClick}
        style={{ pointerEvents: "all" }}
        className={`
          relative flex flex-col gap-2 w-56 rounded-xl bg-gray-900 p-3
          cursor-pointer transition-colors duration-150
          ${ringClass}
          ${isNewest ? "animate-node-enter" : ""}
        `}
      >
        {/* Top row: tone badge (or user label) + ⋯ menu */}
        <div className="flex items-center justify-between gap-1 min-w-0">
          {isEnding ? (
            /* "THE END" badge — replaces tone badge on conclusion nodes */
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400/90
                               bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
                ✦ The End
              </span>
            </div>
          ) : isUser ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none"
                   className="text-teal-400 flex-shrink-0" aria-hidden="true">
                <path d="M9.5 1.5l3 3L4 13H1v-3L9.5 1.5z" stroke="currentColor"
                      strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-teal-400">
                Your words
              </span>
            </div>
          ) : (
            <span className={`self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneBadgeClass(tone)}`}>
              {tone}
            </span>
          )}
          <NodeMenu
            currentText={text}
            isRoot={parentId === null}
            accentColor="#6b7280"
            onPrune={() => onPruneNode(id)}
            onEdit={(newText) => onEditNode(id, newText)}
            onInsert={(insertedText) => onInsertNode(id, insertedText)}
          />
        </div>

        <p className="text-[13px] leading-relaxed text-gray-100 line-clamp-5">{text}</p>

        {/* Action row — "nopan" class is required: tells RF to pass pointer events through */}
        {isEnding ? (
          /* Ending node: no branching allowed — show a read-only note instead */
          <div className="mt-1 flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"
                 className="text-amber-500/60 flex-shrink-0" aria-hidden="true">
              <path d="M6 1v5.5M6 9v1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            <span className="text-[10px] text-gray-600 italic">
              Story complete — branch from an earlier node to explore other paths.
            </span>
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-between gap-1 flex-wrap">
            <button
              onClick={handleGenerate}
              className="nopan rounded-md bg-gray-800 px-2 py-1 text-[11px] font-medium
                         text-amber-400 hover:bg-gray-700 hover:text-amber-300
                         transition-colors duration-100 border border-gray-700 btn-interactive"
            >
              ＋ New directions
            </button>

            {/* Right cluster: Why tooltip + Character button */}
            <div className="flex items-center gap-1">
              {/* Why tooltip — only for AI nodes that have a rationale */}
              {!isUser && why && <WhyTooltip why={why} />}

              {/* "Branch a character" — only on depth >= 1 nodes */}
              {depth >= 1 && (
                <button
                  onClick={handleCreateThread}
                  title="Start a character's side story from this point"
                  className="nopan rounded-md bg-gray-800 px-2 py-1 text-[10px] font-medium
                             text-purple-400 hover:bg-gray-700 hover:text-purple-300
                             transition-colors duration-100 border border-gray-700 btn-interactive"
                >
                  ✦ Character
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-600 !w-2 !h-2 !border-0" />
    </>
  );
}

export const StoryNodeCard = memo(StoryNodeCardInner);
export default StoryNodeCard;
