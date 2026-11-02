import React, { useEffect, useMemo, useState } from "react";
import { prefersReducedMotion } from "../theme.js";
import { sfx } from "./sfx.js";

const PALETTE = [
  "var(--accent)",
  "var(--accent-2)",
  "var(--gold)",
  "var(--mint)",
  "var(--blue)",
  "var(--coral)",
];

/** One-shot confetti burst. CSS-only animation (transform and opacity), removed after it ends. */
export function Confetti({
  count = 40,
  spread = 360,
  duration = 2400,
  origin = "50% 40%",
  small = false,
  fixed = false,
}) {
  const [alive, setAlive] = useState(!prefersReducedMotion());
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle =
          (Math.random() * spread - spread / 2 - 90) * (Math.PI / 180);
        const dist = (small ? 50 : 90) + Math.random() * (small ? 70 : 220);
        return {
          i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          fall: 90 + Math.random() * 140,
          rot: Math.random() * 720 - 360,
          color: PALETTE[i % PALETTE.length],
          w: 6 + Math.random() * 6,
          delay: Math.random() * 90,
        };
      }),
    [count, spread, small],
  );
  useEffect(() => {
    const t = setTimeout(() => setAlive(false), duration + 200);
    return () => clearTimeout(t);
  }, [duration]);
  if (!alive) return null;
  return (
    <div
      className={`confetti ${fixed ? "fixed" : ""}`}
      aria-hidden="true"
      style={{
        "--origin-x": origin.split(" ")[0],
        "--origin-y": origin.split(" ")[1],
      }}
    >
      {pieces.map((p) => (
        <i
          key={p.i}
          style={{
            "--x": `${p.x}px`,
            "--y": `${p.y}px`,
            "--fall": `${p.fall}px`,
            "--rot": `${p.rot}deg`,
            "--dur": `${duration}ms`,
            background: p.color,
            width: p.w,
            height: p.w * 0.55,
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

/** Big 3-2-1. Each digit scales in and blurs out; ticks softly. Calls onDone after the last one. */
export function Countdown({ from = 3, onDone, label = "Get ready" }) {
  const [n, setN] = useState(from);
  useEffect(() => {
    sfx("tick");
    if (n <= 0) return onDone?.();
    const t = setTimeout(() => setN((x) => x - 1), 900);
    return () => clearTimeout(t);
  }, [n]);
  if (n <= 0) return null;
  return (
    <div
      className="countdown"
      role="status"
      aria-live="assertive"
      aria-label={`${label}: ${n}`}
    >
      <span className="countdown-label">{label}</span>
      <b key={n}>{n}</b>
    </div>
  );
}

/** Screen shake for big moments. Triggered by changing `token`. */
export function useShake(token) {
  useEffect(() => {
    if (!token || prefersReducedMotion()) return;
    const el = document.getElementById("root");
    el?.animate(
      [
        { transform: "translate(0,0)" },
        { transform: "translate(-4px,2px)" },
        { transform: "translate(3px,-2px)" },
        { transform: "translate(-2px,1px)" },
        { transform: "translate(0,0)" },
      ],
      { duration: 360, easing: "ease-out" },
    );
  }, [token]);
}
