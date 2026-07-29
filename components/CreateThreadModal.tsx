"use client";

import { useState, useRef, useEffect } from "react";
import { THREAD_PALETTE, MAX_THREADS } from "@/lib/threadPalette";
import type { CharacterThread } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateThreadModalProps {
  /** The index that will be assigned (= current thread count). Used for colour preview. */
  paletteIndex: number;
  /** Existing threads available to relate to (excludes the one being created). */
  existingThreads: CharacterThread[];
  onConfirm: (
    characterName: string,
    backstory: string,
    relatedToThreadId?: string,
    relationshipLabel?: string
  ) => void;
  onCancel: () => void;
}

// ─── Suggested relationship labels ───────────────────────────────────────────

const RELATION_CHIPS = ["sibling", "rival", "mentor", "ally", "lover", "enemy", "parent", "friend"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateThreadModal({
  paletteIndex,
  existingThreads,
  onConfirm,
  onCancel,
}: CreateThreadModalProps) {
  const [characterName, setCharacterName]       = useState("");
  const [backstory, setBackstory]               = useState("");
  const [relatedToThreadId, setRelatedToThreadId] = useState("");
  const [relationshipLabel, setRelationshipLabel] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const palette = THREAD_PALETTE[paletteIndex % MAX_THREADS];

  useEffect(() => { nameRef.current?.focus(); }, []);

  const canSubmit = characterName.trim().length > 0 && backstory.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm(
      characterName.trim(),
      backstory.trim(),
      relatedToThreadId || undefined,
      relatedToThreadId && relationshipLabel.trim() ? relationshipLabel.trim() : undefined
    );
  }

  const selectedThread = existingThreads.find((t) => t.id === relatedToThreadId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      aria-modal="true"
      role="dialog"
      aria-label="Create character thread"
    >
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-gray-900 shadow-2xl
                      border border-gray-700 overflow-hidden">

        {/* Colour bar */}
        <div className="h-1.5 w-full" style={{ background: palette.ring }} />

        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-bold text-gray-100 tracking-tight">
              Branch a character&apos;s story
            </h2>
            <p className="text-[12px] text-gray-500">
              Their side story will run parallel to the main narrative in{" "}
              <span className="font-semibold" style={{ color: palette.text }}>
                {palette.label}
              </span>
              .
            </p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-500 hover:text-gray-200
                       hover:bg-gray-800 transition-colors duration-100"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-4">

          {/* Character name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Character name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="e.g. Mara, the innkeeper, the old cartographer…"
              maxLength={60}
              className="w-full rounded-lg bg-gray-800 px-3 py-2 text-[13px]
                         text-gray-100 placeholder-gray-600 ring-1 ring-gray-700
                         focus:outline-none focus:ring-2 transition-all duration-150"
              style={{ "--tw-ring-color": palette.ring } as React.CSSProperties}
            />
          </div>

          {/* Backstory */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Backstory / context <span className="text-red-500">*</span>
            </label>
            <textarea
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              placeholder="Who are they? What do they want? What secret are they hiding?"
              rows={3}
              maxLength={300}
              className="w-full resize-none rounded-lg bg-gray-800 px-3 py-2 text-[13px]
                         text-gray-100 placeholder-gray-600 ring-1 ring-gray-700
                         focus:outline-none focus:ring-2 transition-all duration-150"
              style={{ "--tw-ring-color": palette.ring } as React.CSSProperties}
            />
            <p className="text-right text-[10px] text-gray-600">{backstory.length}/300</p>
          </div>

          {/* ── Optional: Related to ─────────────────────────────────────── */}
          {existingThreads.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg bg-gray-800/50 border border-gray-700 px-3 py-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Related to <span className="text-gray-700 normal-case font-normal">(optional)</span>
              </label>

              {/* Thread picker */}
              <div className="flex flex-wrap gap-1.5">
                {existingThreads.map((t) => {
                  const tp = THREAD_PALETTE[t.paletteIndex] ?? THREAD_PALETTE[0];
                  const isSelected = relatedToThreadId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setRelatedToThreadId(isSelected ? "" : t.id)}
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold
                                 border transition-colors duration-100"
                      style={{
                        borderColor: isSelected ? tp.ring : "#374151",
                        background: isSelected ? `${tp.ring}22` : "transparent",
                        color: isSelected ? tp.text : "#9ca3af",
                      }}
                    >
                      {t.characterName}
                    </button>
                  );
                })}
              </div>

              {/* Relationship label — shown only when a thread is selected */}
              {relatedToThreadId && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="text-[10px] text-gray-600 uppercase tracking-widest">
                    Relationship to {selectedThread?.characterName}
                  </label>
                  {/* Chip suggestions */}
                  <div className="flex flex-wrap gap-1.5">
                    {RELATION_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setRelationshipLabel(relationshipLabel === chip ? "" : chip)}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium border
                                   transition-colors duration-100"
                        style={{
                          borderColor: relationshipLabel === chip ? palette.ring : "#374151",
                          background: relationshipLabel === chip ? `${palette.ring}22` : "transparent",
                          color: relationshipLabel === chip ? palette.text : "#6b7280",
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  {/* Free-text override */}
                  <input
                    type="text"
                    value={relationshipLabel}
                    onChange={(e) => setRelationshipLabel(e.target.value)}
                    placeholder="or type a custom label…"
                    maxLength={30}
                    className="w-full rounded-lg bg-gray-800 px-3 py-1.5 text-[12px]
                               text-gray-100 placeholder-gray-600 ring-1 ring-gray-700
                               focus:outline-none focus:ring-2 transition-all duration-150"
                    style={{ "--tw-ring-color": palette.ring } as React.CSSProperties}
                  />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-[12px] font-medium text-gray-400
                         hover:text-gray-200 hover:bg-gray-800 border border-gray-700
                         transition-colors duration-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg px-4 py-2 text-[12px] font-semibold text-gray-950
                         disabled:opacity-30 disabled:cursor-not-allowed
                         transition-colors duration-100"
              style={{ background: canSubmit ? palette.ring : "#6b7280" }}
            >
              Create thread
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
