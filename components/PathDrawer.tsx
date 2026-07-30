"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoryNode } from "@/lib/types";
import { buildImagePrompt, hashId } from "@/lib/ai/generateImage";
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
// Status lifecycle (Hugging Face):
//   idle → loading → ready          (happy path, ~3-6s)
//   idle → loading → model_loading  (HF 503 — model cold-starting)
//         → loading → ready         (auto-retry after estimated_time)
//   idle → loading → failed         (non-503 error or no HF token)
//   idle → no_token                 (HUGGINGFACE_TOKEN not set — show placeholder)

type PanelStatus = "idle" | "loading" | "model_loading" | "ready" | "failed" | "no_token";

interface PanelEntry {
  status: PanelStatus;
  /** data: URL returned by the API route (only set when status === "ready"). */
  dataUrl: string;
  /** Epoch-ms when the model-loading retry will fire (only during model_loading). */
  retryAt: number;
}

type ImageMap = Record<string, PanelEntry>;

// ─── Title / tagline state ─────────────────────────────────────────────────────

type TitleStatus = "idle" | "loading" | "ready" | "error";

interface TitleState {
  status: TitleStatus;
  title: string;
  tagline: string;
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

// ─── Server-side image fetcher ────────────────────────────────────────────────
//
// Calls our /api/generate-image route (which calls Hugging Face server-side).
// Handles the 503 model-loading case with a single auto-retry after the
// `retryAfterMs` the server returns.
//
// onUpdate is called at each state transition so the panel re-renders live.

async function fetchPanelImage(
  node: StoryNode,
  styleDescription: string,
  onUpdate: (id: string, patch: Partial<PanelEntry>) => void
): Promise<void> {
  const prompt = buildImagePrompt(node, styleDescription);
  const seed   = hashId(node.id);

  // ── First attempt ────────────────────────────────────────────────────────────
  onUpdate(node.id, { status: "loading", dataUrl: "", retryAt: 0 });

  const tryFetch = async (): Promise<{ done: boolean; retryAfterMs?: number }> => {
    let res: Response;
    try {
      res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, seed }),
      });
    } catch {
      // Network error (offline, DNS failure, etc.)
      onUpdate(node.id, { status: "failed" });
      return { done: true };
    }

    // Always read as text first — the body might be empty or non-JSON,
    // and calling .json() directly throws "Unexpected end of JSON input".
    const text = await res.text().catch(() => "");
    let json: { dataUrl?: string; error?: string; retryAfterMs?: number } = {};
    try { json = text ? JSON.parse(text) : {}; } catch { /* malformed JSON — leave json as {} */ }

    if (json.error === "no_token") {
      onUpdate(node.id, { status: "no_token" });
      return { done: true };
    }

    if (res.status === 503 && json.error === "model_loading") {
      const ms = json.retryAfterMs ?? 20_000;
      onUpdate(node.id, { status: "model_loading", retryAt: Date.now() + ms });
      return { done: false, retryAfterMs: ms };
    }

    if (!res.ok || json.error || !json.dataUrl) {
      onUpdate(node.id, { status: "failed" });
      return { done: true };
    }

    onUpdate(node.id, { status: "ready", dataUrl: json.dataUrl, retryAt: 0 });
    return { done: true };
  };

  const result = await tryFetch();
  if (result.done) return;

  // ── Single model-loading retry ────────────────────────────────────────────────
  const delay = result.retryAfterMs ?? 20_000;
  await new Promise<void>((r) => setTimeout(r, delay));

  onUpdate(node.id, { status: "loading", retryAt: 0 });
  const retryResult = await tryFetch();
  if (!retryResult.done) {
    // Still 503 after one retry — give up
    onUpdate(node.id, { status: "failed" });
  }
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

  // Seconds until model-loading retry fires
  const retryIn =
    entry?.status === "model_loading" && entry.retryAt > 0
      ? Math.max(0, Math.ceil((entry.retryAt - nowMs) / 1000))
      : 0;

  return (
    <div
      ref={panelRef}
      style={{
        borderColor: isSpeaking ? "#f59e0b" : isUser ? "#0d9488" : borderColor,
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
          src={entry.dataUrl}
          alt=""
          className="w-full aspect-[4/3] object-cover block"
          style={{ animation: "panelReveal 0.35s ease-out both" }}
        />
      ) : entry?.status === "loading" ? (
        <div className="w-full aspect-[4/3] bg-gray-100 flex flex-col items-center justify-center gap-2 select-none">
          <svg
            className="w-8 h-8 text-gray-300"
            viewBox="0 0 24 24"
            fill="none"
            style={{ animation: "spin 1.2s linear infinite" }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"
                    strokeDasharray="20 40" strokeLinecap="round"/>
          </svg>
          <span className="text-[10px] text-gray-400 font-sans">Illustrating…</span>
        </div>
      ) : entry?.status === "model_loading" ? (
        // HF model is cold-starting — show a warm-up countdown
        <div className="w-full aspect-[4/3] bg-gray-100 flex flex-col items-center justify-center gap-2 select-none">
          <svg className="w-7 h-7 text-amber-400/70" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[10px] text-amber-500/80 font-sans tabular-nums">
            {retryIn > 0 ? `Model warming up… ${retryIn}s` : "Retrying…"}
          </span>
        </div>
      ) : entry?.status === "no_token" ? (
        // No HF token configured — grey placeholder, not an error
        <div className="w-full aspect-[4/3] bg-gray-50 flex flex-col items-center justify-center gap-1.5 select-none px-4">
          <svg className="w-8 h-8 text-gray-300" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M3 15l5-5 4 4 3-3 5 5" stroke="currentColor" strokeWidth="1.5"
                  strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
          <span className="text-[10px] text-gray-400 font-sans text-center leading-snug">
            Add HUGGINGFACE_TOKEN<br/>to enable illustrations
          </span>
        </div>
      ) : entry?.status === "failed" ? (
        <div className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-1 select-none"
             style={{ background: "repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 6px,#e5e7eb 6px,#e5e7eb 12px)" }}>
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
            <span className="ml-auto text-[9px] text-amber-400/60 font-sans animate-pulse">
              Illustrating…
            </span>
          )}
          {!isUser && entry?.status === "model_loading" && (
            <span className="ml-auto text-[9px] text-amber-500/70 font-sans tabular-nums">
              {retryIn > 0 ? `Warming up ${retryIn}s` : "Retrying…"}
            </span>
          )}
          {!isUser && entry?.status === "failed" && (
            <span className="ml-auto text-[9px] text-red-400/60 font-sans">No image</span>
          )}
          {!isUser && entry?.status === "no_token" && (
            <span className="ml-auto text-[9px] text-gray-500 font-sans">No HF token</span>
          )}
        </div>
        <p className="text-[12px] leading-snug text-white font-serif">{node.text}</p>
      </div>
    </div>
  );
}

// ─── Narrator voice resolver ──────────────────────────────────────────────────

const FEMALE_VOICE_KEYWORDS = [
  "samantha", "victoria", "karen", "moira", "veena",
  "tessa", "fiona", "allison", "ava", "susan",
  "zira", "hazel", "aria", "jenny", "ana",
];

function pickNarratorVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const lower = (v: SpeechSynthesisVoice) => v.name.toLowerCase();
  const english = voices.filter((v) => v.lang.startsWith("en"));
  const pool = english.length > 0 ? english : voices;
  for (const kw of FEMALE_VOICE_KEYWORDS) {
    const match = pool.find((v) => lower(v).includes(kw));
    if (match) return match;
  }
  return pool[0] ?? null;
}

function resolveNarratorVoice(): Promise<SpeechSynthesisVoice | null> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve(null);
  }
  const immediate = window.speechSynthesis.getVoices();
  if (immediate.length > 0) return Promise.resolve(pickNarratorVoice(immediate));

  return new Promise<SpeechSynthesisVoice | null>((resolve) => {
    const timeout = setTimeout(() => {
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

const CANVAS_W      = 480;
const IMG_H         = 360;  // 4:3 ratio for CANVAS_W=480
const CAPTION_H     = 80;
const PANEL_H       = IMG_H + CAPTION_H;
const TEXT_ONLY_H   = 160;
const TITLE_BLOCK_H = 90;
const PANEL_GAP     = 4;

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

  const panelHeights = path.map((node) => {
    if (node.authorType === "user") return PANEL_H;
    const entry = imageMap[node.id];
    return entry?.status === "ready" || entry?.status === "loading" || entry?.status === "model_loading"
      ? PANEL_H
      : TEXT_ONLY_H;
  });

  const totalH = topPad + panelHeights.reduce((s, h) => s + h + PANEL_GAP, 0) + 16;
  const canvas  = document.createElement("canvas");
  canvas.width  = CANVAS_W;
  canvas.height = totalH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, CANVAS_W, totalH);

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

  let yOffset = topPad;
  for (let i = 0; i < path.length; i++) {
    const node   = path[i];
    const entry  = imageMap[node.id];
    const isUser = node.authorType === "user";
    const panelH = panelHeights[i];
    const y      = yOffset;
    const border = isUser ? "#0d9488" : (TONE_BORDER[node.tone] ?? "#374151");

    ctx.strokeStyle = border;
    ctx.lineWidth   = 4;
    ctx.strokeRect(2, y + 2, CANVAS_W - 4, panelH - 4);

    if (isUser) {
      ctx.fillStyle = "#1c2432";
      ctx.fillRect(4, y + 4, CANVAS_W - 8, panelH - 8);
      ctx.fillStyle = "#0d9488";
      ctx.fillRect(4, y + 4, CANVAS_W - 8, 3);
    } else if (entry?.status === "ready" && entry.dataUrl) {
      const img = new window.Image();
      await new Promise<void>((res) => {
        img.onload  = () => { ctx.drawImage(img, 4, y + 4, CANVAS_W - 8, IMG_H - 8); res(); };
        img.onerror = () => res();
        img.src = entry.dataUrl;
      });
    } else if (!entry || entry.status === "loading" || entry.status === "model_loading") {
      ctx.fillStyle = "#111827";
      ctx.fillRect(4, y + 4, CANVAS_W - 8, IMG_H - 8);
      ctx.fillStyle = "#6b7280";
      ctx.font      = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Generating…", CANVAS_W / 2, y + 4 + (IMG_H - 8) / 2);
    }
    // failed / no_token → text-only (no image block)

    const textOnlyMode =
      !isUser && (entry?.status === "failed" || entry?.status === "no_token" || (!entry && panelH === TEXT_ONLY_H));
    const capY = textOnlyMode ? y + 4 : y + IMG_H;
    const capH = textOnlyMode ? panelH - 8 : CAPTION_H;

    ctx.fillStyle = textOnlyMode ? "#0d1117" : "#000";
    ctx.fillRect(4, capY, CANVAS_W - 8, capH);

    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font      = "bold 9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(i + 1).padStart(2, "0"), 12, capY + 16);

    const labelColor = isUser ? "#2dd4bf" : (border === "#1f2937" ? "#9ca3af" : border);
    ctx.fillStyle    = labelColor;
    ctx.font         = "bold 9px sans-serif";
    ctx.textAlign    = "left";
    ctx.fillText(isUser ? "YOUR WORDS" : node.tone.toUpperCase(), 36, capY + 16);

    ctx.fillStyle = "#fff";
    ctx.font      = textOnlyMode ? "14px serif" : "13px serif";
    ctx.textAlign = "left";
    wrapText(ctx, node.text, 12, capY + 32, CANVAS_W - 24, 18, textOnlyMode ? 6 : 3);

    yOffset += panelH + PANEL_GAP;
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `fairytalee-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export default function PathDrawer({ isOpen, activePath, styleDescription, onClose }: PathDrawerProps) {
  const pathText = pathToText(activePath);
  const pathKey  = activePath.map((n) => n.id).join(",");

  // ── Image state ──────────────────────────────────────────────────────────────
  const [imageMap, setImageMap] = useState<ImageMap>({});
  const [nowMs,    setNowMs]    = useState<number>(() => Date.now());
  const tickerRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Title state ───────────────────────────────────────────────────────────────
  const [titleState, setTitleState] = useState<TitleState>({
    status: "idle", title: "", tagline: "", forPathKey: "",
  });

  // ── TTS state ─────────────────────────────────────────────────────────────────
  const [ttsStatus,     setTtsStatus]     = useState<TtsStatus>("idle");
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const ttsAbortRef                       = useRef(false);

  // ── Panel refs for auto-scroll ────────────────────────────────────────────────
  const panelRefs = useRef<Array<React.RefObject<HTMLDivElement>>>([]);
  if (panelRefs.current.length !== activePath.length) {
    panelRefs.current = activePath.map(() =>
      ({ current: null }) as React.RefObject<HTMLDivElement>
    );
  }

  // ── updateEntry ───────────────────────────────────────────────────────────────
  const updateEntry = useCallback((id: string, patch: Partial<PanelEntry>) => {
    setImageMap((m) => ({
      ...m,
      [id]: { ...(m[id] ?? { status: "idle", dataUrl: "", retryAt: 0 }), ...patch },
    }));
  }, []);

  // ── 1-second ticker for model_loading countdown ───────────────────────────────
  useEffect(() => {
    const anyWaiting = Object.values(imageMap).some(
      (e) => e.status === "loading" || e.status === "model_loading"
    );
    if (anyWaiting) {
      if (!tickerRef.current) {
        tickerRef.current = setInterval(() => setNowMs(Date.now()), 1000);
      }
    } else {
      if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
    }
  }, [imageMap]);

  useEffect(() => () => { if (tickerRef.current) clearInterval(tickerRef.current); }, []);

  // ── Batch image kick-off (runs when drawer opens or path changes) ─────────────
  useEffect(() => {
    if (!isOpen || activePath.length === 0) return;
    const aiNodes = activePath.filter((n) => n.authorType !== "user");
    if (aiNodes.length === 0) return;

    setImageMap((prev) => {
      const toLoad: StoryNode[] = [];
      const next = { ...prev };
      for (const node of aiNodes) {
        if (!prev[node.id] || prev[node.id].status === "idle") {
          next[node.id] = { status: "idle", dataUrl: "", retryAt: 0 };
          toLoad.push(node);
        }
      }
      if (toLoad.length > 0) {
        setTimeout(() => {
          for (const node of toLoad) {
            fetchPanelImage(node, styleDescription, updateEntry);
          }
        }, 0);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pathKey, styleDescription]);

  // ── Title fetch (cached per pathKey) ──────────────────────────────────────────
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

  // ── Stop TTS when drawer closes ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      ttsAbortRef.current = true;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      setTtsStatus("idle");
      setSpeakingIndex(null);
    }
  }, [isOpen]);

  // ── TTS: speak all panels in order ────────────────────────────────────────────
  const handleSpeak = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    ttsAbortRef.current = false;
    setTtsStatus("speaking");

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

        const ref = panelRefs.current[idx];
        if (ref?.current) {
          ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        const utt   = new SpeechSynthesisUtterance(node.text);
        utt.rate    = 0.9;
        utt.pitch   = 0.9;
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

  // ── Download ──────────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    const t = titleState.status === "ready" ? titleState.title   : "";
    const q = titleState.status === "ready" ? titleState.tagline : "";
    await downloadComic(activePath, imageMap, t, q);
  }, [activePath, imageMap, titleState]);

  // ── Copy ──────────────────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(pathText); } catch { /* ignore */ }
  }, [pathText]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const aiNodeIds   = activePath.filter((n) => n.authorType !== "user").map((n) => n.id);
  const anyBuilding = aiNodeIds.some((id) => {
    const e = imageMap[id];
    return !e || e.status === "idle" || e.status === "loading" || e.status === "model_loading";
  });
  const settledCount = aiNodeIds.filter((id) => {
    const e = imageMap[id];
    return e?.status === "ready" || e?.status === "failed" || e?.status === "no_token";
  }).length;

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
              ) : (
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

              {/* Title / tagline block */}
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

              {/* Comic panels */}
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
