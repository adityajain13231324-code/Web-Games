import React from "react";
import { Check, LogOut } from "lucide-react";
import { Avatar } from "../components.jsx";

/** Who is playing right now: a scrolling strip of avatars with live status and score. Used during games. */
export function Cast({ state, onLeave }) {
  const statusOf = (p) =>
    !p.connected
      ? "Reconnecting…"
      : p.spectator
        ? "Spectating"
        : state.performers?.includes(p.id)
          ? "On the mic"
          : state.completed?.includes(p.id)
            ? "Submitted"
            : state.solved?.includes(p.id)
              ? "Got it!"
              : `${p.score} points`;
  const done = (p) =>
    state.completed?.includes(p.id) || state.solved?.includes(p.id);
  return (
    <aside className="cast" aria-label="Players">
      <div className="cast-list">
        {state.players.map((p, i) => (
          <div
            key={p.id}
            style={{ "--i": i }}
            className={`cast-chip ${p.id === state.you ? "you" : ""} ${!p.connected ? "offline" : ""} ${
              state.performers?.includes(p.id) ? "onmic" : ""
            } ${done(p) ? "done" : ""}`}
          >
            <span className="cast-figure">
              <Avatar kind={p.avatar} size={40} animated />
              {done(p) && (
                <span className="cast-check" aria-hidden="true">
                  <Check size={12} />
                </span>
              )}
            </span>
            <span className="cast-text">
              <strong>
                {p.name}
                {p.id === state.you && <small> you</small>}
                {p.id === state.host && (
                  <span title="Host" className="host-star">
                    {" "}
                    ✦
                  </span>
                )}
              </strong>
              <span>{statusOf(p)}</span>
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm cast-leave"
        onClick={onLeave}
      >
        <LogOut size={15} />
        Leave room
      </button>
    </aside>
  );
}
