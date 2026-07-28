"use client";

import { useCallback } from "react";
import type { StoryNode } from "@/lib/types";
import { pathToText } from "@/lib/treeUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PathDrawerProps {
  isOpen: boolean;
  /** Ordered root-to-selected-node list of committed StoryNodes. */
  activePath: StoryNode[];
  onClose: () => void;
}

// ─── Tone → panel border accent (hex, used inline so no Tailwind safelist needed) ──

const TONE_BORDER: Record<string, string> = {
  Opening:    "#0c4a6e", // sky-900
  Tense:      "#7f1d1d", // red-900
  Revelatory: "#4c1d95", // violet-900
  Melancholy: "#1e3a5f", // blue-900-ish
  Hopeful:    "#14532d", // green-900
  Mysterious: "#1e1b4b", // indigo-950
  Humorous:   "#78350f", // amber-900
  Dark:       "#1f2937", // gray-800
};

function toneBorderColor(tone: string): string {
  return TONE_BORDER[tone] ?? "#374151";
}

// ─── Comic panel ─────────────────────────────────────────────────────────────

interface ComicPanelProps {
  node: StoryNode;
  index: number;
}

function ComicPanel({ node, index }: ComicPanelProps) {
  const showImage    = node.imageStatus === "ready" && node.imageUrl;
  const showSkeleton = node.imageStatus === "loading";
  const borderColor  = toneBorderColor(node.tone);
  // Make the tone label readable against the black caption area.
  const labelColor   = borderColor === "#1f2937" ? "#9ca3af" : borderColor;

  return (
    <div
      style={{ borderColor, borderWidth: 4, borderStyle: "solid" }}
      className="flex flex-col overflow-hidden bg-white"
    >
      {/* Panel image */}
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={node.imageUrl}
          alt=""
          className="w-full aspect-[4/3] object-cover block"
        />
      ) : showSkeleton ? (
        <div className="w-full aspect-[4/3] bg-gray-200 animate-pulse
                        flex items-center justify-center">
          <span className="text-[10px] text-gray-400 font-sans">Illustrating…</span>
        </div>
      ) : (
        /* Root / idle / error — thin ruled placeholder */
        <div className="w-full h-3 bg-gray-100" />
      )}

      {/* Caption gutter — black bg, printed-comic style */}
      <div className="bg-black px-3 py-2 flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-white/40 tabular-nums tracking-wider font-sans">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span
            className="text-[9px] font-bold uppercase tracking-widest font-sans"
            style={{ color: labelColor }}
          >
            {node.tone}
          </span>
        </div>
        <p className="text-[12px] leading-snug text-white font-serif">
          {node.text}
        </p>
      </div>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export default function PathDrawer({ isOpen, activePath, onClose }: PathDrawerProps) {
  const pathText = pathToText(activePath);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pathText);
    } catch {
      // Clipboard API unavailable — silently ignore.
    }
  }, [pathText]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-label="Read this path"
        aria-modal="true"
        className={`
          fixed top-0 right-0 z-30 h-full w-full max-w-md
          bg-black border-l-4 border-black
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header — keeps app dark-theme style */}
        <div className="flex-shrink-0 flex items-center justify-between
                        bg-gray-950 border-b-4 border-black px-5 py-4">
          <h2 className="text-sm font-bold text-white tracking-widest uppercase font-sans">
            Story path
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={activePath.length === 0}
              className="rounded px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide
                         text-amber-400 hover:text-amber-300 bg-gray-900 border border-gray-700
                         disabled:opacity-30 transition-colors duration-100 font-sans"
            >
              Copy text
            </button>
            <button
              onClick={onClose}
              aria-label="Close drawer"
              className="rounded p-1.5 text-gray-400 hover:text-white hover:bg-gray-800
                         transition-colors duration-100"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body — vertical comic strip on white/black printed-comic background */}
        <div className="flex-1 overflow-y-auto bg-white">
          {activePath.length > 0 ? (
            /* 4 px black gutters between panels */
            <div className="flex flex-col gap-1 p-1 bg-black">
              {activePath.map((node, i) => (
                <ComicPanel key={node.id} node={node} index={i} />
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <p className="text-[13px] text-gray-400 italic font-serif text-center">
                Select a node to read the story path from root to that point.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
