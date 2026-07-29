import type { CharacterThread, StoryNode } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppearancesEntry {
  /** The id of the node that contains the character's name. */
  nodeId: string;
  /** Full text of that node. */
  text: string;
  /**
   * "main" for main-tree nodes, or the thread.id for thread nodes.
   * Used to colour-code source badges.
   */
  source: "main" | string;
  /** Human-readable label, e.g. "Main story" or "Mara's thread". */
  sourceLabel: string;
  /** paletteIndex of the source thread (undefined for main-tree entries). */
  sourcePaletteIndex?: number;
  /** Depth of the node in its tree (0 = root). */
  depth: number;
  /**
   * Thread id of the source — undefined for main-tree entries.
   * Used by the jump handler to call handleThreadNodeClick.
   */
  sourceThreadId?: string;
}

// ─── findAppearances ──────────────────────────────────────────────────────────

/**
 * Returns every node (across the main tree and all character threads) whose
 * text contains `characterName` (case-insensitive substring match).
 *
 * Results are ordered: main-tree nodes first (in their original array order),
 * then thread nodes grouped by thread (in array order within each thread).
 *
 * @param characterName   The name to search for.
 * @param mainNodes       All committed main-tree nodes.
 * @param allThreads      All character threads (keyed by thread id).
 */
export function findAppearances(
  characterName: string,
  mainNodes: StoryNode[],
  allThreads: Record<string, CharacterThread>
): AppearancesEntry[] {
  const needle  = characterName.toLowerCase();
  const results: AppearancesEntry[] = [];

  // ── Main tree ──────────────────────────────────────────────────────────────
  for (const node of mainNodes) {
    if (node.text.toLowerCase().includes(needle)) {
      results.push({
        nodeId:      node.id,
        text:        node.text,
        source:      "main",
        sourceLabel: "Main story",
        depth:       node.depth,
      });
    }
  }

  // ── Character threads ──────────────────────────────────────────────────────
  for (const t of Object.values(allThreads)) {
    for (const node of t.nodes) {
      if (node.text.toLowerCase().includes(needle)) {
        results.push({
          nodeId:             node.id,
          text:               node.text,
          source:             t.id,
          sourceLabel:        `${t.characterName}'s thread`,
          sourcePaletteIndex: t.paletteIndex,
          sourceThreadId:     t.id,
          depth:              node.depth,
        });
      }
    }
  }

  return results;
}

// ─── HighlightedText helper (shared with rendering components) ────────────────

/**
 * Splits `text` around every occurrence of `needle` (case-insensitive) and
 * returns an array of React-renderable segments where matched spans are
 * wrapped in an object with `highlight: true`.
 *
 * Kept as plain data (not JSX) so it can be used by both React components
 * without importing React here.
 */
export interface TextSegment {
  text: string;
  highlight: boolean;
}

export function splitHighlights(text: string, needle: string): TextSegment[] {
  if (!needle) return [{ text, highlight: false }];
  const lower       = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const segments: TextSegment[] = [];
  let cursor = 0;
  let idx: number;
  while ((idx = lower.indexOf(lowerNeedle, cursor)) !== -1) {
    if (idx > cursor) segments.push({ text: text.slice(cursor, idx), highlight: false });
    segments.push({ text: text.slice(idx, idx + needle.length), highlight: true });
    cursor = idx + needle.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlight: false });
  return segments;
}
