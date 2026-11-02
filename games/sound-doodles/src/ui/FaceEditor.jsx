import React from "react";
import { ChevronLeft, ChevronRight, Shuffle } from "lucide-react";
import {
  COLORS,
  LABELS,
  formatLook,
  parseLook,
  randomLook,
  sizeOf,
} from "../../shared/looks.js";
import { Avatar } from "../components.jsx";
import { Button } from "./kit.jsx";
import { sfx } from "./sfx.js";

const ROWS = [
  ["shape", "Body"],
  ["eyes", "Eyes"],
  ["mouth", "Mouth"],
  ["hat", "Hat"],
  ["extra", "Extra"],
];

/** Builds a face: a live preview, a colour row and a stepper per feature. `value` is a look string. */
export function FaceEditor({ value, onChange }) {
  const look = parseLook(value) || parseLook(formatLook(randomLook()));
  const set = (patch) => {
    sfx("pop");
    onChange(formatLook({ ...look, ...patch }));
  };
  const step = (trait, d) => {
    const n = sizeOf(trait);
    set({ [trait]: (look[trait] + d + n) % n });
  };
  return (
    <div className="face-editor">
      <div className="face-stage">
        <Avatar kind={formatLook(look)} size={140} animated />
        <Button
          variant="ghost"
          size="sm"
          icon={<Shuffle size={16} />}
          onClick={() => {
            sfx("pop");
            onChange(formatLook(randomLook()));
          }}
        >
          Surprise me
        </Button>
      </div>
      <div className="face-controls">
        <div className="face-colors" role="radiogroup" aria-label="Body colour">
          {COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={look.color === i}
              aria-label={LABELS.color[i]}
              title={LABELS.color[i]}
              className={look.color === i ? "on" : ""}
              style={{ "--swatch": c }}
              onClick={() => set({ color: i })}
            />
          ))}
        </div>
        {ROWS.map(([trait, label]) => (
          <div className="face-row" key={trait}>
            <span className="face-label">{label}</span>
            <button
              type="button"
              aria-label={`Previous ${label.toLowerCase()}`}
              onClick={() => step(trait, -1)}
            >
              <ChevronLeft size={18} />
            </button>
            <output aria-label={label} className="face-value">
              {LABELS[trait][look[trait]]}
            </output>
            <button
              type="button"
              aria-label={`Next ${label.toLowerCase()}`}
              onClick={() => step(trait, 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
