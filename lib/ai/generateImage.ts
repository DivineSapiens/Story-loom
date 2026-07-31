import type { StoryNode } from "@/lib/types";

// ─── Deterministic seed from node id ─────────────────────────────────────────

/**
 * Derives a stable unsigned 32-bit integer from a string via djb2 hash.
 * Same input always → same output; used so the same node always generates
 * the same image (cache-friendly — same node never re-fetches).
 */
export function hashId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h) ^ id.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max story text characters sent as the scene subject. */
const MAX_TEXT_CHARS = 200;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds the image prompt sent to /api/generate-image.
 *
 * Strategy: story text IS the scene. No style chip appended — Pollinations
 * (FLUX, enhance=false) illustrates exactly what is written.
 * A short quality suffix keeps outputs consistently rendered without
 * overriding the content.
 *
 * Prompt structure:
 *   {story node text}, cinematic illustration, detailed scene
 */
export function buildImagePrompt(node: StoryNode): string {
  const truncated =
    node.text.length > MAX_TEXT_CHARS
      ? node.text.slice(0, MAX_TEXT_CHARS).trimEnd() + "…"
      : node.text;

  // Quality booster only — no art style, no lighting preset, no overrides.
  return `${truncated}, cinematic illustration, detailed scene`;
}
