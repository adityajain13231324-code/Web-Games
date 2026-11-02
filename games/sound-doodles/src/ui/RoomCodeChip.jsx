import React, { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Confetti } from "./fx.jsx";
import { sfx } from "./sfx.js";

/** Room ticket: big code, copy morphs into a check with a mini confetti pop, share when the device supports it. */
export function RoomCodeChip({ code, onNotify }) {
  const [copied, setCopied] = useState(0);
  const link = `${location.origin}/?room=${code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      onNotify?.("Invite link copied. Send it to your friends.");
    } catch {
      onNotify?.(`Invite friends using room code ${code}.`);
    }
    sfx("success");
    setCopied((n) => n + 1);
    setTimeout(() => setCopied((n) => (n ? 0 : n)), 1800);
  };
  const share = async () => {
    try {
      await navigator.share({
        title: "Sound Doodles",
        text: `Join my room ${code}`,
        url: link,
      });
    } catch {
      /* cancelled */
    }
  };
  return (
    <div className="ticket">
      <span className="ticket-label">ROOM CODE</span>
      <div className="ticket-code" aria-label={`Room code ${code}`}>
        {code.split("").map((c, i) => (
          <b key={i} style={{ "--i": i }}>
            {c}
          </b>
        ))}
      </div>
      <div className="ticket-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm invite"
          onClick={copy}
        >
          <span className={`morph ${copied ? "done" : ""}`} aria-hidden="true">
            <Copy size={16} className="m-copy" />
            <Check size={16} className="m-check" />
          </span>
          {copied ? "Copied" : "Invite friends"}
          {copied > 0 && (
            <Confetti
              key={copied}
              count={18}
              small
              origin="30% 50%"
              duration={1100}
            />
          )}
        </button>
        {typeof navigator.share === "function" && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={share}
          >
            <Share2 size={16} />
            Share
          </button>
        )}
      </div>
    </div>
  );
}
