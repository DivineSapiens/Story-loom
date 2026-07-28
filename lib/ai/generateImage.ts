import type { StoryNode } from "@/lib/types";

// ─── Tone → lighting modifier ─────────────────────────────────────────────────

const TONE_MODIFIERS: Record<string, string> = {
  Opening:    "natural ambient light",
  Tense:      "dramatic shadows",
  Revelatory: "bright dramatic lighting",
  Melancholy: "soft muted light",
  Hopeful:    "golden warm light",
  Mysterious: "deep chiaroscuro shadows",
  Humorous:   "bright flat even lighting",
  Dark:       "low-key underlighting",
};

function toneModifier(tone: string): string {
  return TONE_MODIFIERS[tone] ?? "cinematic lighting";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_STYLE = "clean modern webcomic style, warm flat colors, expressive line art";

/** Maximum node text characters before truncation (keeps URLs reasonable). */
const MAX_TEXT_CHARS = 200;

// ─── Deterministic seed from node id ─────────────────────────────────────────

/**
 * Derives a stable unsigned 32-bit integer from a string via djb2 hash.
 * Same input always → same output, no external deps.
 */
function hashId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h) ^ id.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds a Pollinations.ai image URL for a committed story node.
 *
 * Prompt structure:
 *   {node.text} — {styleDescription || DEFAULT_STYLE}, {tone modifier}
 *
 * Deterministic: same (node, styleDescription) → same URL → browser cache hit.
 *
 * @param node             The committed StoryNode to illustrate.
 * @param styleDescription User-supplied visual style (may be empty string).
 */
/**
 * Builds a Pollinations.ai image URL for a story node.
 *
 * @param node             The story node to illustrate.
 * @param styleDescription User-supplied visual style (empty → default style).
 * @param size             Image dimensions in pixels. Use 512 for branch previews,
 *                         768 (default) for committed node illustrations.
 */
export function buildImageUrl(
  node: StoryNode,
  styleDescription: string,
  size: 512 | 768 = 768
): string {
  const truncated =
    node.text.length > MAX_TEXT_CHARS
      ? node.text.slice(0, MAX_TEXT_CHARS).trimEnd() + "…"
      : node.text;

  const style = styleDescription.trim() || DEFAULT_STYLE;
  const modifier = toneModifier(node.tone);
  const prompt = `${truncated} — ${style}, ${modifier}`;
  const seed = hashId(node.id);

  return (
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${size}&height=${size}&seed=${seed}&nologo=true`
  );
}
