"use client";

import { memo, useCallback, useState, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { StoryNode } from "@/lib/types";
import NodeMenu from "./NodeMenu";

// ─── Why tooltip ──────────────────────────────────────────────────────────────

function WhyTooltip({ why }: { why: string }) {
  const [open, setOpen] = useState(false);

  return (
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
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M4.5 8h3M5 9.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M6 1V0.5M10 5h.5M1.5 5H1M8.5 2.5l.4-.4M3.1 2.1l-.4-.4"
                stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
                     w-48 rounded-xl bg-gray-800 border border-gray-700
                     px-3 py-2.5 shadow-2xl shadow-black/60
                     pointer-events-none"
          style={{ animation: "tooltipIn 0.12s ease-out both" }}
          role="tooltip"
        >
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
  isNewest?: boolean;
  onNodeClick: (id: string) => void;
  onGenerateBranches: (id: string, genreOverride?: string) => void;
  onCreateThread: (id: string) => void;
  onPruneNode:  (id: string) => void;
  onEditNode:   (id: string, text: string) => void;
  onInsertNode: (afterId: string, text: string) => void;
  textBefore?: string;
  textAfter?: string;
  [key: string]: unknown;
};

// ─── Genre list ───────────────────────────────────────────────────────────────

const NODE_GENRES = [
  "Fantasy", "Sci-Fi", "Mystery", "Romance",
  "Horror", "Thriller", "Historical", "Adventure",
];

// ─── Genre badge colours ──────────────────────────────────────────────────────

const GENRE_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  Fantasy:    { bg: "bg-violet-900/60",  text: "text-violet-300",  border: "border-violet-700/50" },
  "Sci-Fi":   { bg: "bg-cyan-900/60",    text: "text-cyan-300",    border: "border-cyan-700/50"   },
  Mystery:    { bg: "bg-indigo-900/60",  text: "text-indigo-300",  border: "border-indigo-700/50" },
  Romance:    { bg: "bg-rose-900/60",    text: "text-rose-300",    border: "border-rose-700/50"   },
  Horror:     { bg: "bg-red-900/60",     text: "text-red-300",     border: "border-red-700/50"    },
  Thriller:   { bg: "bg-orange-900/60",  text: "text-orange-300",  border: "border-orange-700/50" },
  Historical: { bg: "bg-amber-900/60",   text: "text-amber-300",   border: "border-amber-700/50"  },
  Adventure:  { bg: "bg-emerald-900/60", text: "text-emerald-300", border: "border-emerald-700/50"},
};

function genreBadgeClasses(genre: string) {
  return GENRE_COLOURS[genre] ?? { bg: "bg-gray-800", text: "text-gray-300", border: "border-gray-700" };
}

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

// ─── Quill loader ─────────────────────────────────────────────────────────────

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
    textBefore = "", textAfter = "",
  } = d;

  // Per-node genre — selecting fires onGenerateBranches with the genre override,
  // which opens the BranchPanel with genre-scoped suggestions.
  const [nodeGenre, setNodeGenre] = useState("");
  const [genrePickerOpen, setGenrePickerOpen] = useState(false);
  const genrePickerRef = useRef<HTMLDivElement>(null);

  const handleBodyClick = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onNodeClick(id); },
    [id, onNodeClick]
  );

  // Fires branch generation — passes the current per-node genre override if set.
  const handleGenerate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setGenrePickerOpen(false);
      onGenerateBranches(id, nodeGenre || undefined);
    },
    [id, onGenerateBranches, nodeGenre]
  );

  // Selects a genre AND immediately fires branch generation so the
  // BranchPanel opens with genre-filtered suggestions right away.
  const handleSelectGenre = useCallback(
    (e: React.MouseEvent, genre: string) => {
      e.stopPropagation();
      const next = nodeGenre === genre ? "" : genre;
      setNodeGenre(next);
      setGenrePickerOpen(false);
      // Always re-generate branches when genre changes so the panel reflects it.
      onGenerateBranches(id, next || undefined);
    },
    [id, nodeGenre, onGenerateBranches]
  );

  const handleCreateThread = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onCreateThread(id); },
    [id, onCreateThread]
  );

  const isUser = authorType === "user";
  const ringClass = isEnding
    ? "ring-2 ring-amber-500 shadow-amber-500/30 shadow-lg"
    : isUser
      ? "ring-2 ring-teal-500 shadow-teal-500/20 shadow-md"
      : isOnActivePath
        ? "ring-2 ring-amber-400 shadow-amber-400/20 shadow-lg"
        : "ring-1 ring-gray-700 hover:ring-gray-500";

  const gc = nodeGenre ? genreBadgeClasses(nodeGenre) : null;

  return (
    <>
      {parentId !== null && (
        <Handle type="target" position={Position.Top} className="!bg-gray-600 !w-2 !h-2 !border-0" />
      )}

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
        {/* ── Top row: tone badge + ⋯ menu ────────────────────────────── */}
        <div className="flex items-center justify-between gap-1 min-w-0">
          {isEnding ? (
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
            textBefore={textBefore}
            textAfter={textAfter}
            onPrune={() => onPruneNode(id)}
            onEdit={(newText) => onEditNode(id, newText)}
            onInsert={(insertedText) => onInsertNode(id, insertedText)}
          />
        </div>

        {/* ── Node text ───────────────────────────────────────────────── */}
        <p className="text-[13px] leading-relaxed text-gray-100 line-clamp-5">{text}</p>

        {/* ── Current genre badge (shown when a genre has been set) ────── */}
        {nodeGenre && gc && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`nopan flex items-center gap-1.5 rounded-md border px-2 py-1
                        ${gc.bg} ${gc.border}`}
            style={{ pointerEvents: "all" }}
          >
            {/* Book / genre icon */}
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none"
                 className={gc.text} aria-hidden="true">
              <path d="M2 2h8v9H2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M4 2V1M8 2V1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M4 5h4M4 7h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${gc.text}`}>
              {nodeGenre}
            </span>
            {/* × to clear genre */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setNodeGenre("");
              }}
              className={`nopan ml-auto ${gc.text} opacity-50 hover:opacity-100 text-[10px] leading-none`}
              aria-label="Clear genre"
            >✕</button>
          </div>
        )}

        {/* ── Action row ──────────────────────────────────────────────── */}
        {isEnding ? (
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
          <div className="mt-1 flex flex-col gap-1.5">

            {/* ── Genre picker button ──────────────────────────────── */}
            <div
              ref={genrePickerRef}
              className="nopan relative"
              style={{ pointerEvents: "all" }}
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setGenrePickerOpen((v) => !v); }}
                className={`nopan w-full text-left rounded-md px-2 py-1 text-[10px] border
                           transition-colors duration-100 flex items-center gap-1
                           ${nodeGenre
                             ? "bg-amber-500/10 border-amber-600/40 text-amber-400/90 hover:bg-amber-500/20"
                             : "bg-gray-800/60 border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-600"
                           }`}
              >
                {/* Tag icon */}
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M1 1h5l5 5-5 5-5-5V1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                  <circle cx="3.5" cy="3.5" r="0.8" fill="currentColor"/>
                </svg>
                {nodeGenre
                  ? <span className="font-medium">{nodeGenre} genre</span>
                  : <span>Set genre for next directions…</span>
                }
                <svg width="7" height="7" viewBox="0 0 8 8" fill="none"
                     className="ml-auto opacity-50" aria-hidden="true">
                  <path d="M1 3l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </button>

              {/* Dropdown */}
              {genrePickerOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="nopan absolute left-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700
                             rounded-xl shadow-xl shadow-black/60 p-2 flex flex-wrap gap-1 w-52"
                  style={{ pointerEvents: "all" }}
                >
                  {/* "Any" = clear */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleSelectGenre(e, ""); }}
                    className={`nopan rounded-full px-2 py-0.5 text-[10px] font-medium border
                      transition-colors duration-100
                      ${nodeGenre === ""
                        ? "bg-gray-700 text-gray-200 border-gray-600"
                        : "bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300"
                      }`}
                  >
                    Any
                  </button>
                  {NODE_GENRES.map((g) => {
                    const gc = genreBadgeClasses(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={(e) => handleSelectGenre(e, g)}
                        className={`nopan rounded-full px-2 py-0.5 text-[10px] font-medium border
                          transition-colors duration-100
                          ${nodeGenre === g
                            ? `${gc.bg} ${gc.text} ${gc.border}`
                            : "bg-gray-800 text-gray-400 border-gray-700 hover:border-amber-500/50 hover:text-gray-200"
                          }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Bottom action row ────────────────────────────────── */}
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <button
                onClick={handleGenerate}
                className="nopan rounded-md bg-gray-800 px-2 py-1 text-[11px] font-medium
                           text-amber-400 hover:bg-gray-700 hover:text-amber-300
                           transition-colors duration-100 border border-gray-700 btn-interactive"
              >
                ＋ New directions
              </button>

              <div className="flex items-center gap-1">
                {!isUser && why && <WhyTooltip why={why} />}

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
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-600 !w-2 !h-2 !border-0" />
    </>
  );
}

export const StoryNodeCard = memo(StoryNodeCardInner);
export default StoryNodeCard;
