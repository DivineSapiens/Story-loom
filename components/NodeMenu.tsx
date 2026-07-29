"use client";

/**
 * NodeMenu — a ⋯ overflow button that reveals three node-management actions.
 *
 * Rendered inside both StoryNodeCard and ThreadNodeCard.
 * All three actions (Edit / Insert / Prune) are wired via callback props so
 * the cards themselves stay stateless with respect to these operations.
 *
 * Inline edit and insert forms live inside this component, so no additional
 * modal/overlay is needed — the menu expands in place.
 *
 * IMPORTANT: every interactive element carries className="nopan" so React Flow
 * passes pointer events through instead of initiating a canvas pan.
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NodeMenuCallbacks {
  /** Called when the user confirms deletion of this node + all descendants. */
  onPrune: () => void;
  /** Called when the user saves an edited text. */
  onEdit: (newText: string) => void;
  /** Called when the user submits text for a new node to be inserted below this one. */
  onInsert: (text: string) => void;
}

interface NodeMenuProps extends NodeMenuCallbacks {
  currentText: string;
  /** True for the tree root — prune is disabled on the root (would wipe everything). */
  isRoot: boolean;
  /** Accent colour for the trigger button (matches tone / palette). */
  accentColor?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NodeMenu({
  currentText,
  isRoot,
  accentColor = "#6b7280",
  onPrune,
  onEdit,
  onInsert,
}: NodeMenuProps) {
  type Mode = "closed" | "menu" | "edit" | "insert" | "confirmPrune";
  const [mode, setMode] = useState<Mode>("closed");
  const [editText,   setEditText]   = useState(currentText);
  const [insertText, setInsertText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync editText if the parent updates currentText (e.g. after a save).
  useEffect(() => { setEditText(currentText); }, [currentText]);

  // Close on outside click.
  useEffect(() => {
    if (mode === "closed") return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMode("closed");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [mode]);

  const close = useCallback(() => setMode("closed"), []);

  const handlePruneConfirm = useCallback(() => {
    close();
    onPrune();
  }, [close, onPrune]);

  const handleEditSave = useCallback(() => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    close();
    onEdit(trimmed);
  }, [editText, close, onEdit]);

  const handleInsertSave = useCallback(() => {
    const trimmed = insertText.trim();
    if (!trimmed) return;
    setInsertText("");
    close();
    onInsert(trimmed);
  }, [insertText, close, onInsert]);

  return (
    <div ref={containerRef} className="relative" style={{ pointerEvents: "all" }}>

      {/* ── Trigger ─────────────────────────────────────────────────────────── */}
      <button
        onClick={(e) => { e.stopPropagation(); setMode((m) => m === "closed" ? "menu" : "closed"); }}
        className="nopan rounded p-0.5 transition-colors duration-100 leading-none"
        style={{ color: `${accentColor}80` }}
        onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
        onMouseLeave={(e) => (e.currentTarget.style.color = `${accentColor}80`)}
        title="Node options"
        aria-label="Node options"
      >
        {/* Three-dot icon */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="3"  cy="8" r="1.4"/>
          <circle cx="8"  cy="8" r="1.4"/>
          <circle cx="13" cy="8" r="1.4"/>
        </svg>
      </button>

      {/* ── Dropdown shell ──────────────────────────────────────────────────── */}
      {mode !== "closed" && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="nopan absolute right-0 top-6 z-50 min-w-[180px] rounded-xl
                     bg-gray-900 border border-gray-700 shadow-xl shadow-black/60
                     flex flex-col overflow-hidden"
          style={{ pointerEvents: "all" }}
        >

          {/* ── Main menu ───────────────────────────────────────────────────── */}
          {mode === "menu" && (
            <div className="flex flex-col py-1">
              <button
                onClick={() => setMode("edit")}
                className="nopan flex items-center gap-2 px-3 py-2 text-[12px]
                           text-gray-300 hover:bg-gray-800 hover:text-white
                           transition-colors duration-100 text-left"
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M9.5 1.5l3 3L4 13H1v-3L9.5 1.5z" stroke="currentColor"
                        strokeWidth="1.4" strokeLinejoin="round"/>
                </svg>
                Edit text
              </button>

              <button
                onClick={() => setMode("insert")}
                className="nopan flex items-center gap-2 px-3 py-2 text-[12px]
                           text-gray-300 hover:bg-gray-800 hover:text-white
                           transition-colors duration-100 text-left"
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Insert below
              </button>

              <div className="my-1 border-t border-gray-800" />

              <button
                onClick={() => !isRoot && setMode("confirmPrune")}
                disabled={isRoot}
                className="nopan flex items-center gap-2 px-3 py-2 text-[12px]
                           text-red-400 hover:bg-gray-800 hover:text-red-300
                           disabled:opacity-30 disabled:cursor-not-allowed
                           transition-colors duration-100 text-left"
                title={isRoot ? "Cannot delete the root node" : "Delete this node and all nodes below it"}
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <polyline points="1,3 13,3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M4 3V2a1 1 0 011-1h4a1 1 0 011 1v1M5 6v5M9 6v5" stroke="currentColor"
                        strokeWidth="1.4" strokeLinecap="round"/>
                  <rect x="2" y="3" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.4"/>
                </svg>
                Delete branch
              </button>
            </div>
          )}

          {/* ── Edit form ───────────────────────────────────────────────────── */}
          {mode === "edit" && (
            <div className="flex flex-col gap-2 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                Edit node text
              </p>
              <textarea
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleEditSave();
                  if (e.key === "Escape") close();
                }}
                rows={4}
                className="nopan w-full resize-none rounded-lg bg-gray-800 px-2.5 py-2
                           text-[12px] text-gray-100 placeholder-gray-600
                           ring-1 ring-gray-700 focus:outline-none focus:ring-amber-500
                           transition-all duration-150"
              />
              <p className="text-[9px] text-gray-600">⌘ Enter to save</p>
              <div className="flex gap-2">
                <button
                  onClick={handleEditSave}
                  disabled={!editText.trim()}
                  className="nopan flex-1 rounded-md bg-amber-600 px-2 py-1.5 text-[11px]
                             font-semibold text-white hover:bg-amber-500
                             disabled:opacity-30 disabled:cursor-not-allowed
                             transition-colors duration-100"
                >
                  Save
                </button>
                <button
                  onClick={close}
                  className="nopan rounded-md bg-gray-800 px-2 py-1.5 text-[11px]
                             text-gray-400 hover:bg-gray-700 border border-gray-700
                             transition-colors duration-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Insert form ─────────────────────────────────────────────────── */}
          {mode === "insert" && (
            <div className="flex flex-col gap-2 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                Insert node below
              </p>
              <p className="text-[9px] text-gray-600 leading-snug">
                New node is placed between this node and its children.
              </p>
              <textarea
                autoFocus
                value={insertText}
                onChange={(e) => setInsertText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleInsertSave();
                  if (e.key === "Escape") close();
                }}
                placeholder="Write the inserted passage…"
                rows={4}
                className="nopan w-full resize-none rounded-lg bg-gray-800 px-2.5 py-2
                           text-[12px] text-gray-100 placeholder-gray-600
                           ring-1 ring-gray-700 focus:outline-none focus:ring-teal-500
                           transition-all duration-150"
              />
              <p className="text-[9px] text-gray-600">⌘ Enter to insert</p>
              <div className="flex gap-2">
                <button
                  onClick={handleInsertSave}
                  disabled={!insertText.trim()}
                  className="nopan flex-1 rounded-md bg-teal-700 px-2 py-1.5 text-[11px]
                             font-semibold text-white hover:bg-teal-600
                             disabled:opacity-30 disabled:cursor-not-allowed
                             transition-colors duration-100"
                >
                  Insert
                </button>
                <button
                  onClick={close}
                  className="nopan rounded-md bg-gray-800 px-2 py-1.5 text-[11px]
                             text-gray-400 hover:bg-gray-700 border border-gray-700
                             transition-colors duration-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Confirm prune ───────────────────────────────────────────────── */}
          {mode === "confirmPrune" && (
            <div className="flex flex-col gap-3 p-3">
              <div className="flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
                     className="flex-shrink-0 text-red-400 mt-0.5" aria-hidden="true">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 4.5v4M8 10.5v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p className="text-[11px] text-gray-300 leading-snug">
                  Delete this node <span className="font-semibold text-red-400">and every
                  node below it</span>? This cannot be undone.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePruneConfirm}
                  className="nopan flex-1 rounded-md bg-red-700 px-2 py-1.5 text-[11px]
                             font-semibold text-white hover:bg-red-600
                             transition-colors duration-100"
                >
                  Delete
                </button>
                <button
                  onClick={close}
                  className="nopan rounded-md bg-gray-800 px-2 py-1.5 text-[11px]
                             text-gray-400 hover:bg-gray-700 border border-gray-700
                             transition-colors duration-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
