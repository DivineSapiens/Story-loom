"use client";

import { useEffect, useState } from "react";

// ─── Reduced-motion hook ──────────────────────────────────────────────────────

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// ─── Bird SVG ─────────────────────────────────────────────────────────────────
// A simple gull "W" silhouette: two swept arcs from a centre point.
// The outer <g> carries the bird-drift animation; each wing path carries
// wing-flap independently with a slight phase offset.

interface BirdProps {
  /** Percentage from top of viewport, e.g. "8%" */
  top: string;
  /** Total crossing duration in seconds */
  duration: number;
  /** Negative delay so bird starts mid-journey on page load */
  delay: number;
}

function BirdSVG({ top, duration, delay }: BirdProps) {
  const driftStyle: React.CSSProperties = {
    position: "absolute",
    top,
    left: 0,
    animation: `bird-drift ${duration}s linear ${delay}s infinite`,
    // transform-origin for drift is left edge — SVG viewBox handles local coords
    willChange: "transform",
  };

  const leftWingStyle: React.CSSProperties = {
    animation: `wing-flap ${duration * 0.07}s ease-in-out 0s infinite`,
    transformOrigin: "12px 8px", // pivot at body centre
  };
  const rightWingStyle: React.CSSProperties = {
    animation: `wing-flap ${duration * 0.07}s ease-in-out -0.3s infinite`,
    transformOrigin: "12px 8px",
  };

  return (
    <div style={driftStyle} aria-hidden="true">
      {/* viewBox: 24×16, bird centred around (12, 8) */}
      <svg
        width={32}
        height={20}
        viewBox="0 0 24 16"
        fill="#fbbf24"
        opacity={0.18}
        xmlns="http://www.w3.org/2000/svg"
        overflow="visible"
      >
        {/* Left wing — sweeps up-left from body centre */}
        <path
          d="M12 8 Q7 3 0 5"
          stroke="#fbbf24"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
          style={leftWingStyle}
        />
        {/* Right wing — sweeps up-right from body centre */}
        <path
          d="M12 8 Q17 3 24 5"
          stroke="#fbbf24"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
          style={rightWingStyle}
        />
        {/* Body dot at centre */}
        <circle cx="12" cy="8" r="1.5" fill="#fbbf24" />
      </svg>
    </div>
  );
}

// ─── Bunny SVG ────────────────────────────────────────────────────────────────
// A minimal line-art bunny: body ellipse, head circle, two ears, tail dot.
// The outer <div> carries the bunny-hop animation.

interface BunnyProps {
  /** Percentage from bottom of viewport, e.g. "12%" */
  bottom: string;
  /** Total crossing duration in seconds */
  duration: number;
  /** Negative delay so bunny starts mid-journey on page load */
  delay: number;
}

function BunnySVG({ bottom, duration, delay }: BunnyProps) {
  const hopStyle: React.CSSProperties = {
    position: "absolute",
    bottom,
    left: 0,
    animation: `bunny-hop ${duration}s ease-in-out ${delay}s infinite`,
    willChange: "transform",
  };

  return (
    <div style={hopStyle} aria-hidden="true">
      {/* viewBox: 28×34 — bunny facing right, ~24px wide at render size */}
      <svg
        width={28}
        height={34}
        viewBox="0 0 28 34"
        fill="none"
        stroke="#a8a29e"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.20}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Body — squat ellipse */}
        <ellipse cx="14" cy="24" rx="9" ry="7" />
        {/* Head — small circle sat atop body */}
        <circle cx="19" cy="16" r="5" />
        {/* Left ear — tall thin oval */}
        <ellipse cx="16" cy="7" rx="2" ry="5" />
        {/* Right ear — slightly offset */}
        <ellipse cx="21" cy="6" rx="2" ry="5.5" />
        {/* Tail — small filled circle on rump */}
        <circle cx="5" cy="22" r="2" fill="#a8a29e" stroke="none" />
        {/* Eye — tiny dot */}
        <circle cx="21" cy="15" r="0.8" fill="#a8a29e" stroke="none" />
        {/* Front leg */}
        <path d="M21 29 Q23 32 24 34" />
        {/* Hind leg — slightly longer */}
        <path d="M10 29 Q8 32 6 34" />
      </svg>
    </div>
  );
}

// ─── BackgroundScene ──────────────────────────────────────────────────────────

/**
 * Decorative animated background layer for the landing screen.
 * Renders nothing when prefers-reduced-motion is active.
 * Must be placed inside a `position: relative` container; it is
 * absolutely positioned to fill it.
 */
export default function BackgroundScene() {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {/* ── Birds — upper third, amber-400, opacity 0.18 ────────────────── */}
      <BirdSVG top="8%"  duration={22} delay={0}   />
      <BirdSVG top="15%" duration={27} delay={-9}  />
      <BirdSVG top="22%" duration={32} delay={-18} />

      {/* ── Bunnies — lower portion, stone-400, opacity 0.20 ────────────── */}
      <BunnySVG bottom="12%" duration={18} delay={-4}  />
      <BunnySVG bottom="22%" duration={22} delay={-12} />
    </div>
  );
}
