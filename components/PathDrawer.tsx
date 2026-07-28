"use client";

import { useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PathDrawerProps {
  isOpen: boolean;
  pathText: string;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PathDrawer({ isOpen, pathText, onClose }: PathDrawerProps) {
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pathText);
    } catch {
      // Clipboard API unavailable — silently ignore.
    }
  }, [pathText]);

  return (
    <>
      {/* Backdrop — only rendered when open, closes drawer on click */}
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
          bg-gray-900 border-l border-gray-700
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-100 tracking-wide">
            Story path
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="rounded-md bg-gray-800 px-3 py-1.5 text-[11px] font-medium text-amber-400
                         hover:bg-gray-700 hover:text-amber-300 border border-gray-700
                         transition-colors duration-100"
            >
              Copy
            </button>
            <button
              onClick={onClose}
              aria-label="Close drawer"
              className="rounded-md p-1.5 text-gray-400 hover:text-gray-100 hover:bg-gray-800
                         transition-colors duration-100"
            >
              {/* ✕ */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body — scrollable story text */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {pathText ? (
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-gray-200 font-serif">
              {pathText}
            </p>
          ) : (
            <p className="text-[13px] text-gray-500 italic">
              Select a node to see the story path from root to that point.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

