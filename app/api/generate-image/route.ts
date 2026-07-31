import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/generate-image
 *
 * Body: { prompt: string; seed?: number }
 * Returns: { dataUrl: string } — base64 data URL, ready for <img src>
 *      or: { error: string }  — on total failure
 *
 * Provider chain (first success wins):
 *   1. Pollinations.ai  — free, no key, FLUX model, server-side fetch
 *   2. Picsum.photos    — photo placeholder, always reachable, last resort
 *
 * Note: Hugging Face inference API (api-inference.huggingface.co) is blocked
 * on this network. Pollinations uses FLUX under the hood so quality is good.
 */

// ─── Provider 1: Pollinations.ai ─────────────────────────────────────────────
// Fetched server-side so there are no browser CORS/timeout issues.
// Uses model=flux which is the same underlying model as FLUX.1-schnell.

async function tryPollinations(
  prompt: string,
  seed: number | undefined
): Promise<string | null> {
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=768&height=768&nologo=true&model=flux` +
    (seed != null ? `&seed=${seed}` : "");

  let res: Response;
  try {
    // 30 s timeout — Pollinations can be slow on cold requests
    res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  } catch (err) {
    console.error(`[generate-image] Pollinations fetch failed: ${String(err).slice(0, 120)}`);
    return null;
  }

  if (!res.ok) {
    console.error(`[generate-image] Pollinations → HTTP ${res.status}`);
    return null;
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.startsWith("image/")) {
    console.error(`[generate-image] Pollinations returned non-image content-type: ${ct}`);
    return null;
  }

  const bytes = await res.arrayBuffer().catch(() => null);
  if (!bytes || bytes.byteLength === 0) {
    console.error("[generate-image] Pollinations returned empty body");
    return null;
  }

  console.log(`[generate-image] ✓ Pollinations — ${bytes.byteLength} bytes (${ct})`);
  return `data:${ct};base64,${Buffer.from(bytes).toString("base64")}`;
}

// ─── Provider 2: Picsum placeholder ──────────────────────────────────────────
// Deterministic photo from picsum.photos — seed-stable, always reachable.

async function tryPicsum(seed: number | undefined): Promise<string | null> {
  const id  = seed != null ? (Math.abs(seed) % 999) + 1 : 237;
  const url = `https://picsum.photos/id/${id}/768/768`;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    console.error(`[generate-image] Picsum fetch failed: ${String(err).slice(0, 80)}`);
    return null;
  }

  if (!res.ok) return null;

  const ct    = res.headers.get("content-type") ?? "image/jpeg";
  const bytes = await res.arrayBuffer().catch(() => null);
  if (!bytes || bytes.byteLength === 0) return null;

  console.log(`[generate-image] ✓ Picsum fallback id=${id} — ${bytes.byteLength} bytes`);
  return `data:${ct};base64,${Buffer.from(bytes).toString("base64")}`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { prompt?: string; seed?: number };
  const { prompt = "", seed } = body;

  if (!prompt.trim()) {
    return NextResponse.json({ error: "empty_prompt" }, { status: 400 });
  }

  console.log(`[generate-image] prompt="${prompt.slice(0, 80)}…" seed=${seed}`);

  // ── 1. Pollinations ───────────────────────────────────────────────────────────
  const pollinationsUrl = await tryPollinations(prompt, seed);
  if (pollinationsUrl) return NextResponse.json({ dataUrl: pollinationsUrl });

  console.log("[generate-image] Pollinations failed — falling back to Picsum");

  // ── 2. Picsum placeholder ─────────────────────────────────────────────────────
  const picsumUrl = await tryPicsum(seed);
  if (picsumUrl) return NextResponse.json({ dataUrl: picsumUrl, placeholder: true });

  console.error("[generate-image] all providers failed");
  return NextResponse.json({ error: "all_providers_failed" }, { status: 500 });
}
