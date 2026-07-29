"use client";

import type { CharacterThread, StoryNode } from "@/lib/types";
import { THREAD_PALETTE } from "@/lib/threadPalette";
import { findAppearances, splitHighlights } from "@/lib/appearanceUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppearancesPanelProps {
  thread: CharacterThread;
  /** All main-tree nodes. */
  mainNodes: StoryNode[];
  /** All other character threads (for cross-thread search). */
  allThreads: Record<string, CharacterThread>;
  onClose: () => void;
}

// ─── HighlightedText — renders segments from splitHighlights ─────────────────

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

export default function AppearancesPanel({
  thread,
  mainNodes,
  allThreads,
  onClose,
}: AppearancesPanelProps) {
  const palette     = THREAD_PALETTE[thread.paletteIndex] ?? THREAD_PALETTE[0];
  const appearances = findAppearances(thread.characterName, mainNodes, allThreads);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — anchored left so it doesn't fight the PathDrawer on the right */}
      <div
        role="dialog"
        aria-label={`Appearances of ${thread.characterName}`}
        aria-modal="true"
        className="fixed top-0 left-0 z-50 h-full w-full max-w-xs
                   flex flex-col bg-gray-950 border-r border-gray-800 shadow-2xl"
      >
        {/* Header */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-5 py-4
                     border-b-4"
          style={{ borderColor: palette.ring }}
        >
          <div className="flex flex-col gap-0.5">
            <h2
              className="text-[13px] font-bold tracking-tight"
              style={{ color: palette.text }}
            >
              {thread.characterName}
            </h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">
              {appearances.length === 0
                ? "No appearances found"
                : `${appearances.length} appearance${appearances.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close appearances panel"
            className="rounded-lg p-1.5 text-gray-500 hover:text-gray-200
                       hover:bg-gray-800 transition-colors duration-100"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {appearances.length === 0 ? (
            <p className="text-[12px] text-gray-500 italic text-center pt-8">
              &ldquo;{thread.characterName}&rdquo; doesn&apos;t appear by name in any
              node text yet.
            </p>
          ) : (
            appearances.map((entry) => {
              const sourcePalette = entry.sourcePaletteIndex !== undefined
                ? THREAD_PALETTE[entry.sourcePaletteIndex]
                : null;
              return (
                <div
                  key={entry.nodeId}
                  className="rounded-lg bg-gray-900 px-3 py-2.5 flex flex-col gap-1
                             border border-gray-800"
                >
                  {/* Source badge */}
                  <div className="flex items-center gap-1.5">
                    {sourcePalette ? (
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: sourcePalette.ring }}
                      />
                    ) : (
                      <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-400" />
                    )}
                    <span
                      className="text-[9px] font-bold uppercase tracking-widest"
                      style={{ color: sourcePalette ? sourcePalette.text : "#fbbf24" }}
                    >
                      {entry.sourceLabel}
                    </span>
                    <span className="ml-auto text-[9px] text-gray-600">
                      depth {entry.depth}
                    </span>
                  </div>

                  {/* Text with highlights */}
                  <p className="text-[11px] leading-relaxed text-gray-300 line-clamp-4">
                    <HighlightedText
                      text={entry.text}
                      needle={thread.characterName}
                    />
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
