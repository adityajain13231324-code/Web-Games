import React, { useState } from "react";
import { Avatar, PlayerAudio } from "../components.jsx";
import { Check, Eye, MoveDown, MoveUp } from "lucide-react";

export function Voting({ state: s, act, action, session }) {
  const [order, setOrder] = useState(
    s.entries?.filter((e) => !e.own).map((e) => e.id) || [],
  );
  const [favorite, setFavorite] = useState(null);
  const mode = s.settings.mode;
  if (!s.participant)
    return (
      <section className="game-stage">
        <Eye className="stage-icon" />
        <h1>The votes are coming in.</h1>
        <p>You’re spectating. The results are coming up next.</p>
      </section>
    );
  if (s.voted)
    return (
      <section className="game-stage">
        <Check className="stage-icon" />
        <h1>Your vote is in.</h1>
        <p>Everyone’s vote will be revealed together.</p>
      </section>
    );
  const move = (i, delta) => {
    const arr = [...order];
    [arr[i], arr[i + delta]] = [arr[i + delta], arr[i]];
    setOrder(arr);
  };
  return (
    <section className="game-stage voting-stage">
      <span className="eyebrow">TRUST YOUR EARS</span>
      <h1>
        {mode === "detective"
          ? "Who’s winging it?"
          : mode === "ranking"
            ? "Put your favorites in order."
            : "Which take stole the scene?"}
      </h1>
      <p>
        {mode === "detective"
          ? "Vote privately. A tie or abstention does not identify an outsider."
          : mode === "ranking"
            ? "Best at the top. You cannot rank your own recording."
            : "One favorite. No self-votes. Ties share the spotlight."}
      </p>
      {mode === "detective" ? (
        <>
          <div className="vote-players">
            {s.players
              .filter((p) => !p.spectator && p.id !== s.you)
              .map((p) => (
                <button
                  className={favorite === p.id ? "selected" : ""}
                  key={p.id}
                  onClick={() => setFavorite(p.id)}
                >
                  <Avatar kind={p.avatar} />
                  {p.name}
                </button>
              ))}
          </div>
          <button
            className="button primary"
            onClick={() => act("vote", { target: favorite })}
          >
            {favorite ? "Lock my vote" : "Abstain"}
            <Check size={17} />
          </button>
        </>
      ) : (
        <>
          <div className="rank-list">
            {order.map((id, i) => {
              const e = s.entries.find((e) => e.id === id);
              return (
                <div key={id} className={favorite === id ? "selected" : ""}>
                  {mode === "ranking" ? (
                    <b>{i + 1}</b>
                  ) : (
                    <input
                      type="radio"
                      aria-label={`Vote for ${e.label}`}
                      name="favorite"
                      checked={favorite === id}
                      onChange={() => setFavorite(id)}
                    />
                  )}
                  <div>
                    <strong>{e.label}</strong>
                    <PlayerAudio audioId={e.audioId} session={session} />
                  </div>
                  {mode === "ranking" && (
                    <div className="rank-arrows">
                      <button
                        className="icon-button"
                        aria-label={`Move ${e.label} up`}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <MoveUp size={17} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Move ${e.label} down`}
                        disabled={i === order.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <MoveDown size={17} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!order.length && (
            <p>No other recordings were submitted. You can abstain.</p>
          )}
          <button
            className="button primary"
            onClick={() =>
              act("vote", {
                ranking:
                  mode === "ranking" ? order : favorite ? [favorite] : [],
              })
            }
          >
            {mode === "ranking"
              ? "Lock this ranking"
              : favorite
                ? "Lock my vote"
                : "Abstain"}
            <Check size={17} />
          </button>
        </>
      )}
    </section>
  );
}
