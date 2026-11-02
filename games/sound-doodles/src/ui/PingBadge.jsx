import React from "react";

/** Live round-trip time to the game server, so slow buttons can be blamed on the network or on the app. */
export function PingBadge({ ping }) {
  const tone =
    ping === null ? "idle" : ping < 120 ? "good" : ping < 300 ? "ok" : "slow";
  const advice =
    ping === null
      ? "Measuring connection…"
      : ping < 120
        ? "Fast connection to the game server."
        : ping < 300
          ? "Decent connection. Each button waits about this long for the server."
          : "Slow connection to the game server. Wi-Fi or a closer server region will feel much snappier.";
  return (
    <span
      className={`ping ping-${tone}`}
      title={`${advice}${ping === null ? "" : ` (${ping} ms round trip)`}`}
      role="status"
    >
      <i aria-hidden="true" />
      <b>{ping === null ? "…" : `${ping} ms`}</b>
      <span className="sr-only">{advice}</span>
    </span>
  );
}
