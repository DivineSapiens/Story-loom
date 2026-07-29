"use client";

import { useState, useEffect } from "react";
import type { CharacterThread, StoryNode } from "@/lib/types";
import { THREAD_PALETTE } from "@/lib/threadPalette";
import UniverseGraph from "./UniverseGraph";
import UniverseAppearancesDrawer from "./UniverseAppearancesDrawer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CharacterUniverseViewProps {
  threads: CharacterThread[];
  mainNodes: StoryNode[];
  allThreads: Record<string, CharacterThread>;
  /** Jump to a main-tree node and switch view back to Story Tree. */
  onJumpToMainNode: (nodeId: string) => void;
  /** Jump to a thread node and switch view back to Story Tree. */
  onJumpToThreadNode: (threadId: string, nodeId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CharacterUniverseView({
  threads,
  mainNodes,
  allThreads,
  onJumpToMainNode,
  onJumpToThreadNode,
}: CharacterUniverseViewProps) {
  // Auto-select the first thread on mount / when threads list changes.
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    threads[0]?.id ?? null
  );

  // Keep selection valid if threads are added/removed.
  useEffect(() => {
    if (!selectedThreadId || !threads.find((t) => t.id === selectedThreadId)) {
      setSelectedThreadId(threads[0]?.id ?? null);
    }
  }, [threads, selectedThreadId]);

  const selectedThread = selectedThreadId
    ? threads.find((t) => t.id === selectedThreadId) ?? null
    : null;

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (threads.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3 text-center px-8">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
               className="text-gray-700" aria-hidden="true">
            <circle cx="12" cy="8"  r="3" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="5"  cy="17" r="2" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="19" cy="17" r="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 11v3M12 14L5 17M12 14l7 3" stroke="currentColor"
                  strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <p className="text-[13px] text-gray-400 font-medium">No characters yet</p>
          <p className="text-[12px] text-gray-600 max-w-xs leading-relaxed">
            Create a character thread from any story node using the{" "}
            <span className="text-purple-400 font-semibold">✦ Character</span> button.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-gray-950">

      {/* ── Left sidebar: character list ────────────────────────────────── */}
      <aside className="flex-shrink-0 w-56 flex flex-col border-r border-gray-800
                        bg-gray-950 overflow-y-auto">

        <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Characters
            <span className="ml-1.5 text-gray-700">({threads.length})</span>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {threads.map((t) => {
            const palette    = THREAD_PALETTE[t.paletteIndex] ?? THREAD_PALETTE[0];
            const isSelected = t.id === selectedThreadId;
            const hasWoven   = t.nodes.some((n) => n.woven);
            const appearCount = mainNodes.filter((n) =>
              n.text.toLowerCase().includes(t.characterName.toLowerCase())
            ).length + Object.values(allThreads).reduce((sum, ot) =>
              sum + ot.nodes.filter((n) =>
                n.text.toLowerCase().includes(t.characterName.toLowerCase())
              ).length,
              0
            );

            return (
              <button
                key={t.id}
                onClick={() => setSelectedThreadId(t.id)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left
                           transition-colors duration-100"
                style={{
                  background:  isSelected ? `${palette.ring}18` : "transparent",
                  borderLeft:  isSelected ? `3px solid ${palette.ring}` : "3px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "#ffffff08";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    isSelected ? `${palette.ring}18` : "transparent";
                }}
              >
                {/* Colour dot */}
                <span
                  className="flex-shrink-0 w-2 h-2 rounded-full"
                  style={{ background: palette.ring }}
                />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span
                    className="text-[12px] font-semibold truncate"
                    style={{ color: isSelected ? palette.text : "#d1d5db" }}
                  >
                    {t.characterName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-gray-600">
                      {t.nodes.length} {t.nodes.length === 1 ? "node" : "nodes"}
                    </span>
                    {appearCount > 0 && (
                      <span
                        className="text-[9px] rounded-full px-1 py-0.5 tabular-nums"
                        style={{ background: `${palette.ring}20`, color: palette.text }}
                      >
                        {appearCount} mention{appearCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {hasWoven && (
                      <span className="text-[8px] text-amber-400/70">✦</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Centre: relationship graph ───────────────────────────────────── */}
      <div className="flex-1 min-w-0 relative">
        <UniverseGraph
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={setSelectedThreadId}
        />

        {/* Empty-relationship hint — shown when none of the threads have relationships */}
        {threads.length > 0 && threads.every((t) => !t.relatedToThreadId) && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2
                          flex items-center gap-1.5 rounded-full bg-gray-900/80 border border-gray-700
                          px-3 py-1.5">
            <span className="text-[10px] text-gray-500">
              No relationships declared yet — set one when creating a character thread.
            </span>
          </div>
        )}
      </div>

      {/* ── Right panel: appearances drawer (key remounts on character change) ── */}
      {selectedThread && (
        <UniverseAppearancesDrawer
          key={selectedThread.id}
          thread={selectedThread}
          mainNodes={mainNodes}
          allThreads={allThreads}
          onJumpToMainNode={onJumpToMainNode}
          onJumpToThreadNode={onJumpToThreadNode}
          onClose={() => setSelectedThreadId(null)}
        />
      )}
    </div>
  );
}
