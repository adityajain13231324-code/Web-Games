import React, { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Avatar } from "../components.jsx";
import { CountUp } from "./kit.jsx";
import { sfx } from "./sfx.js";

/** Private prompt card. It flips itself over after a beat; tap to hide it again if someone is peeking. */
export function FlipCard({ children, hint = "Your secret prompt" }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 650);
    return () => clearTimeout(t);
  }, []);
  return (
    <button
      type="button"
      className={`flip-card ${flipped ? "flipped" : ""}`}
      aria-pressed={flipped}
      aria-label={flipped ? "Hide the prompt" : "Reveal the prompt"}
      onClick={() => setFlipped((f) => !f)}
    >
      <span className="flip-inner">
        <span className="flip-face flip-front">
          <EyeOff size={28} aria-hidden="true" />
          <b>{hint}</b>
          <small>Tap to peek</small>
        </span>
        <span className="flip-face flip-back">
          <small>
            <Eye size={14} aria-hidden="true" /> Only you can see this
          </small>
          {children}
        </span>
      </span>
    </button>
  );
}

/** Big 3-2-1 driven by the server clock (seconds left in the prepare phase). */
export function CountdownOverlay({ seconds, label = "Going live in" }) {
  useEffect(() => {
    if (seconds > 0 && seconds <= 3) sfx("tick");
  }, [seconds]);
  if (seconds < 1 || seconds > 3) return null;
  return (
    <div className="countdown" role="status" aria-live="assertive">
      <span className="countdown-label">{label}</span>
      <b key={seconds}>{seconds}</b>
    </div>
  );
}

/** Winner podium (up to three) plus a ranked list for everyone else. Scores count up. */
export function Podium({ players }) {
  const ranked = [...players]
    .filter((p) => !p.spectator)
    .sort((a, b) => b.score - a.score)
    .map((p) => ({ ...p, rank: 1 }));
  ranked.forEach((p, i) => {
    p.rank = i && ranked[i - 1].score === p.score ? ranked[i - 1].rank : i + 1;
  });
  const top = ranked.slice(0, 3);
  // Visual order: 2nd, 1st, 3rd
  const order =
    top.length === 3
      ? [top[1], top[0], top[2]]
      : top.length === 2
        ? [top[1], top[0]]
        : top;
  const rest = ranked.slice(3);
  return (
    <div className="podium-wrap">
      <ol className="podium" aria-label="Final ranking">
        {order.map((p) => (
          <li
            key={p.id}
            className={`step rank-${p.rank}`}
            style={{ "--place": p.rank }}
          >
            <span className="podium-who">
              <Avatar kind={p.avatar} size={p.rank === 1 ? 92 : 68} animated />
              <strong>{p.name}</strong>
            </span>
            <span className="podium-block">
              <b className="podium-rank">{p.rank}</b>
              <span className="podium-score">
                <CountUp value={p.score} /> <small>pts</small>
              </span>
            </span>
          </li>
        ))}
      </ol>
      {rest.length > 0 && (
        <ul className="scoreboard rest">
          {rest.map((p) => (
            <li key={p.id}>
              <b>{p.rank}</b>
              <Avatar kind={p.avatar} size={40} />
              <strong>{p.name}</strong>
              <span>
                <CountUp value={p.score} /> <small>pts</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
