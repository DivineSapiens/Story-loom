"use client";

import { useState } from "react";
import type { BranchOption } from "@/lib/types";
import { QuillLoader } from "./StoryNodeCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchPanelProps {
  options: BranchOption[] | null;
  isLoading: boolean;
  /** Set when the last generation call failed. Shown in place of branch cards. */
  error: string | null;
  wrapUpRequested: boolean;
  onSelect: (option: BranchOption) => void;
  onAddUserText: (text: string) => void;
  onToggleWrapUp: () => void;
  /** Called when "Try again" or the ↺ refresh button is clicked. */
  onRetry: () => void;
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

// ─── Loading skeleton ─────────────────────────────────────────────────────────

const LOADING_LABELS = ["Crafting…", "Weaving…", "Imagining…", "Conjuring…"];

function LoadingCard({ index }: { index: number }) {
  return (
    <div
      className="animate-card-appear flex flex-col gap-3 rounded-xl bg-gray-900 p-4
                 ring-1 ring-gray-700 items-center justify-center min-h-[120px]"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="py-3 flex flex-col items-center gap-3">
        <QuillLoader size={28} />
        <span className="text-[10px] text-gray-600 uppercase tracking-widest">
          {LOADING_LABELS[index] ?? "Thinking…"}
        </span>
      </div>
      <div className="w-full flex flex-col gap-2">
        <div className="h-2.5 w-5/6 rounded bg-gray-800 animate-pulse" />
        <div className="h-2.5 w-4/6 rounded bg-gray-800 animate-pulse" />
        <div className="h-2.5 w-3/6 rounded bg-gray-800 animate-pulse" />
      </div>
    </div>
  );
}

// ─── Branch card ─────────────────────────────────────────────────────────────

interface BranchCardProps {
  option: BranchOption;
  index: number;
  onSelect: (option: BranchOption) => void;
}

function BranchCard({ option, index, onSelect }: BranchCardProps) {
  const isEnding = Boolean(option.isEnding);
  return (
    <button
      onClick={() => onSelect(option)}
      className={`
        branch-card animate-card-appear
        group flex flex-col gap-2 rounded-xl p-4 text-left
        cursor-pointer focus:outline-none transition-all duration-150
        ${isEnding
          ? "bg-gray-900 ring-2 ring-amber-500/60 hover:ring-amber-400 hover:bg-gray-800 col-span-2"
          : "bg-gray-900 ring-1 ring-gray-700 hover:ring-amber-500 hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-amber-400"
        }
      `}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        {isEnding ? (
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400/90
                           bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
            ✦ The End — Final Conclusion
          </span>
        ) : (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneBadgeClass(option.tone)}`}>
            {option.tone}
          </span>
        )}
        <span className={`text-[10px] transition-colors duration-150 ${isEnding ? "text-amber-400/70 group-hover:text-amber-300" : "text-gray-500 group-hover:text-amber-500"}`}>
          {isEnding ? "conclude story →" : "commit →"}
        </span>
      </div>

      <p className="text-[12px] leading-relaxed text-gray-100">{option.text}</p>

      <p className="mt-auto border-t border-gray-700 pt-2 text-[11px] text-gray-400 italic">
        <span className="not-italic font-semibold text-gray-500">Why: </span>
        {option.why}
      </p>
    </button>
  );
}

// ─── Error card ───────────────────────────────────────────────────────────────

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="col-span-2 animate-card-appear flex flex-col gap-3 rounded-xl bg-gray-900
                    p-4 ring-1 ring-red-800 items-start">
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"
             className="flex-shrink-0 text-red-400">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 4.5v4M8 10.5v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="text-[12px] font-semibold text-red-400">Couldn&apos;t generate branches</span>
      </div>
      <p className="text-[11px] leading-relaxed text-gray-400 font-mono break-all">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-md bg-gray-800 px-3 py-1.5 text-[11px] font-medium text-amber-400
                   hover:bg-gray-700 hover:text-amber-300 border border-gray-700
                   transition-colors duration-100"
      >
        Try again
      </button>
    </div>
  );
}

// ─── User-continuation input ──────────────────────────────────────────────────

interface UserInputRowProps {
  onAddUserText: (text: string) => void;
  onSkip: () => void;
}

function UserInputRow({ onAddUserText, onSkip }: UserInputRowProps) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-end gap-2 px-4 pt-3 pb-2 border-t border-gray-800">
      <div className="flex-1 flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          Continue in your own words <span className="text-gray-700 normal-case font-normal">(optional)</span>
        </label>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && value.trim()) {
              onAddUserText(value.trim());
            }
          }}
          placeholder="Add your own sentence or two before the AI continues…"
          rows={2}
          className="w-full resize-none rounded-lg bg-gray-900 px-3 py-2 text-[12px]
                     text-gray-100 placeholder-gray-600 ring-1 ring-gray-700
                     focus:outline-none focus:ring-teal-500 transition-all duration-150"
        />
      </div>
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button
          onClick={() => { if (value.trim()) onAddUserText(value.trim()); }}
          disabled={!value.trim()}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-[11px] font-semibold text-white
                     hover:bg-teal-600 disabled:opacity-30 disabled:cursor-not-allowed
                     transition-colors duration-100"
        >
          Add &amp; continue
        </button>
        <button
          onClick={onSkip}
          className="rounded-lg bg-gray-800 px-3 py-1.5 text-[11px] font-medium text-gray-300
                     hover:bg-gray-700 border border-gray-700 transition-colors duration-100"
        >
          Skip, let AI continue
        </button>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function BranchPanel({
  options, isLoading, error, wrapUpRequested,
  onSelect, onAddUserText, onToggleWrapUp, onRetry,
}: BranchPanelProps) {
  /**
   * Controls whether the "Continue in your own words" row is visible.
   * - Starts true whenever a fresh set of options arrives (options identity changes).
   * - Set to false when the user clicks "Skip, let AI continue".
   * - Also collapses when loading starts or error occurs (no options = nothing to show).
   *
   * We derive a stable "options key" from the first option's id so that a new
   * batch of options always resets this back to true without needing useEffect.
   */
  const optionsKey = options?.[0]?.id ?? null;
  const [inputVisibleForKey, setInputVisibleForKey] = useState<string | null>(null);

  // When a new batch of options arrives, mark that batch's key as "input visible".
  // This runs during render (safe — it's just setting derived state) so it's
  // immediately reflected in the same render cycle without a flash.
  if (optionsKey !== null && inputVisibleForKey !== optionsKey) {
    setInputVisibleForKey(optionsKey);
  }

  const showInput = !isLoading && !error && options && options.length > 0
    && inputVisibleForKey === optionsKey;

  if (!isLoading && !options && !error) return null;

  const heading = isLoading
    ? "Generating directions…"
    : error
      ? "Generation failed"
      : "Choose a direction";

  return (
    <div className="flex-shrink-0 border-t border-gray-800 bg-gray-950">

      {/* ── Top bar: heading + refresh + wrap-up toggle ───────────────── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 flex-shrink-0">
            {heading}
          </p>

          {/* ↺ Refresh — shown whenever options are ready (re-roll all four suggestions) */}
          {!isLoading && !error && options && (
            <button
              onClick={onRetry}
              title="Get new suggestions"
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold
                         uppercase tracking-wide border border-gray-700 text-gray-500
                         hover:border-amber-500 hover:text-amber-400 transition-colors duration-100
                         flex-shrink-0"
            >
              {/* Circular-arrow refresh icon */}
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M10 6A4 4 0 1 1 6 2" stroke="currentColor" strokeWidth="1.4"
                      strokeLinecap="round"/>
                <path d="M6 0l2 2-2 2" stroke="currentColor" strokeWidth="1.4"
                      strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Refresh
            </button>
          )}
        </div>

        {/* Wrap-up toggle — only shown when options are ready */}
        {!isLoading && !error && options && (
          <button
            onClick={onToggleWrapUp}
            title={wrapUpRequested ? "Wrapping up — click to resume" : "Ask AI to start wrapping up the story"}
            className={`
              flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold
              uppercase tracking-wide border transition-colors duration-100 flex-shrink-0
              ${wrapUpRequested
                ? "bg-amber-500/20 border-amber-500 text-amber-400"
                : "bg-transparent border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
              }
            `}
          >
            {/* Ribbon/bow icon */}
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 6C4 4 1 3 1 1.5a1.5 1.5 0 013 0C4 3 5 5 6 6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M6 6C8 4 11 3 11 1.5a1.5 1.5 0 00-3 0C8 3 7 5 6 6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M6 6C4 8 1 9 1 10.5a1.5 1.5 0 003 0C4 9 5 7 6 6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M6 6C8 8 11 9 11 10.5a1.5 1.5 0 01-3 0C8 9 7 7 6 6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            {wrapUpRequested ? "Wrapping up" : "Wrap up story"}
          </button>
        )}
      </div>

      {/* ── User-continuation row ────────────────────────────────────── */}
      {showInput && (
        <UserInputRow
          onAddUserText={(text) => { onAddUserText(text); }}
          onSkip={() => setInputVisibleForKey(null)}
        />
      )}

      {/* ── 2×2 branch cards grid ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-4 pt-2">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <LoadingCard key={i} index={i} />)
          : error
            ? <ErrorCard message={error} onRetry={onRetry} />
            : options!.map((opt, i) => (
                <BranchCard key={opt.id} option={opt} index={i} onSelect={onSelect} />
              ))}
      </div>
    </div>
  );
}
