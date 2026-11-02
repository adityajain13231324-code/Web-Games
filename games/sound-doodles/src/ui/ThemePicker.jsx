import React from "react";
import {
  Check,
  Cloud,
  Heart,
  Moon,
  PencilLine,
  Sunset,
  Zap,
} from "lucide-react";
import { Popover } from "./overlays.jsx";
import { THEME_LIST } from "../theme.js";

// Each place has its own little emblem, so the choice is something you want to tap.
const EMBLEM = {
  paper: PencilLine,
  midnight: Moon,
  neon: Zap,
  sunset: Sunset,
  sky: Cloud,
  pop: Heart,
};

/** The header button: four colour dots (one per place) and a label, with a gentle wiggle that invites a click. */
function ThemeButton({ theme, onClick, props, open }) {
  const Current = EMBLEM[theme] || PencilLine;
  return (
    <button
      type="button"
      className={`theme-button ${open ? "open" : ""}`}
      aria-label="Change theme"
      title="Change theme"
      onClick={onClick}
      {...props}
    >
      <span className="theme-dots" aria-hidden="true">
        {THEME_LIST.map((t) => (
          <i
            key={t.key}
            data-theme={t.key}
            className={t.key === theme ? "on" : ""}
          />
        ))}
      </span>
      <Current size={18} aria-hidden="true" className="theme-current" />
      <span className="theme-label">Theme</span>
    </button>
  );
}

/** Four LIVE mini-previews: each swatch is scoped with its own data-theme, so it renders the real tokens. */
export function ThemePicker({ theme, onChange }) {
  return (
    <Popover
      label="Choose a theme"
      trigger={({ open, toggle, props }) => (
        <ThemeButton theme={theme} onClick={toggle} props={props} open={open} />
      )}
    >
      {(close) => (
        <div className="theme-picker">
          <h3>Pick a place</h3>
          <p className="theme-picker-sub">Only changes your screen.</p>
          <div className="theme-picker-grid">
            {THEME_LIST.map(({ key, name, blurb }) => {
              const Icon = EMBLEM[key];
              return (
                <button
                  key={key}
                  type="button"
                  data-theme={key}
                  className={`theme-swatch ${theme === key ? "selected" : ""}`}
                  aria-pressed={theme === key}
                  onClick={() => {
                    onChange(key);
                    close();
                  }}
                >
                  <span className="swatch-stage">
                    <span className="swatch-emblem">
                      <Icon size={22} />
                    </span>
                    <span className="swatch-card">
                      <i className="swatch-line" />
                      <i className="swatch-line short" />
                    </span>
                    <span className="swatch-btn">Aa</span>
                    {theme === key && (
                      <span className="swatch-check" aria-hidden="true">
                        <Check size={14} />
                      </span>
                    )}
                  </span>
                  <span className="swatch-name">{name}</span>
                  <small>{blurb}</small>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Popover>
  );
}
