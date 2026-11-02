import React from "react";

// Bubblegum Pop: where each rising heart starts (left, size, seconds to rise, delay).
const HEARTS = [
  ["6%", 22, 17, 0],
  ["17%", 34, 22, -9],
  ["29%", 18, 15, -4],
  ["42%", 28, 20, -13],
  ["56%", 20, 16, -7],
  ["68%", 38, 24, -16],
  ["79%", 24, 18, -2],
  ["90%", 30, 21, -11],
];

/** Fixed theme backdrop. Each theme shows only its own props (see styles/stage.css). */
export function StageBackground() {
  return (
    <div className="stage-bg" aria-hidden="true">
      <span className="spot" />
      <span className="grain" />
      <span className="sky" />
      <span className="sun" />
      <span className="cloud-a" />
      <span className="cloud-b" />
      <span className="horizon" />
      <span className="floor" />
      <span className="scan" />
      <span className="dots" />
      <span className="tape-a" />
      <span className="tape-b" />
      <span className="hearts">
        {HEARTS.map(([x, s, d, dl], i) => (
          <i
            key={i}
            style={{
              "--x": x,
              "--s": `${s}px`,
              "--d": `${d}s`,
              "--dl": `${dl}s`,
            }}
          />
        ))}
      </span>
    </div>
  );
}
