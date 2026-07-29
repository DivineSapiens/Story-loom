import type { StoryNode } from "@/lib/types";

// ─── Tone → lighting modifier ─────────────────────────────────────────────────

const TONE_MODIFIERS: Record<string, string> = {
  Opening:    "natural ambient light, establishing shot",
  Tense:      "dramatic raking shadows, high contrast, dark vignette",
  Revelatory: "burst of bright dramatic light, god rays, cinematic reveal",
  Melancholy: "soft overcast diffused light, muted desaturated palette, rain-soaked",
  Hopeful:    "warm golden-hour sunlight, lens flare, uplifting atmosphere",
  Mysterious: "deep chiaroscuro shadows, single candle or lantern light, foggy",
  Humorous:   "bright flat even lighting, vibrant saturated colours, playful",
  Dark:       "low-key underlighting, deep shadows, oppressive atmosphere",
};

function toneModifier(tone: string): string {
  return TONE_MODIFIERS[tone] ?? "cinematic lighting, dramatic atmosphere";
}

// ─── Style chip → rich visual descriptor ─────────────────────────────────────
// Pollinations' flux model responds well to detailed painterly descriptors.
// Short labels like "Manga" produce near-identical results; full art-direction
// prompts produce strongly distinct outputs.

const STYLE_DESCRIPTORS: Record<string, string> = {
  "Watercolor storybook":
    "loose expressive watercolor painting, soft wet-on-wet washes, visible paper texture, "
    + "storybook illustration style, gentle bleeding pigment edges, pastel palette",

  "Noir comic":
    "black-and-white noir comic book art, bold ink lines, heavy cross-hatching, "
    + "high contrast chiaroscuro, 1940s detective aesthetic, halftone dot grain texture",

  "Pop art":
    "bold Roy Lichtenstein pop art comic, thick black outlines, primary colours, "
    + "Ben-Day halftone dots, flat graphic shapes, speech-bubble aesthetic",

  "Cute cartoon":
    "adorable rounded cartoon style, thick clean outlines, pastel soft colours, "
    + "chibi proportions, glossy highlights, Studio Ghibli-inspired charm",

  "Manga":
    "detailed black-and-white manga illustration, precise clean ink lines, "
    + "speed lines, screentone shading patterns, expressive anime faces, "
    + "Japanese manga page aesthetic",
};

function resolveStyle(styleDescription: string): string {
  const trimmed = styleDescription.trim();
  if (!trimmed) {
    // Default: rich general comic style rather than a vague label
    return (
      "detailed digital comic book illustration, expressive line art, "
      + "cinematic colour grading, warm atmospheric lighting"
    );
  }
  // If it matches one of our preset chips exactly, expand it to the full descriptor.
  if (Object.prototype.hasOwnProperty.call(STYLE_DESCRIPTORS, trimmed)) {
    return STYLE_DESCRIPTORS[trimmed];
  }
  // Free-text custom style — pass through as-is but append a quality booster.
  return `${trimmed}, highly detailed, cinematic, professional illustration quality`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum node text characters before truncation (keeps URLs reasonable). */
const MAX_TEXT_CHARS = 180;

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
 * Key improvements over the previous version:
 *  - Uses model=flux which is strongly style-sensitive (vs the default model
 *    that ignores short style tags and produces near-identical outputs).
 *  - Style chip names are expanded to rich art-direction descriptors so that
 *    "Manga", "Watercolor storybook" etc. produce genuinely different aesthetics.
 *  - enhance=true lets Pollinations internally improve the prompt coherence.
 *
 * Prompt structure:
 *   {scene description} — {expanded style descriptor}, {tone lighting modifier}
 *
 * Deterministic: same (node, styleDescription) → same URL → browser cache hit.
 *
 * @param node             The committed StoryNode to illustrate.
 * @param styleDescription User-supplied visual style (chip label or free text).
 * @param size             Image dimensions in pixels (default 768).
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

  const style   = resolveStyle(styleDescription);
  const lighting = toneModifier(node.tone);

  // Scene subject first, then style, then lighting — this ordering gives flux
  // the best signal-to-noise ratio for style adherence.
  const prompt = `${truncated} — ${style}, ${lighting}`;
  const seed   = hashId(node.id);

  return (
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${size}&height=${size}&seed=${seed}&nologo=true&model=flux&enhance=true`
  );
}
