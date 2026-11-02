import React from "react";
import { Check, Crown } from "lucide-react";
import { Avatar } from "../components.jsx";

/** Avatar is the personality: idle bob, blink, mouth follows the voice (--voice) when `reactive`, host crown, ready check, join pop. */
export function PlayerCard({
  player,
  isYou,
  isHost,
  status,
  ready,
  reactive = false,
  size = 84,
  index = 0,
  offline = false,
}) {
  return (
    <div
      className={`player-card ${isYou ? "you" : ""} ${ready ? "ready" : ""} ${offline ? "offline" : ""} ${reactive ? "speaking" : ""}`}
      style={{ "--i": index }}
    >
      <div className="player-figure">
        {isHost && (
          <span className="crown" title="Host" aria-label="Host">
            <Crown size={20} />
          </span>
        )}
        <span className="presence-ring" aria-hidden="true" />
        <Avatar
          kind={player.avatar}
          size={size}
          animated
          reactive={reactive}
          style={{ "--bob-delay": `${-(index * 0.7)}s` }}
        />
        {ready && (
          <span className="ready-pop" aria-label="Ready">
            <Check size={16} />
          </span>
        )}
      </div>
      <strong className="player-name">
        {player.name}
        {isYou && <small> you</small>}
      </strong>
      <span className="player-status">{status}</span>
    </div>
  );
}

/** "Waiting for friend 3…" placeholder that pulses until the minimum is reached. */
export function GhostSlot({ n, index = 0 }) {
  return (
    <div
      className="player-card ghost"
      style={{ "--i": index }}
      aria-hidden="true"
    >
      <div className="player-figure">
        <span className="ghost-avatar">?</span>
      </div>
      <strong className="player-name">Friend {n}</strong>
      <span className="player-status">Waiting…</span>
    </div>
  );
}
