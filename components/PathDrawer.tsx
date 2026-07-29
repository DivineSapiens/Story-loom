"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoryNode } from "@/lib/types";
import { buildImageUrl } from "@/lib/ai/generateImage";
import { pathToText } from "@/lib/treeUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PathDrawerProps {
  isOpen: boolean;
  activePath: StoryNode[];
  styleDescription: string;
  onClose: () => void;
}

// ─── Per-panel image state ─────────────────────────────────────────────────────
//
// Status lifecycle:
//   idle → loading → ready          (happy path)
//   idle → loading → retrying → loading → … (up to MAX_RETRIES attempts)
//   idle → loading → retrying → … → failed  (all retries exhausted)
//
// "retrying"  — countdown is ticking before the next attempt fires.
// "failed"    — permanent; all retries exhausted. No manual button.

type PanelStatus = "idle" | "loading" | "retrying" | "ready" | "failed";

interface PanelEntry {
  status: PanelStatus;
  url: string;
  /** Epoch-ms when the current load attempt began (0 when not loading). */
  startedAt: number;
  /** How many load attempts have been made so far (0 on first try). */
  retries: number;
  /** Epoch-ms when the next retry attempt will fire (0 when not retrying). */
  retryAt: number;
}

type ImageMap = Record<string, PanelEntry>;

// ─── Retry constants ──────────────────────────────────────────────────────────

const MAX_RETRIES     = 5;
const RETRY_DELAY_MS  = 4000; // 4-second countdown between attempts

// ─── Title / tagline state ─────────────────────────────────────────────────────

type TitleStatus = "idle" | "loading" | "ready" | "error";

interface TitleState {
  status: TitleStatus;
  title: string;
  tagline: string;
  /** The path-key this title was generated for, so we don't regenerate on reopen. */
  forPathKey: string;
}

// ─── TTS state ────────────────────────────────────────────────────────────────

type TtsStatus = "idle" | "speaking" | "paused";

// ─── Tone → panel border accent ───────────────────────────────────────────────

const TONE_BORDER: Record<string, string> = {
  Opening:    "#0c4a6e",
  Tense:      "#7f1d1d",
  Revelatory: "#4c1d95",
  Melancholy: "#1e3a5f",
  Hopeful:    "#14532d",
  Mysterious: "#1e1b4b",
  Humorous:   "#78350f",
  Dark:       "#1f2937",
};

function toneBorderColor(tone: string): string {
  return TONE_BORDER[tone] ?? "#374151";
}

// ─── Single-shot image loader ─────────────────────────────────────────────────
// Fires one HTTP request. Does NOT retry — retry orchestration is in
// loadWithAutoRetry below. Resolves with true (success) or false (failure).

function loadPanelImageOnce(
  node: StoryNode,
  url: string,
  onUpdate: (id: string, patch: Partial<PanelEntry>) => void,
  retries: number
): Promise<boolean> {
  onUpdate(node.id, { status: "loading", url, startedAt: Date.now(), retries, retryAt: 0 });
  return new Promise<boolean>((resolve) => {
    const img = new window.Image();
    img.onload  = () => { onUpdate(node.id, { status: "ready", startedAt: 0, retryAt: 0 }); resolve(true);  };
    img.onerror = () => {                                                                      resolve(false); };
    img.src = url;
  });
}

// ─── Auto-retry orchestrator ──────────────────────────────────────────────────
// Calls loadPanelImageOnce up to MAX_RETRIES+1 times.
// Between attempts it sets status:"retrying" and retryAt so the panel can
// render a live countdown driven by the existing 1-second ticker.

async function loadWithAutoRetry(
  node: StoryNode,
  url: string,
  onUpdate: (id: string, patch: Partial<PanelEntry>) => void
): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ok = await loadPanelImageOnce(node, url, onUpdate, attempt);
    if (ok) return; // success — done

    if (attempt < MAX_RETRIES) {
      // Enter retrying state: show countdown
      const retryAt = Date.now() + RETRY_DELAY_MS;
      onUpdate(node.id, { status: "retrying", startedAt: 0, retryAt, retries: attempt + 1 });
      await new Promise<void>((res) => setTimeout(res, RETRY_DELAY_MS));
      // After the delay, loop back and fire the next attempt.
    }
  }
  // All attempts exhausted — permanent failure
  onUpdate(node.id, { status: "failed", startedAt: 0, retryAt: 0 });
}

// ─── Comic panel ─────────────────────────────────────────────────────────────

interface ComicPanelProps {
  node: StoryNode;
  index: number;
  entry: PanelEntry | undefined;
  nowMs: number;
  isSpeaking: boolean;
  panelRef: React.RefObject<HTMLDivElement>;
}

function ComicPanel({ node, index, entry, nowMs, isSpeaking, panelRef }: ComicPanelProps) {
  const borderColor = toneBorderColor(node.tone);
  const isUser      = node.authorType === "user";

  // Seconds since current load attempt began (shown in caption while loading).
  const elapsed =
    entry?.status === "loading" && entry.startedAt > 0
      ? Math.floor((nowMs - entry.startedAt) / 1000)
      : 0;

  // Seconds until next retry attempt (shown in the image area while retrying).
  const retryIn =
    entry?.status === "retrying" && entry.retryAt > 0
      ? Math.max(0, Math.ceil((entry.retryAt - nowMs) / 1000))
      : 0;

  return (
    <div
      ref={panelRef}
      style={{
        borderColor: isSpeaking
          ? "#f59e0b"
          : isUser ? "#0d9488" : borderColor,
        borderWidth: isSpeaking ? 5 : 4,
        borderStyle: "solid",
        boxShadow: isSpeaking ? "0 0 0 3px rgba(245,158,11,0.35)" : undefined,
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      className="flex flex-col overflow-hidden bg-white"
    >
      {/* ── Panel image area ──────────────────────────────────────────────── */}
      {isUser ? (
        <div className="w-full h-3 bg-gray-100" />
      ) : entry?.status === "ready" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.url}
          alt=""
          className="w-full aspect-[4/3] object-cover block"
          style={{ animation: "panelReveal 0.35s ease-out both" }}
        />
      ) : entry?.status === "loading" ? (
        <div className="w-full aspect-[4/3] bg-gray-100 flex flex-col items-center justify-center gap-1 select-none">
          <svg
            className="w-8 h-8 text-gray-300"
            viewBox="0 0 24 24"
            fill="none"
            style={{ animation: "spin 1.2s linear infinite" }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="20 40" strokeLinecap="round"/>
          </svg>
          <span className="text-[10px] text-gray-400 font-sans tabular-nums">
            {elapsed > 0 ? `${elapsed}s` : "Starting…"}
          </span>
        </div>
      ) : entry?.status === "retrying" ? (
        // Countdown to next automatic retry — no button, purely informational.
        <div className="w-full aspect-[4/3] bg-gray-100 flex flex-col items-center justify-center gap-1.5 select-none">
          <svg
            className="w-7 h-7 text-amber-400/60"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            {/* Clock outline */}
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[10px] text-amber-500/80 font-sans tabular-nums">
            Retrying in {retryIn}s…
          </span>
          <span className="text-[9px] text-gray-400 font-sans">
            attempt {(entry.retries ?? 1) + 1} of {MAX_RETRIES + 1}
          </span>
        </div>
      ) : entry?.status === "failed" ? (
        // Permanent failure after all retries — hatched placeholder, no button.
        <div className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-1 select-none"
             style={{ background: "repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 6px, #e5e7eb 6px, #e5e7eb 12px)" }}>
          <span className="text-[10px] text-gray-400 font-sans px-3 text-center leading-snug">
            Illustration unavailable
          </span>
        </div>
      ) : (
        <div className="w-full aspect-[4/3] bg-gray-100" />
      )}

      {/* ── Caption gutter ────────────────────────────────────────────────── */}
      <div className="bg-black px-3 py-2 flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-white/40 tabular-nums tracking-wider font-sans">
            {String(index + 1).padStart(2, "0")}
          </span>
          {isUser ? (
            <span className="text-[9px] font-bold uppercase tracking-widest font-sans text-teal-400">
              Your words
            </span>
          ) : (
            <span
              className="text-[9px] font-bold uppercase tracking-widest font-sans"
              style={{ color: borderColor === "#1f2937" ? "#9ca3af" : borderColor }}
            >
              {node.tone}
            </span>
          )}
          {isSpeaking && (
            <span className="ml-auto text-[9px] text-amber-400 font-sans animate-pulse">
              ▶ Reading…
            </span>
          )}
          {!isUser && !isSpeaking && entry?.status === "loading" && (
            <span className="ml-auto text-[9px] text-amber-400/60 font-sans tabular-nums animate-pulse">
              Illustrating…{elapsed > 0 ? ` ${elapsed}s` : ""}
            </span>
          )}
          {!isUser && entry?.status === "retrying" && (
            <span className="ml-auto text-[9px] text-amber-500/70 font-sans tabular-nums">
              Retry {(entry.retries ?? 1) + 1}/{MAX_RETRIES + 1} in {retryIn}s
            </span>
          )}
          {!isUser && entry?.status === "failed" && (
            <span className="ml-auto text-[9px] text-red-400/60 font-sans">No image</span>
          )}
        </div>
        <p className="text-[12px] leading-snug text-white font-serif">{node.text}</p>
      </div>
    </div>
  );
}

// ─── Narrator voice resolver ──────────────────────────────────────────────────
//
// Selects the best available voice for the read-aloud feature:
//   1. Prefers voices whose names match known female narrator names.
//   2. Among matches, prefers English-language voices (lang starts with "en").
//   3. Falls back to the browser's first available voice if no match found.
//   4. Returns null if speechSynthesis is unavailable (SSR / no speech engine).
//
// Chrome loads voices asynchronously — the list is empty until the
// `voiceschanged` event fires. We handle this by waiting for that event once
// if the initial getVoices() call returns an empty array.

const FEMALE_VOICE_KEYWORDS = [
  "samantha", "victoria", "karen", "moira", "veena",
  "google uk english female", "google us english",
  "zira", "hazel", "susan", "emma", "amy",
  "female", "woman", "fiona", "tessa",
];

function pickNarratorVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const lower = (v: SpeechSynthesisVoice) => v.name.toLowerCase();

  // 1. English female match.
  const enFemale = voices.find(
    (v) => v.lang.startsWith("en") && FEMALE_VOICE_KEYWORDS.some((kw) => lower(v).includes(kw))
  );
  if (enFemale) return enFemale;

  // 2. Any-language female match.
  const anyFemale = voices.find(
    (v) => FEMALE_VOICE_KEYWORDS.some((kw) => lower(v).includes(kw))
  );
  if (anyFemale) return anyFemale;

  // 3. Fall back to first English voice.
  const enDefault = voices.find((v) => v.lang.startsWith("en"));
  if (enDefault) return enDefault;

  // 4. Fall back to whatever the browser has.
  return voices[0] ?? null;
}

function resolveNarratorVoice(): Promise<SpeechSynthesisVoice | null> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve(null);
  }

  const voices = window.speechSynthesis.getVoices();

  // Voices already populated (Firefox, Safari, or subsequent calls on Chrome).
  if (voices.length > 0) {
    return Promise.resolve(pickNarratorVoice(voices));
  }

  // Chrome: voices load asynchronously — wait for voiceschanged, with a
  // 2-second safety timeout so narration never hangs if the event never fires.
  return new Promise<SpeechSynthesisVoice | null>((resolve) => {
    const timeout = setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(pickNarratorVoice(window.speechSynthesis.getVoices()));
    }, 2000);

    function onVoicesChanged() {
      clearTimeout(timeout);
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(pickNarratorVoice(window.speechSynthesis.getVoices()));
    }

    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
  });
}

// ─── Canvas download helper ────────────────────────────────────────────────────
// Composites all panels into one tall PNG and triggers download.
// Runs fully client-side — no extra libraries.
//
// Panel layout strategy:
//   • "ready" image  → full IMAGE area (IMG_H) + CAPTION bar (CAPTION_H) = PANEL_H
//   • no image yet   → IMAGE area replaced by "Generating…" dark block
//   • failed image   → TEXT-ONLY panel: no image block drawn at all; the caption
//     area expands to TEXT_ONLY_H so the full story text is readable.
//   • user-authored  → thin ruled strip + normal caption

const CANVAS_W        = 480;
const IMG_H           = 360;  // 4:3 ratio for CANVAS_W=480
const CAPTION_H       = 80;
const PANEL_H         = IMG_H + CAPTION_H;
const TEXT_ONLY_H     = 160;  // height of a text-only panel (no image)
const TITLE_BLOCK_H   = 90;   // used only when title is available
const PANEL_GAP       = 4;

/** Word-wrap ctx.fillText into multiple lines, returning number of lines drawn. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): void {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  for (let li = 0; li < Math.min(lines.length, maxLines); li++) {
    let txt = lines[li];
    if (li === maxLines - 1 && lines.length > maxLines) txt += "…";
    ctx.fillText(txt, x, y + li * lineHeight);
  }
}

async function downloadComic(
  path: StoryNode[],
  imageMap: ImageMap,
  title: string,
  tagline: string
): Promise<void> {
  const hasTitle = Boolean(title);
  const topPad   = hasTitle ? TITLE_BLOCK_H : 16;

  // Pre-compute each panel's height so we can size the canvas accurately.
  const panelHeights = path.map((node) => {
    if (node.authorType === "user") return PANEL_H;
    const entry = imageMap[node.id];
    const hasImage = entry?.status === "ready" || entry?.status === "loading" || entry?.status === "retrying";
    return hasImage ? PANEL_H : TEXT_ONLY_H;
  });
  const totalH = topPad + panelHeights.reduce((s, h) => s + h + PANEL_GAP, 0) + 16;

  const canvas  = document.createElement("canvas");
  canvas.width  = CANVAS_W;
  canvas.height = totalH;
  const ctx     = canvas.getContext("2d");
  if (!ctx) return;

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, CANVAS_W, totalH);

  // ── Title block ─────────────────────────────────────────────────────────────
  if (hasTitle) {
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, CANVAS_W, TITLE_BLOCK_H);

    ctx.fillStyle = "#f9fafb";
    ctx.font      = "bold 22px serif";
    ctx.textAlign = "center";
    ctx.fillText(title, CANVAS_W / 2, 38);

    ctx.fillStyle = "#9ca3af";
    ctx.font      = "italic 13px serif";
    ctx.fillText(tagline, CANVAS_W / 2, 62);
  }

  // ── Panels ──────────────────────────────────────────────────────────────────
  let yOffset = topPad;
  for (let i = 0; i < path.length; i++) {
    const node      = path[i];
    const entry     = imageMap[node.id];
    const isUser    = node.authorType === "user";
    const panelH    = panelHeights[i];
    const y         = yOffset;
    const border    = isUser ? "#0d9488" : (TONE_BORDER[node.tone] ?? "#374151");

    // ── Border frame ──────────────────────────────────────────────────────────
    ctx.strokeStyle = border;
    ctx.lineWidth   = 4;
    ctx.strokeRect(2, y + 2, CANVAS_W - 4, panelH - 4);

    if (isUser) {
      // ── User node: thin ruled strip, then caption fills the rest ────────────
      ctx.fillStyle = "#1c2432";
      ctx.fillRect(4, y + 4, CANVAS_W - 8, panelH - 8);
      // Thin teal rule at top
      ctx.fillStyle = "#0d9488";
      ctx.fillRect(4, y + 4, CANVAS_W - 8, 3);

    } else if (entry?.status === "ready") {
      // ── Has image: draw it ───────────────────────────────────────────────────
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((res) => {
        img.onload  = () => { ctx.drawImage(img, 4, y + 4, CANVAS_W - 8, IMG_H - 8); res(); };
        img.onerror = () => res();
        img.src = entry.url;
      });

    } else if (!entry || entry.status === "loading" || entry.status === "retrying") {
      // ── In-flight: dark "Generating…" block ─────────────────────────────────
      ctx.fillStyle = "#111827";
      ctx.fillRect(4, y + 4, CANVAS_W - 8, IMG_H - 8);
      ctx.fillStyle = "#6b7280";
      ctx.font      = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Generating…", CANVAS_W / 2, y + 4 + (IMG_H - 8) / 2);
    }
    // ── "failed" → text-only panel. No image block drawn at all.
    //    The caption area below fills the entire panelH.

    // ── Caption bar ───────────────────────────────────────────────────────────
    // For text-only panels (failed), the caption fills the whole panel height.
    // For image panels, it's the bottom CAPTION_H strip as usual.
    const textOnlyMode = !isUser && (entry?.status === "failed" || (!entry && panelH === TEXT_ONLY_H));
    const capY         = textOnlyMode ? y + 4 : y + IMG_H;
    const capH         = textOnlyMode ? panelH - 8 : CAPTION_H;

    ctx.fillStyle = textOnlyMode ? "#0d1117" : "#000";
    ctx.fillRect(4, capY, CANVAS_W - 8, capH);

    // Panel number
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font      = "bold 9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(i + 1).padStart(2, "0"), 12, capY + 16);

    // Tone label
    const labelColor = isUser ? "#2dd4bf" : (border === "#1f2937" ? "#9ca3af" : border);
    ctx.fillStyle    = labelColor;
    ctx.font         = "bold 9px sans-serif";
    ctx.textAlign    = "left";
    ctx.fillText(isUser ? "YOUR WORDS" : node.tone.toUpperCase(), 36, capY + 16);

    // Story text — more lines available in text-only mode
    ctx.fillStyle = "#fff";
    ctx.font      = textOnlyMode ? "14px serif" : "13px serif";
    ctx.textAlign = "left";
    const maxLines = textOnlyMode ? 6 : 3;
    wrapText(ctx, node.text, 12, capY + 32, CANVAS_W - 24, 18, maxLines);

    yOffset += panelH + PANEL_GAP;
  }

  // ── Trigger download ─────────────────────────────────────────────────────────
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `story-loom-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export default function PathDrawer({ isOpen, activePath, styleDescription, onClose }: PathDrawerProps) {
  const pathText = pathToText(activePath);
  const pathKey  = activePath.map((n) => n.id).join(",");

  // ── Image loading ─────────────────────────────────────────────────────────
  const [imageMap,  setImageMap]  = useState<ImageMap>({});
  const [nowMs,     setNowMs]     = useState<number>(() => Date.now());
  const tickerRef                 = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Title state ───────────────────────────────────────────────────────────
  const [titleState, setTitleState] = useState<TitleState>({
    status: "idle", title: "", tagline: "", forPathKey: "",
  });

  // ── TTS state ─────────────────────────────────────────────────────────────
  const [ttsStatus,      setTtsStatus]      = useState<TtsStatus>("idle");
  const [speakingIndex,  setSpeakingIndex]  = useState<number | null>(null);
  const ttsAbortRef                         = useRef(false);

  // ── Panel refs for auto-scroll ────────────────────────────────────────────
  const panelRefs = useRef<Array<React.RefObject<HTMLDivElement>>>([]);
  if (panelRefs.current.length !== activePath.length) {
    panelRefs.current = activePath.map(() =>
      ({ current: null }) as React.RefObject<HTMLDivElement>
    );
  }

  // ── updateEntry ───────────────────────────────────────────────────────────
  const updateEntry = useCallback((id: string, patch: Partial<PanelEntry>) => {
    setImageMap((m) => ({
      ...m,
      [id]: { ...(m[id] ?? { status: "idle", url: "", startedAt: 0 }), ...patch },
    }));
  }, []);

  // ── Ticker lifecycle ──────────────────────────────────────────────────────
  // Runs while any panel is "loading" OR "retrying" (both need per-second updates).
  useEffect(() => {
    const anyLoading = Object.values(imageMap).some(
      (e) => e.status === "loading" || e.status === "retrying"
    );
    if (anyLoading) {
      if (!tickerRef.current) {
        tickerRef.current = setInterval(() => setNowMs(Date.now()), 1000);
      }
    } else {
      if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
    }
  }, [imageMap]);

  useEffect(() => () => { if (tickerRef.current) clearInterval(tickerRef.current); }, []);

  // ── loadOneWithRetry ──────────────────────────────────────────────────────
  // Stable callback: kicks off auto-retry orchestration for one node.
  // Used both by the batch kick-off and (if ever needed) external callers.
  const loadOneWithRetry = useCallback(
    (node: StoryNode) => {
      const url = buildImageUrl(node, styleDescription);
      loadWithAutoRetry(node, url, updateEntry);
    },
    [styleDescription, updateEntry]
  );

  // ── Batch image kick-off ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || activePath.length === 0) return;
    const aiNodes = activePath.filter((n) => n.authorType !== "user");
    if (aiNodes.length === 0) return;

    setImageMap((prev) => {
      const toLoad: StoryNode[] = [];
      const next = { ...prev };
      for (const node of aiNodes) {
        if (!prev[node.id] || prev[node.id].status === "idle") {
          next[node.id] = { status: "idle", url: buildImageUrl(node, styleDescription), startedAt: 0, retries: 0, retryAt: 0 };
          toLoad.push(node);
        }
        // "ready" entries are cache hits — never refetch.
        // "failed" entries stay failed — no silent re-kick on re-open.
      }
      if (toLoad.length > 0) {
        setTimeout(() => { for (const node of toLoad) loadOneWithRetry(node); }, 0);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pathKey, styleDescription]);

  // ── Title fetch (cached per pathKey) ─────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !pathText || titleState.forPathKey === pathKey) return;

    setTitleState({ status: "loading", title: "", tagline: "", forPathKey: pathKey });

    fetch("/api/titlise-story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathText }),
    })
      .then((r) => r.json())
      .then((data: { title?: string; tagline?: string; error?: string }) => {
        if (data.title && data.tagline) {
          setTitleState({ status: "ready", title: data.title, tagline: data.tagline, forPathKey: pathKey });
        } else {
          setTitleState({ status: "error", title: "", tagline: "", forPathKey: pathKey });
        }
      })
      .catch(() => {
        setTitleState({ status: "error", title: "", tagline: "", forPathKey: pathKey });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pathKey]);

  // ── Stop TTS when drawer closes ────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      ttsAbortRef.current = true;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      setTtsStatus("idle");
      setSpeakingIndex(null);
    }
  }, [isOpen]);

  // ── TTS: speak all panels in order ────────────────────────────────────────
  const handleSpeak = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    ttsAbortRef.current = false;
    setTtsStatus("speaking");

    // Resolve the narrator voice, then chain through all panels.
    resolveNarratorVoice().then((voice) => {
      let idx = 0;

      function speakNext() {
        if (ttsAbortRef.current || idx >= activePath.length) {
          setTtsStatus("idle");
          setSpeakingIndex(null);
          return;
        }
        const node = activePath[idx];
        setSpeakingIndex(idx);

        // Scroll panel into view.
        const ref = panelRefs.current[idx];
        if (ref?.current) {
          ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        const utt   = new SpeechSynthesisUtterance(node.text);
        utt.rate    = 0.9;   // slightly slower — calmer narrator pace
        utt.pitch   = 0.9;   // slightly lower — warmer, less robotic tone
        if (voice) utt.voice = voice;
        utt.onend   = () => { idx++; speakNext(); };
        utt.onerror = () => { idx++; speakNext(); };
        window.speechSynthesis.speak(utt);
      }

      speakNext();
    });
  }, [activePath]);

  const handlePause = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.pause();
    setTtsStatus("paused");
  }, []);

  const handleResume = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.resume();
    setTtsStatus("speaking");
  }, []);

  const handleStop = useCallback(() => {
    ttsAbortRef.current = true;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setTtsStatus("idle");
    setSpeakingIndex(null);
  }, []);

  // ── Download ───────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    const t = titleState.status === "ready" ? titleState.title   : "";
    const q = titleState.status === "ready" ? titleState.tagline : "";
    // Normalise "retrying" → treat same as "failed" for the canvas export.
    const exportMap: ImageMap = {};
    for (const [k, v] of Object.entries(imageMap)) {
      exportMap[k] = v.status === "retrying" ? { ...v, status: "failed" } : v;
    }
    await downloadComic(activePath, exportMap, t, q);
  }, [activePath, imageMap, titleState]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const aiNodeIds    = activePath.filter((n) => n.authorType !== "user").map((n) => n.id);
  const anyBuilding  = aiNodeIds.some((id) => {
    const e = imageMap[id];
    return !e || e.status === "idle" || e.status === "loading" || e.status === "retrying";
  });
  const settledCount = aiNodeIds.filter((id) => {
    const e = imageMap[id];
    return e?.status === "ready" || e?.status === "failed";
  }).length;

  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(pathText); } catch { /* ignore */ }
  }, [pathText]);

  const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black/40" onClick={onClose} aria-hidden="true" />
      )}

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-label="Read this path"
        aria-modal="true"
        className={`
          fixed top-0 right-0 z-30 h-full w-full max-w-md
          bg-black border-l-4 border-black flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between
                        bg-gray-950 border-b-4 border-black px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-bold text-white tracking-widest uppercase font-sans">
              Story path
            </h2>
            {isOpen && aiNodeIds.length > 0 && anyBuilding && (
              <span className="text-[10px] text-amber-400/70 font-sans animate-pulse">
                Building comic… {settledCount}/{aiNodeIds.length} panels ready
              </span>
            )}
            {isOpen && aiNodeIds.length > 0 && !anyBuilding && (
              <span className="text-[10px] text-green-400/60 font-sans">
                {settledCount === aiNodeIds.length
                  ? `${settledCount} panel${settledCount !== 1 ? "s" : ""} illustrated`
                  : `${settledCount}/${aiNodeIds.length} panels illustrated`}
              </span>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5">

            {/* TTS controls */}
            {hasSpeech && activePath.length > 0 && (
              ttsStatus === "idle" ? (
                <button
                  onClick={handleSpeak}
                  title="Listen to this path"
                  className="rounded px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide
                             text-purple-300 hover:text-purple-100 bg-gray-900 border border-gray-700
                             transition-colors duration-100 font-sans flex items-center gap-1"
                >
                  <span aria-hidden="true">🔊</span> Listen
                </button>
              ) : ttsStatus === "speaking" ? (
                <>
                  <button
                    onClick={handlePause}
                    title="Pause narration"
                    className="rounded px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide
                               text-amber-300 hover:text-amber-100 bg-gray-900 border border-gray-700
                               transition-colors duration-100 font-sans"
                  >
                    ⏸ Pause
                  </button>
                  <button
                    onClick={handleStop}
                    title="Stop narration"
                    className="rounded p-1.5 text-gray-400 hover:text-red-400
                               bg-gray-900 border border-gray-700 transition-colors duration-100"
                    aria-label="Stop narration"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                      <rect x="1" y="1" width="8" height="8" rx="1"/>
                    </svg>
                  </button>
                </>
              ) : /* paused */ (
                <>
                  <button
                    onClick={handleResume}
                    title="Resume narration"
                    className="rounded px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide
                               text-green-300 hover:text-green-100 bg-gray-900 border border-gray-700
                               transition-colors duration-100 font-sans"
                  >
                    ▶ Resume
                  </button>
                  <button
                    onClick={handleStop}
                    title="Stop narration"
                    className="rounded p-1.5 text-gray-400 hover:text-red-400
                               bg-gray-900 border border-gray-700 transition-colors duration-100"
                    aria-label="Stop narration"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                      <rect x="1" y="1" width="8" height="8" rx="1"/>
                    </svg>
                  </button>
                </>
              )
            )}

            <button
              onClick={handleCopy}
              disabled={activePath.length === 0}
              title="Copy story text"
              className="rounded px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide
                         text-amber-400 hover:text-amber-300 bg-gray-900 border border-gray-700
                         disabled:opacity-30 transition-colors duration-100 font-sans"
            >
              Copy
            </button>

            <button
              onClick={handleDownload}
              disabled={activePath.length === 0}
              title="Download comic as PNG"
              className="rounded px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide
                         text-sky-400 hover:text-sky-200 bg-gray-900 border border-gray-700
                         disabled:opacity-30 transition-colors duration-100 font-sans"
            >
              ↓ Save
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

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-white">
          {activePath.length > 0 ? (
            <div className="flex flex-col gap-1 p-1 bg-black">

              {/* ── Title / tagline block ──────────────────────────────────── */}
              {titleState.status === "loading" && (
                <div className="px-4 py-5 bg-gray-950 flex flex-col items-center gap-1">
                  <div className="h-5 w-48 rounded bg-gray-800 animate-pulse" />
                  <div className="h-3 w-64 rounded bg-gray-800 animate-pulse" />
                </div>
              )}
              {titleState.status === "ready" && (
                <div
                  className="px-5 pt-6 pb-4 bg-gray-950 flex flex-col items-center gap-1.5"
                  style={{ animation: "panelReveal 0.4s ease-out both" }}
                >
                  <h3 className="text-white text-xl font-bold font-serif text-center leading-tight">
                    {titleState.title}
                  </h3>
                  <p className="text-gray-400 text-[12px] italic font-serif text-center">
                    {titleState.tagline}
                  </p>
                </div>
              )}

              {/* ── Comic panels ───────────────────────────────────────────── */}
              {activePath.map((node, i) => (
                <ComicPanel
                  key={node.id}
                  node={node}
                  index={i}
                  entry={imageMap[node.id]}
                  nowMs={nowMs}
                  isSpeaking={speakingIndex === i}
                  panelRef={panelRefs.current[i]}
                />
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

      {/* ── Keyframes ───────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes panelReveal {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1);    }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
