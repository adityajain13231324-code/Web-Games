import React, { useState } from "react";
import { ArrowRight, Check, Eye } from "lucide-react";
import { PlayerAudio } from "./components.jsx";

const AWARD_LABELS = {
  funniest: "Funniest transformation",
  bestSound: "Best sound performance",
  unexpected: "Most unexpected interpretation",
  accurate: "Most surprisingly accurate chain",
};
const startedAs = (chain) => chain?.entries[0]?.text || "a mystery";

export function Awards({ state: s, action, session }) {
  const [picks, setPicks] = useState({});
  const [error, setError] = useState("");
  const name = (id) => s.players.find((p) => p.id === id)?.name || "Someone";
  if (!s.participant)
    return (
      <section className="game-stage">
        <Eye className="stage-icon" />
        <h1>The awards are being decided.</h1>
        <p>You’re spectating. Results are coming up next.</p>
      </section>
    );
  if (s.awardsVoted)
    return (
      <section className="game-stage">
        <Check className="stage-icon" />
        <h1>Your picks are in.</h1>
        <p>Waiting for everyone else. Results arrive when all votes are in.</p>
      </section>
    );
  const sounds = s.awardChains.flatMap((c) =>
    c.entries.filter((e) => e.audioId).map((e) => ({ ...e, chain: c })),
  );
  const pick = (key, value) =>
    setPicks((p) => ({ ...p, [key]: p[key] === value ? undefined : value }));
  return (
    <section className="game-stage awards-stage">
      <span className="eyebrow">FRIENDLY AWARDS</span>
      <h1>Hand out some tiny trophies.</h1>
      <p>
        Pick as many or as few as you like. You can’t vote for your own work.
      </p>
      {["funniest", "unexpected", "accurate"].map((key) => (
        <fieldset key={key} className="award-group">
          <legend>{AWARD_LABELS[key]}</legend>
          <div className="award-options">
            {s.awardChains.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`award-option ${picks[key] === c.id ? "chosen" : ""}`}
                disabled={c.own}
                aria-pressed={picks[key] === c.id}
                onClick={() => pick(key, c.id)}
              >
                <small>{name(c.owner)}’s chain</small>
                <span>Started as “{startedAs(c)}”</span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <fieldset className="award-group">
        <legend>{AWARD_LABELS.bestSound}</legend>
        <div className="award-sounds">
          {sounds.map((e) => (
            <div
              key={e.ref}
              className={`award-sound ${picks.bestSound === e.ref ? "chosen" : ""}`}
            >
              <PlayerAudio
                audioId={e.audioId}
                session={session}
                label="Play this sound"
              />
              <button
                type="button"
                className="button subtle"
                disabled={e.own}
                aria-pressed={picks.bestSound === e.ref}
                onClick={() => pick("bestSound", e.ref)}
              >
                {e.own
                  ? "Yours"
                  : picks.bestSound === e.ref
                    ? "Chosen"
                    : "Pick"}
              </button>
            </div>
          ))}
        </div>
      </fieldset>
      {error && <p className="error">{error}</p>}
      <button
        className="button primary large"
        onClick={() =>
          action("award", {
            picks: Object.fromEntries(
              Object.entries(picks).filter(([, v]) => v),
            ),
          }).catch((e) => setError(e.message))
        }
      >
        Send my picks <ArrowRight size={20} />
      </button>
    </section>
  );
}

export function AwardsResult({ state: s, session }) {
  const name = (id) => s.players.find((p) => p.id === id)?.name || "Someone";
  const byRef = Object.fromEntries(
    s.awardChains.flatMap((c) => c.entries.map((e) => [e.ref, e])),
  );
  const byChain = Object.fromEntries(s.awardChains.map((c) => [c.id, c]));
  return (
    <div className="award-results">
      {s.awards.map((a) => (
        <div key={a.key} className="award-card">
          <small>{AWARD_LABELS[a.key]}</small>
          {a.winners.length === 0 ? (
            <span className="muted">No votes this time</span>
          ) : (
            a.winners.map((w) =>
              a.key === "bestSound" ? (
                <div key={w}>
                  <strong>{name(byRef[w]?.author)}</strong>
                  <PlayerAudio
                    audioId={byRef[w]?.audioId}
                    session={session}
                    label="Play the winning sound"
                  />
                </div>
              ) : (
                <strong key={w}>
                  {name(byChain[w]?.owner)}’s chain: “{startedAs(byChain[w])}”
                </strong>
              ),
            )
          )}
        </div>
      ))}
    </div>
  );
}
