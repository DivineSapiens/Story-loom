"use client";

import type { BranchOption } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchPanelProps {
  options: BranchOption[] | null;
  isLoading: boolean;
  onSelect: (option: BranchOption) => void;
}

// ─── Tone badge colours (mirrors StoryNodeCard palette) ──────────────────────

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

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-gray-900 p-4 ring-1 ring-gray-700 min-w-0 flex-1">
      {/* Tone badge placeholder */}
      <div className="h-4 w-16 rounded-full bg-gray-700 animate-pulse" />
      {/* Text lines */}
      <div className="flex flex-col gap-2">
        <div className="h-3 w-full rounded bg-gray-700 animate-pulse" />
        <div className="h-3 w-5/6 rounded bg-gray-700 animate-pulse" />
        <div className="h-3 w-4/6 rounded bg-gray-700 animate-pulse" />
      </div>
      {/* Why line */}
      <div className="mt-auto border-t border-gray-700 pt-3">
        <div className="h-3 w-3/4 rounded bg-gray-700 animate-pulse" />
      </div>
    </div>
  );
}

// ─── Branch card ─────────────────────────────────────────────────────────────

interface BranchCardProps {
  option: BranchOption;
  onSelect: (option: BranchOption) => void;
}

function BranchCard({ option, onSelect }: BranchCardProps) {
  return (
    <button
      onClick={() => onSelect(option)}
      className="
        group flex flex-col gap-3 rounded-xl bg-gray-900 p-4 text-left
        ring-1 ring-gray-700 hover:ring-amber-500 hover:bg-gray-800
        transition-all duration-150 cursor-pointer min-w-0 flex-1
        focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
      "
    >
      {/* Header row: tone badge + hint */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneBadgeClass(option.tone)}`}
        >
          {option.tone}
        </span>
        <span className="text-[10px] text-gray-500 group-hover:text-amber-500 transition-colors duration-150">
          Click to commit →
        </span>
      </div>

      {/* Continuation text */}
      <p className="text-[13px] leading-relaxed text-gray-100">
        {option.text}
      </p>

      {/* Why rationale */}
      <p className="mt-auto border-t border-gray-700 pt-3 text-[11px] text-gray-400 italic">
        <span className="not-italic font-semibold text-gray-500">Why: </span>
        {option.why}
      </p>
    </button>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function BranchPanel({ options, isLoading, onSelect }: BranchPanelProps) {
  // Nothing to show — hide entirely so the tree canvas gets full height.
  if (!isLoading && !options) return null;

  return (
    <div className="flex-shrink-0 border-t border-gray-800 bg-gray-950">
      {/* Label row */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          {isLoading ? "Generating directions…" : "Choose a direction"}
        </p>
      </div>

      {/* Cards row */}
      <div className="flex gap-3 overflow-x-auto px-4 pb-4 pt-1">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          : options!.map((opt) => (
              <BranchCard key={opt.id} option={opt} onSelect={onSelect} />
            ))}
      </div>
    </div>
  );
}
