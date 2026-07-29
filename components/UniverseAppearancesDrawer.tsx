"use client";

import type { CharacterThread, StoryNode } from "@/lib/types";
import { THREAD_PALETTE } from "@/lib/threadPalette";
import { findAppearances, splitHighlights } from "@/lib/appearanceUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UniverseAppearancesDrawerProps {
  thread: CharacterThread;
  mainNodes: StoryNode[];
  allThreads: Record<string, CharacterThread>;
  /** Jump to a main-tree node and switch back to the Story Tree view. */
  onJumpToMainNode: (nodeId: string) => void;
  /** Jump to a thread node and switch back to the Story Tree view. */
  onJumpToThreadNode: (threadId: string, nodeId: string) => void;
  onClose: () => void;
}

// ─── HighlightedText ─────────────────────────────────────────────────────────

function HighlightedText({ text, needle }: { text: string; needle: string }) {
  const segments = splitHighlights(text, needle);
  return (
    <>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark key={i} className="bg-amber-400/30 text-amber-200 rounded-sm px-0.5 not-italic">
            {seg.text}
          </mark>
        ) : (
          seg.text
        )
      )}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UniverseAppearancesDrawer({
  thread,
  mainNodes,
  allThreads,
  onJumpToMainNode,
  onJumpToThreadNode,
  onClose,
}: UniverseAppearancesDrawerProps) {
  const palette     = THREAD_PALETTE[thread.paletteIndex] ?? THREAD_PALETTE[0];
  const appearances = findAppearances(thread.characterName, mainNodes, allThreads);

  return (
    <div
      className="h-full w-full max-w-sm flex flex-col bg-gray-950
                 border-l border-gray-800 shadow-2xl"
      style={{ animation: "slideInRight 0.2s ease-out both" }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b-4"
        style={{ borderColor: palette.ring }}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2
            className="text-[14px] font-bold tracking-tight truncate"
            style={{ color: palette.text }}
          >
            {thread.characterName}
          </h2>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">
            {appearances.length === 0
              ? "No appearances found"
              : `${appearances.length} appearance${appearances.length === 1 ? "" : "s"} in story`}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close appearances drawer"
          className="flex-shrink-0 ml-3 rounded-lg p-1.5 text-gray-500 hover:text-gray-200
                     hover:bg-gray-800 transition-colors duration-100"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* ── Backstory ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-gray-800">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">
          Backstory
        </p>
        <p className="text-[12px] leading-relaxed text-gray-400">{thread.backstory}</p>
      </div>

      {/* ── Appearances list ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">

        {appearances.length === 0 ? (
          <div className="flex flex-col items-center gap-2 pt-10">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                 className="text-gray-700" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M16.5 16.5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M9 11h4M11 9v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <p className="text-[12px] text-gray-500 italic text-center">
              &ldquo;{thread.characterName}&rdquo; isn&apos;t mentioned by name<br/>in any story node yet.
            </p>
          </div>
        ) : (
          appearances.map((entry, i) => {
            const isMainStory   = entry.source === "main";
            const srcPalette    = entry.sourcePaletteIndex !== undefined
              ? THREAD_PALETTE[entry.sourcePaletteIndex]
              : null;

            return (
              <div
                key={`${entry.nodeId}-${i}`}
                className="rounded-xl bg-gray-900 flex flex-col gap-2
                           border border-gray-800 overflow-hidden"
                style={{ animation: `fadeUp 0.18s ease-out ${i * 40}ms both` }}
              >
                {/* Source bar */}
                <div
                  className="flex items-center gap-1.5 px-3 pt-2.5"
                >
                  {srcPalette ? (
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: srcPalette.ring }}
                    />
                  ) : (
                    <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-400"/>
                  )}
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest"
                    style={{ color: srcPalette ? srcPalette.text : "#fbbf24" }}
                  >
                    {entry.sourceLabel}
                  </span>
                  <span className="ml-auto text-[9px] text-gray-600 tabular-nums">
                    depth {entry.depth}
                  </span>
                </div>

                {/* Text snippet */}
                <p className="px-3 text-[11px] leading-relaxed text-gray-300 line-clamp-4">
                  <HighlightedText text={entry.text} needle={thread.characterName} />
                </p>

                {/* Jump button */}
                <button
                  onClick={() => {
                    if (isMainStory) {
                      onJumpToMainNode(entry.nodeId);
                    } else if (entry.sourceThreadId) {
                      onJumpToThreadNode(entry.sourceThreadId, entry.nodeId);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold
                             uppercase tracking-wide transition-colors duration-100
                             border-t border-gray-800 text-left"
                  style={{ color: srcPalette ? srcPalette.text : "#fbbf24" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#ffffff0a";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Jump to this node
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── Keyframes ───────────────────────────────────────────────────── */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes fadeUp {
          from { transform: translateY(6px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
