import React from "react";
import { Check } from "lucide-react";
import { ModeArt } from "./ModeArt.jsx";
import { Badge } from "./kit.jsx";
import { sfx } from "./sfx.js";

const TAGS = { classic: "FAN FAVORITE", gartic: "THE BIG REVEAL" };

/** A chunky "game poster" for a mode: art, tag, tilt on hover, squish on press, pulsing ring when selected. */
export function Poster({
  modeKey,
  mode,
  selected,
  disabled,
  onSelect,
  compact = false,
  index = 0,
  className = "",
}) {
  return (
    <button
      type="button"
      className={`poster poster-${modeKey} ${selected ? "selected" : ""} ${compact ? "compact" : ""} ${className}`}
      style={{ "--i": index }}
      disabled={disabled}
      aria-pressed={selected}
      onClick={() => {
        sfx("pop");
        onSelect?.(modeKey);
      }}
    >
      <span className="poster-art">
        <ModeArt mode={modeKey} />
      </span>
      <span className="poster-body">
        {TAGS[modeKey] && <Badge>{TAGS[modeKey]}</Badge>}
        <strong className="poster-title">{mode.name}</strong>
        <span className="poster-desc">{mode.description}</span>
        <small className="poster-meta">{mode.min}–8 players</small>
      </span>
      {selected && (
        <span className="poster-check" aria-hidden="true">
          <Check size={18} />
        </span>
      )}
    </button>
  );
}
