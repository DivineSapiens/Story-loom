"use client";

import type { BranchOption } from "@/lib/types";
import { QuillLoader } from "./StoryNodeCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchPanelProps {
  options: BranchOption[] | null;
  isLoading: boolean;
  /** Set when the last generation call failed. Shown in place of branch cards. */
  error: string | null;
  onSelect: (option: BranchOption) => void;
  /** Called when the user clicks "Try again" in the error state. */
  onRetry: () => void;
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

// ─── Loading skeleton (quill animation instead of pulse bars) ─────────────────

function LoadingCard({ index }: { index: number }) {
  return (
    <div
      className="animate-card-appear flex flex-col gap-3 rounded-xl bg-gray-900 p-4 ring-1 ring-gray-700 min-w-0 flex-1
                 items-center justify-center"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Quill loader — same component used in image loading */}
      <div className="py-6 flex flex-col items-center gap-3">
        <QuillLoader size={32} />
        <span className="text-[10px] text-gray-600 uppercase tracking-widest">
          {index === 0 ? "Crafting…" : index === 1 ? "Weaving…" : "Imagining…"}
        </span>
      </div>
      {/* Shimmer lines below */}
      <div className="w-full flex flex-col gap-2 mt-2">
        <div className="h-3 w-5/6 rounded bg-gray-800 animate-pulse" />
        <div className="h-3 w-4/6 rounded bg-gray-800 animate-pulse" />
        <div className="h-3 w-3/6 rounded bg-gray-800 animate-pulse" />
      </div>
      <div className="mt-auto w-full border-t border-gray-800 pt-3">
        <div className="h-3 w-3/4 rounded bg-gray-800 animate-pulse" />
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
  return (
    <button
      onClick={() => onSelect(option)}
      // animate-card-appear + stagger via animationDelay
      // branch-card class provides hover lift + press-down (globals.css)
      // Tailwind classes handle ring/bg color transitions separately
      className="
        branch-card animate-card-appear
        group flex flex-col gap-3 rounded-xl bg-gray-900 p-4 text-left
        ring-1 ring-gray-700 hover:ring-amber-500 hover:bg-gray-800
        cursor-pointer min-w-0 flex-1
        focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
      "
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Preview image */}
      {option.previewImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={option.previewImageUrl}
          alt=""
          className="w-full aspect-square rounded-lg object-cover animate-card-appear"
          loading="eager"
          style={{ animationDelay: `${index * 80 + 60}ms` }}
        />
      )}

      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneBadgeClass(option.tone)}`}>
          {option.tone}
        </span>
        <span className="text-[10px] text-gray-500 group-hover:text-amber-500 transition-colors duration-150">
          Click to commit →
        </span>
      </div>

      <p className="text-[13px] leading-relaxed text-gray-100">{option.text}</p>

      <p className="mt-auto border-t border-gray-700 pt-3 text-[11px] text-gray-400 italic">
        <span className="not-italic font-semibold text-gray-500">Why: </span>
        {option.why}
      </p>
    </button>
  );
}

// ─── Error card ───────────────────────────────────────────────────────────────

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="animate-card-appear flex-1 flex flex-col gap-3 rounded-xl bg-gray-900
                    p-4 ring-1 ring-red-800 min-w-0 items-start justify-between">
      {/* Icon + heading */}
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"
             className="flex-shrink-0 text-red-400">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 4.5v4M8 10.5v1" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round"/>
        </svg>
        <span className="text-[12px] font-semibold text-red-400">
          Couldn&apos;t generate branches
        </span>
      </div>

      {/* Detail message — verbatim from the server so auth errors are visible */}
      <p className="text-[11px] leading-relaxed text-gray-400 font-mono break-all">
        {message}
      </p>

      <button
        onClick={onRetry}
        className="mt-auto self-start rounded-md bg-gray-800 px-3 py-1.5 text-[11px]
                   font-medium text-amber-400 hover:bg-gray-700 hover:text-amber-300
                   border border-gray-700 transition-colors duration-100"
      >
        Try again
      </button>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function BranchPanel({ options, isLoading, error, onSelect, onRetry }: BranchPanelProps) {
  if (!isLoading && !options && !error) return null;

  return (
    <div className="flex-shrink-0 border-t border-gray-800 bg-gray-950">
      <div className="px-4 pt-3 pb-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          {isLoading ? "Generating directions…" : error ? "Generation failed" : "Choose a direction"}
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-4 pt-1">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <LoadingCard key={i} index={i} />)
          : error
            ? <ErrorCard message={error} onRetry={onRetry} />
            : options!.map((opt, i) => (
                <BranchCard key={opt.id} option={opt} index={i} onSelect={onSelect} />
              ))}
      </div>
    </div>
  );
}
