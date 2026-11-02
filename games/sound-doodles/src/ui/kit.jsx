import React, { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../theme.js";

/* ---------- Buttons ---------- */
export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  className = "",
  children,
  disabled,
  ...rest
}) {
  return (
    <button
      type="button"
      {...rest}
      className={`btn btn-${variant} btn-${size} ${loading ? "is-loading" : ""} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <span className="btn-spinner" aria-hidden="true" />}
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ label, children, className = "", ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className={`btn-icon ${className}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

export function Badge({ tone = "accent", children, className = "" }) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}

/* ---------- Form controls ---------- */
export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`toggle ${disabled ? "is-disabled" : ""}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-label">{label}</span>
    </label>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  format,
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider">
      <span className="slider-head">
        {label}
        <b>{format ? format(value) : Math.round(value * 100) + "%"}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--pct": `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Stepper({ label, value, options, onChange, disabled }) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const step = (d) =>
    onChange(options[(index + d + options.length) % options.length].value);
  return (
    <div className="stepper" role="group" aria-label={label}>
      <span className="stepper-label">{label}</span>
      <div className="stepper-body">
        <IconButton
          label={`Previous ${label}`}
          disabled={disabled}
          onClick={() => step(-1)}
        >
          ‹
        </IconButton>
        <output aria-live="polite">{options[index].label}</output>
        <IconButton
          label={`Next ${label}`}
          disabled={disabled}
          onClick={() => step(1)}
        >
          ›
        </IconButton>
      </div>
    </div>
  );
}

export function Skeleton({
  width = "100%",
  height = 16,
  radius = 8,
  className = "",
}) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function Tooltip({ text, children }) {
  return (
    <span className="tooltip" data-tip={text}>
      {children}
    </span>
  );
}

/* ---------- Timer ring ---------- */
export function TimerRing({ seconds, total = 1, size = 64, label }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, seconds / Math.max(1, total)));
  const urgent = seconds <= 5 && seconds > 0;
  return (
    <div
      className={`timer-ring ${urgent ? "urgent" : ""}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={label || `${seconds} seconds left`}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle className="ring-track" cx="32" cy="32" r={r} />
        <circle
          className="ring-fill"
          cx="32"
          cy="32"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <b>{seconds}</b>
    </div>
  );
}

/* ---------- Audio-reactive visuals ---------- */
/** EQ bars. Pass `level` (0 to 1) for live voice, or `playing` for a looping playback visual. */
export function EQ({ level, playing = false, count = 24 }) {
  const live = typeof level === "number";
  return (
    <div className={`eq ${playing ? "playing" : ""}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const shape = 0.35 + Math.abs(Math.sin(i * 1.7)) * 0.65;
        return (
          <i
            key={i}
            style={{
              "--i": i,
              "--h": shape,
              ...(live
                ? { transform: `scaleY(${0.12 + level * shape * 1.6})` }
                : {}),
            }}
          />
        );
      })}
    </div>
  );
}

/* ---------- Numbers ---------- */
export function CountUp({ value, duration = 900, className = "" }) {
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) return setShown(value);
    let frame;
    const start = performance.now();
    const base = from.current;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(base + (value - base) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <span className={`count-up ${className}`}>{shown}</span>;
}
