/**
 * Six distinct visual themes for character threads.
 * paletteIndex (0–5) is assigned at thread creation and never changes.
 *
 * ring   — CSS hex colour for the node ring / border
 * edge   — slightly darker variant for edges and dashes
 * bg     — very dark tinted background for the node card
 * text   — light foreground for labels/badges on that background
 * label  — human-readable colour name shown in thread header
 */
export const THREAD_PALETTE = [
  { ring: "#6366f1", edge: "#4338ca", bg: "#1e1b4b", text: "#a5b4fc", label: "Indigo"  },
  { ring: "#ec4899", edge: "#be185d", bg: "#500724", text: "#f9a8d4", label: "Pink"    },
  { ring: "#14b8a6", edge: "#0f766e", bg: "#042f2e", text: "#5eead4", label: "Teal"    },
  { ring: "#f97316", edge: "#c2410c", bg: "#431407", text: "#fdba74", label: "Orange"  },
  { ring: "#a855f7", edge: "#7e22ce", bg: "#3b0764", text: "#d8b4fe", label: "Purple"  },
  { ring: "#22c55e", edge: "#15803d", bg: "#052e16", text: "#86efac", label: "Green"   },
] as const;

export type PaletteEntry = (typeof THREAD_PALETTE)[number];

/** Maximum number of concurrent character threads. Matches palette length. */
export const MAX_THREADS = THREAD_PALETTE.length; // 6
