"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { StoryNode } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StoryNodeData = StoryNode & {
  isOnActivePath: boolean;
  /** True only on the most recently-committed node; drives enter animation. */
  isNewest?: boolean;
  onNodeClick: (id: string) => void;
  onGenerateBranches: (id: string) => void;
  onImageStatusChange: (nodeId: string, status: StoryNode["imageStatus"], retriesLeft?: number) => void;
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

// ─── Auto-retry image loader ──────────────────────────────────────────────────

const RETRY_DELAYS = [4, 8, 15]; // seconds between successive retries

interface RetryImageProps {
  src: string;
  retriesLeft: number;
  onSuccess: () => void;
  onExhausted: () => void;
  onRetry: (newRetriesLeft: number) => void;
}

/** Invisible element that handles loading + auto-retry with countdown. */
function RetryImage({ src, retriesLeft, onSuccess, onExhausted, onRetry }: RetryImageProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [src]);

  const handleError = useCallback(() => {
    if (retriesLeft <= 0) { onExhausted(); return; }
    const delaySecs = RETRY_DELAYS[RETRY_DELAYS.length - retriesLeft] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
    let remaining = delaySecs;
    setCountdown(remaining);
    timerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        setCountdown(null);
        onRetry(retriesLeft - 1);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, [retriesLeft, onSuccess, onExhausted, onRetry]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={`${src}-${retriesLeft}`}
        src={src} alt="" className="hidden"
        onLoad={onSuccess} onError={handleError}
      />
      {countdown !== null && (
        <div className="w-full aspect-square rounded-lg bg-gray-800 flex flex-col items-center justify-center gap-1">
          <span className="text-[10px] text-gray-500">Retrying in {countdown}s…</span>
        </div>
      )}
    </>
  );
}

// ─── Visible image area ───────────────────────────────────────────────────────

interface ImageAreaProps {
  node: StoryNode;
  onSuccess: () => void;
  onExhausted: () => void;
  onRetry: (newRetriesLeft: number) => void;
}

function ImageArea({ node, onSuccess, onExhausted, onRetry }: ImageAreaProps) {
  const { imageUrl, imageStatus, imageRetries } = node;
  if (!imageUrl) return null;

  if (imageStatus === "loading") {
    return (
      <>
        <RetryImage src={imageUrl} retriesLeft={imageRetries}
          onSuccess={onSuccess} onExhausted={onExhausted} onRetry={onRetry} />
        {/* Quill loading indicator replaces generic skeleton pulse */}
        <div className="w-full aspect-square rounded-lg bg-gray-800 flex flex-col items-center justify-center gap-2">
          <QuillLoader />
        </div>
      </>
    );
  }

  if (imageStatus === "ready") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt=""
        className="w-full aspect-square rounded-lg object-cover animate-card-appear" />
    );
  }

  if (imageStatus === "error") {
    return (
      <div className="w-full aspect-square rounded-lg bg-gray-800/50 flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-gray-700" aria-hidden="true">
          <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10 6v5M10 13.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    );
  }

  return null;
}

// ─── Quill loader — reusable across image + branch generation states ──────────

export function QuillLoader({ size = 28 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-1" aria-label="Loading">
      {/* Quill SVG — bobs via CSS animation */}
      <svg
        width={size} height={size}
        viewBox="0 0 24 24" fill="none"
        className="animate-quill-bob text-amber-400"
        aria-hidden="true"
      >
        {/* Feather shaft */}
        <path d="M20 4C16 2 8 6 4 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        {/* Feather vane lines */}
        <path d="M20 4L8 16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
        <path d="M17 7L9 15" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.35"/>
        {/* Nib */}
        <path d="M4 20l2-3 1 2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
      {/* Ink drip dot */}
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
    id, text, tone, why, parentId,
    isOnActivePath, isNewest, onNodeClick, onGenerateBranches, onImageStatusChange,
  } = d;
  const node = d as StoryNode;

  const handleBodyClick  = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onNodeClick(id); },        [id, onNodeClick]);
  const handleGenerate   = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onGenerateBranches(id); }, [id, onGenerateBranches]);
  const handleSuccess    = useCallback(() => onImageStatusChange(id, "ready"),                                     [id, onImageStatusChange]);
  const handleExhausted  = useCallback(() => onImageStatusChange(id, "error"),                                     [id, onImageStatusChange]);
  const handleRetry      = useCallback((n: number) => onImageStatusChange(id, "loading", n),                      [id, onImageStatusChange]);

  const ringClass = isOnActivePath
    ? "ring-2 ring-amber-400 shadow-amber-400/20 shadow-lg"
    : "ring-1 ring-gray-700 hover:ring-gray-500";

  return (
    <>
      {parentId !== null && (
        <Handle type="target" position={Position.Top} className="!bg-gray-600 !w-2 !h-2 !border-0" />
      )}

      <div
        onClick={handleBodyClick}
        className={`
          relative flex flex-col gap-2 w-56 rounded-xl bg-gray-900 p-3
          cursor-pointer transition-colors duration-150
          ${ringClass}
          ${isNewest ? "animate-node-enter" : ""}
        `}
      >
        <ImageArea node={node} onSuccess={handleSuccess} onExhausted={handleExhausted} onRetry={handleRetry} />

        <span className={`self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneBadgeClass(tone)}`}>
          {tone}
        </span>

        <p className="text-[13px] leading-relaxed text-gray-100 line-clamp-5">{text}</p>

        {why && (
          <p className="text-[11px] text-gray-400 italic border-t border-gray-700 pt-2">
            <span className="not-italic font-semibold text-gray-500">Why: </span>{why}
          </p>
        )}

        <button
          onClick={handleGenerate}
          className="mt-1 self-end rounded-md bg-gray-800 px-2 py-1 text-[11px] font-medium text-amber-400 hover:bg-gray-700 hover:text-amber-300 transition-colors duration-100 border border-gray-700 btn-interactive"
        >
          ＋ New directions
        </button>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-600 !w-2 !h-2 !border-0" />
    </>
  );
}

export const StoryNodeCard = memo(StoryNodeCardInner);
export default StoryNodeCard;
