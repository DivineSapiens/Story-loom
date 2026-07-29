"use client";

import { useState, useEffect, useRef } from "react";
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
  /** Saves edits to an existing character thread (name, backstory, relationship). */
  onEditThread: (
    threadId: string,
    characterName: string,
    backstory: string,
    relatedToThreadId?: string,
    relationshipLabel?: string
  ) => void;
}

// ─── Suggested relationship labels (same as CreateThreadModal) ────────────────
const RELATION_CHIPS = ["sibling", "rival", "mentor", "ally", "lover", "enemy", "parent", "friend"];

// ─── Inline edit form ─────────────────────────────────────────────────────────

interface EditThreadFormProps {
  thread: CharacterThread;
  allThreads: CharacterThread[];
  onSave: (
    characterName: string,
    backstory: string,
    relatedToThreadId?: string,
    relationshipLabel?: string
  ) => void;
  onCancel: () => void;
}

function EditThreadForm({ thread, allThreads, onSave, onCancel }: EditThreadFormProps) {
  const palette        = THREAD_PALETTE[thread.paletteIndex] ?? THREAD_PALETTE[0];
  const [name,     setName]     = useState(thread.characterName);
  const [story,    setStory]    = useState(thread.backstory);
  const [relId,    setRelId]    = useState(thread.relatedToThreadId ?? "");
  const [relLabel, setRelLabel] = useState(thread.relationshipLabel ?? "");
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  const canSave = name.trim().length > 0 && story.trim().length > 0;

  // Threads that can be related to (everyone except this one)
  const relatable = allThreads.filter((t) => t.id !== thread.id);
  const selectedThread = relatable.find((t) => t.id === relId);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    onSave(
      name.trim(),
      story.trim(),
      relId || undefined,
      relId && relLabel.trim() ? relLabel.trim() : undefined
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="mx-3 mb-3 mt-1 rounded-xl border flex flex-col gap-3 px-3 py-3"
      style={{ borderColor: `${palette.ring}40`, background: `${palette.ring}08` }}
    >
      {/* Name */}
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="w-full rounded-lg bg-gray-800 px-2.5 py-1.5 text-[12px]
                     text-gray-100 placeholder-gray-600 ring-1 ring-gray-700
                     focus:outline-none focus:ring-2 transition-all duration-150"
          style={{ "--tw-ring-color": palette.ring } as React.CSSProperties}
        />
      </div>

      {/* Backstory */}
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
          Backstory <span className="text-red-500">*</span>
        </label>
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={3}
          maxLength={300}
          className="w-full resize-none rounded-lg bg-gray-800 px-2.5 py-1.5 text-[12px]
                     text-gray-100 placeholder-gray-600 ring-1 ring-gray-700
                     focus:outline-none focus:ring-2 transition-all duration-150"
          style={{ "--tw-ring-color": palette.ring } as React.CSSProperties}
        />
        <p className="text-right text-[9px] text-gray-600">{story.length}/300</p>
      </div>

      {/* Relationship — shown only when other threads exist */}
      {relatable.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-gray-800/50 border border-gray-700 px-2.5 py-2">
          <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
            Related to <span className="text-gray-700 normal-case font-normal text-[9px]">(optional)</span>
          </label>
          {/* Thread picker chips */}
          <div className="flex flex-wrap gap-1">
            {relatable.map((t) => {
              const tp = THREAD_PALETTE[t.paletteIndex] ?? THREAD_PALETTE[0];
              const isSel = relId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setRelId(isSel ? "" : t.id); if (isSel) setRelLabel(""); }}
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold border transition-colors duration-100"
                  style={{
                    borderColor: isSel ? tp.ring : "#374151",
                    background:  isSel ? `${tp.ring}22` : "transparent",
                    color:       isSel ? tp.text : "#9ca3af",
                  }}
                >
                  {t.characterName}
                </button>
              );
            })}
          </div>

          {/* Label chips + free-text — only when a thread is picked */}
          {relId && (
            <div className="flex flex-col gap-1 mt-0.5">
              <label className="text-[9px] text-gray-600 uppercase tracking-widest">
                Relationship to {selectedThread?.characterName}
              </label>
              <div className="flex flex-wrap gap-1">
                {RELATION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setRelLabel(relLabel === chip ? "" : chip)}
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-medium border transition-colors duration-100"
                    style={{
                      borderColor: relLabel === chip ? palette.ring : "#374151",
                      background:  relLabel === chip ? `${palette.ring}22` : "transparent",
                      color:       relLabel === chip ? palette.text : "#6b7280",
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={relLabel}
                onChange={(e) => setRelLabel(e.target.value)}
                placeholder="or custom label…"
                maxLength={30}
                className="w-full rounded-lg bg-gray-800 px-2.5 py-1 text-[11px]
                           text-gray-100 placeholder-gray-600 ring-1 ring-gray-700
                           focus:outline-none focus:ring-2 transition-all duration-150"
                style={{ "--tw-ring-color": palette.ring } as React.CSSProperties}
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-gray-400
                     hover:text-gray-200 hover:bg-gray-800 border border-gray-700
                     transition-colors duration-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSave}
          className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-gray-950
                     disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-100"
          style={{ background: canSave ? palette.ring : "#6b7280" }}
        >
          Save
        </button>
      </div>
    </form>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CharacterUniverseView({
  threads,
  mainNodes,
  allThreads,
  onJumpToMainNode,
  onJumpToThreadNode,
  onEditThread,
}: CharacterUniverseViewProps) {
  // Auto-select the first thread on mount / when threads list changes.
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    threads[0]?.id ?? null
  );
  // Which character row (if any) has its edit form open.
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);

  // Keep selection valid if threads are added/removed.
  useEffect(() => {
    if (!selectedThreadId || !threads.find((t) => t.id === selectedThreadId)) {
      setSelectedThreadId(threads[0]?.id ?? null);
    }
  }, [threads, selectedThreadId]);

  // Close edit form if the thread being edited is deleted.
  useEffect(() => {
    if (editingThreadId && !threads.find((t) => t.id === editingThreadId)) {
      setEditingThreadId(null);
    }
  }, [threads, editingThreadId]);

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
            const palette      = THREAD_PALETTE[t.paletteIndex] ?? THREAD_PALETTE[0];
            const isSelected   = t.id === selectedThreadId;
            const isEditing    = t.id === editingThreadId;
            const hasWoven     = t.nodes.some((n) => n.woven);
            const appearCount  = mainNodes.filter((n) =>
              n.text.toLowerCase().includes(t.characterName.toLowerCase())
            ).length + Object.values(allThreads).reduce((sum, ot) =>
              sum + ot.nodes.filter((n) =>
                n.text.toLowerCase().includes(t.characterName.toLowerCase())
              ).length,
              0
            );

            return (
              <div key={t.id}>
                {/* ── Row button ─────────────────────────────────────────── */}
                <div
                  className="group w-full flex items-center gap-2 px-3 py-2.5 text-left
                             transition-colors duration-100 cursor-pointer"
                  style={{
                    background:  isSelected ? `${palette.ring}18` : "transparent",
                    borderLeft:  isSelected ? `3px solid ${palette.ring}` : "3px solid transparent",
                  }}
                  onClick={() => {
                    setSelectedThreadId(t.id);
                    if (isEditing) setEditingThreadId(null);
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#ffffff08";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
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

                  {/* Edit pencil — visible on hover or when editing */}
                  <button
                    title="Edit character"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedThreadId(t.id);
                      setEditingThreadId(isEditing ? null : t.id);
                    }}
                    className={`flex-shrink-0 rounded-md p-1 transition-colors duration-100
                      ${isEditing
                        ? "text-amber-400 bg-amber-400/10"
                        : "text-gray-600 hover:text-gray-300 hover:bg-gray-800 opacity-0 group-hover:opacity-100"
                      }`}
                    aria-label={`Edit ${t.characterName}`}
                  >
                    {/* Pencil icon */}
                    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor"
                            strokeWidth="1.4" strokeLinejoin="round"/>
                      <path d="M8 4l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>

                {/* ── Inline edit form (expands below the row) ─────────────── */}
                {isEditing && (
                  <EditThreadForm
                    thread={t}
                    allThreads={threads}
                    onSave={(name, backstory, relatedToThreadId, relationshipLabel) => {
                      onEditThread(t.id, name, backstory, relatedToThreadId, relationshipLabel);
                      setEditingThreadId(null);
                    }}
                    onCancel={() => setEditingThreadId(null)}
                  />
                )}
              </div>
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
