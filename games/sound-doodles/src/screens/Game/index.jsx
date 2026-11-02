import React, { useEffect, useState } from "react";
import {
  Avatar,
  Foley,
  PlayerAudio,
  Recorder,
  Wave,
} from "../../components.jsx";
import { mic } from "../../audio.js";
import { GuessBox } from "../../GuessBox.jsx";
import { Awards, AwardsResult } from "../../Awards.jsx";
import { LiveMeter } from "./LiveMeter.jsx";
import { TextAction } from "../../ui/TextAction.jsx";
import { FlipCard, Podium } from "../../ui/ceremony.jsx";
import { Confetti, useShake } from "../../ui/fx.jsx";
import { Voting } from "../Voting.jsx";
import { SeedScreen } from "../SeedScreen.jsx";
import {
  ArrowRight,
  Check,
  Clock,
  Eye,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";

export function Game({ state: s, me, session, host, act, action, upload }) {
  const mode = s.settings.mode,
    phase = s.phase;
  const performer = s.performerIds?.includes(s.you),
    person = (id) => s.players.find((p) => p.id === id);
  const [foleyPlay, setFoleyPlay] = useState(0);
  // In Classic everyone takes a turn, so a performer who skipped the mic check is asked for the mic
  // while choosing a word, not in the middle of their performance.
  const warmMic =
    mode === "classic" && performer && ["choose", "prepare"].includes(phase);
  useEffect(() => {
    if (warmMic) mic.acquire().catch(() => {});
  }, [warmMic, s.phaseId]);
  useEffect(() => {
    if (phase === "roundReveal" || phase === "results") mic.stop();
  }, [phase]);
  useShake(phase === "results" ? s.phaseId : 0);
  const next = (
    <button className="button primary" onClick={() => act("next")}>
      Next
      <ArrowRight size={18} />
    </button>
  );
  if (phase === "results")
    return (
      <section className="results-stage">
        <Confetti fixed count={90} origin="50% 28%" duration={3200} />
        <span className="eyebrow">THAT WAS BEAUTIFULLY RIDICULOUS</span>
        <div className="results-art">
          <Avatar kind="star" size={130} />
          <Sparkles size={36} />
        </div>
        <h1>
          {mode === "gartic"
            ? "You made quite a story."
            : "A round of applause."}
        </h1>
        <p>
          {mode === "gartic"
            ? "One little prompt. So many questionable interpretations."
            : "Good sounds. Bad impressions. Very good company."}
        </p>
        {mode === "gartic" && s.awards && (
          <AwardsResult state={s} session={session} />
        )}
        {mode !== "gartic" && <Podium players={s.players} />}
        {host ? (
          <button className="button primary large" onClick={() => act("again")}>
            <RotateCcw size={20} />
            Play again
          </button>
        ) : (
          <p className="notice">
            The host can bring everyone back for another game.
          </p>
        )}
        <p className="small muted">
          Play Again deletes this match’s recordings.
        </p>
      </section>
    );
  if (phase === "chainReveal") {
    const chain = s.chain,
      owner = person(chain.owner),
      complete = chain.entries.length === chain.total,
      last = chain.entries.at(-1);
    return (
      <section className="chain-show">
        <span className="eyebrow">
          THE BIG REVEAL · CHAIN {s.revealChain + 1} / {s.chainCount}
        </span>
        <h1>It started with {owner?.name}.</h1>
        <p>Let’s hear where this little idea went.</p>
        <div className="chain-timeline">
          {chain.entries.map((e, i) => (
            <article
              key={i}
              className={`chain-entry ${i === chain.entries.length - 1 ? "latest" : ""}`}
            >
              <div className="chain-node">
                <Avatar kind={person(e.author)?.avatar} size={43} />
              </div>
              <div className="chain-entry-content">
                <span className="eyebrow">
                  {i === 0
                    ? "THE ORIGINAL IDEA"
                    : e.type === "audio"
                      ? "MADE IT SOUND LIKE"
                      : e.type === "text"
                        ? "HEARD IT AS"
                        : "A LITTLE GAP"}{" "}
                  · {person(e.author)?.name}
                </span>
                {e.type === "text" ? (
                  <h2>“{e.text}”</h2>
                ) : e.type === "audio" ? (
                  <PlayerAudio
                    audioId={e.audioId}
                    session={session}
                    auto={i === chain.entries.length - 1}
                    replay={s.replay}
                  />
                ) : (
                  <p className="muted">
                    {e.reason}. The next player received the labeled replacement
                    “A squeaky door”.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
        {complete && (
          <div className="chain-comparison">
            <div>
              <span>STARTED AS</span>
              <strong>{chain.entries[0].text}</strong>
            </div>
            <ArrowRight />
            <div>
              <span>
                {last.type === "audio" ? "ENDED WITH THIS SOUND" : "ENDED AS"}
              </span>
              {last.type === "text" ? (
                <strong>{last.text}</strong>
              ) : last.type === "audio" ? (
                <PlayerAudio audioId={last.audioId} session={session} />
              ) : (
                <strong>A missing contribution</strong>
              )}
            </div>
          </div>
        )}
        <div className="host-controls">
          {host ? (
            <>
              <button className="button outline" onClick={() => act("replay")}>
                <RotateCcw size={16} />
                Replay
              </button>
              <button
                className="button primary"
                onClick={() => act(complete ? "nextChain" : "next")}
              >
                {complete
                  ? s.revealChain + 1 === s.chainCount
                    ? "Finish the show"
                    : "Next chain"
                  : "Reveal next step"}
                <ArrowRight size={17} />
              </button>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={s.autoplay}
                  onChange={(e) =>
                    act("autoplay", { enabled: e.target.checked })
                  }
                />
                Autoplay · 12s per step
              </label>
            </>
          ) : (
            <span className="muted">
              The host is running the reveal. Settle in.
            </span>
          )}
        </div>
      </section>
    );
  }
  if (phase === "roundReveal")
    return (
      <section className="game-stage">
        <span className="eyebrow">THE REVEAL</span>
        <Trophy className="stage-icon" />
        <h1>{s.answer || "Give your favorites some love."}</h1>
        {mode === "detective" ? (
          <>
            <p>
              The outsider was{" "}
              <strong>{person(s.voteResult.outsider)?.name}</strong>.
            </p>
            <p>
              {s.voteResult.caught
                ? "The room caught them!"
                : s.voteResult.tie
                  ? "A tied vote. Nobody was caught."
                  : "They slipped through the vote."}{" "}
              {s.voteResult.escaped
                ? "Their final guess was correct."
                : "Their final guess did not match."}
            </p>
            <p className="quote">
              Final guess: {s.outsiderGuess || "No guess"}
            </p>
            <div className="vote-summary">
              {Object.entries(s.voteResult.ballots).map(([id, b]) => (
                <p key={id}>
                  {person(id)?.name} →{" "}
                  {b.target ? person(b.target)?.name : "Abstained"}
                </p>
              ))}
            </div>
          </>
        ) : ["foley", "ranking"].includes(mode) ? (
          <div className="recording-results">
            {s.voteResult?.length ? (
              s.voteResult.map((e, i) => (
                <div key={e.id}>
                  <Avatar kind={person(e.author)?.avatar} />
                  <div>
                    <strong>
                      {e.label} · {person(e.author)?.name}
                    </strong>
                    <p>
                      {e.points} points{" "}
                      {e.points === s.voteResult[0]?.points
                        ? "· Shared spotlight"
                        : ""}
                    </p>
                    <PlayerAudio session={session} audioId={e.audioId} />
                  </div>
                </div>
              ))
            ) : (
              <p>No sounds were submitted this round. Let’s try again.</p>
            )}
          </div>
        ) : (
          <>
            <p>
              {s.solved.length
                ? `${s.solved.length} friend${s.solved.length === 1 ? "" : "s"} cracked it.`
                : "Sometimes the weirdest sounds are the hardest to guess."}
            </p>
            <div className="solvers">
              {s.solved.map((id) => (
                <span key={id}>
                  <Avatar kind={person(id)?.avatar} size={40} />
                  {person(id)?.name}
                  <b>+{s.awarded[id]}</b>
                </span>
              ))}
            </div>
          </>
        )}
        {host ? (
          next
        ) : (
          <p className="muted">Waiting for the host to continue…</p>
        )}
      </section>
    );
  if (
    phase === "handoff" ||
    (s.submitted && ["record", "interpret", "seed"].includes(phase))
  )
    return (
      <section className="game-stage">
        <div className="done-orb">
          <Check size={44} />
        </div>
        <span className="eyebrow">SAFE IN THE MIX</span>
        <h1>Beautifully done.</h1>
        <p>
          {phase === "handoff"
            ? "Passing the sounds around…"
            : "Your contribution is locked. Let the others do their thing."}
        </p>
        <div className="completion-dots">
          {s.players
            .filter((p) => !p.spectator)
            .map((p) => (
              <span
                key={p.id}
                className={s.completed.includes(p.id) ? "complete" : ""}
              >
                <Avatar kind={p.avatar} size={45} />
                {s.completed.includes(p.id) ? (
                  <Check size={14} />
                ) : (
                  <Clock size={14} />
                )}
              </span>
            ))}
        </div>
        <p className="muted">{s.completed.length} submissions received</p>
      </section>
    );
  if (!s.participant && !["listening", "perform", "vote"].includes(phase))
    return (
      <section className="game-stage">
        <Eye className="stage-icon" />
        <h1>A front-row seat.</h1>
        <p>
          You’re spectating this match. Join a player seat in the next lobby.
        </p>
      </section>
    );
  if (phase === "choose")
    return (
      <section className="game-stage">
        <span className="eyebrow">
          {performer ? "YOU’RE UP" : "THE NEXT SOUND IS BREWING"}
        </span>
        <h1>
          {performer
            ? "What’s your noise?"
            : `${person(s.performerIds[0])?.name} is choosing.`}
        </h1>
        <p>
          {performer
            ? "Pick whichever feels easiest. You’ll get five seconds to compose yourself."
            : "Get your ears ready. There’s no telling what’s coming."}
        </p>
        {performer ? (
          <>
            <div className="prompt-choices">
              {s.choices.map((p) => (
                <button
                  key={p.id}
                  onClick={() => act("pick", { promptId: p.id })}
                >
                  <span className={`diff diff-${p.difficulty}`}>
                    <b>{(p.difficulty || "easy").toUpperCase()}</b>
                    {p.category && <i> · {p.category}</i>}
                  </span>
                  <strong>{p.phrase}</strong>
                  <ArrowRight size={20} />
                </button>
              ))}
            </div>
            {s.settings.shuffles > 0 && (
              <button
                className="text-button"
                disabled={s.skips >= s.settings.shuffles}
                onClick={() => act("skipPrompt")}
              >
                <RotateCcw size={15} />
                {s.skips >= s.settings.shuffles
                  ? "No shuffles left"
                  : s.settings.shuffles === 1
                    ? "Shuffle once"
                    : `Shuffle words (${s.settings.shuffles - s.skips} left)`}
              </button>
            )}
            <button className="text-button" onClick={() => act("pass")}>
              Pass this turn
            </button>
          </>
        ) : (
          <Wave decorative />
        )}
      </section>
    );
  if (phase === "prepare")
    return (
      <section className="game-stage">
        <span className="eyebrow">FIVE SECONDS TO FIND YOUR INNER WEIRDO</span>
        {performer && mode !== "detective" ? (
          <FlipCard>
            <h1>{s.prompt}</h1>
          </FlipCard>
        ) : (
          <h1>
            {mode === "detective"
              ? s.outsider
                ? "You’re the outsider."
                : s.prompt
              : "Get ready to listen."}
          </h1>
        )}
        <p>
          {mode === "detective"
            ? s.outsider
              ? "Listen to the others. Blend in. You’ll get one final guess."
              : "Everyone has this prompt except one secret outsider."
            : performer
              ? "Your microphone goes live when the countdown ends. No words, just the sound."
              : "Guess quickly for more points. Your guesses stay private."}
        </p>
        <div className="prepare-art">
          <Avatar kind={me.avatar} size={130} />
        </div>
        {performer && (
          <button className="text-button" onClick={() => act("pass")}>
            Pass this turn
          </button>
        )}
      </section>
    );
  if (phase === "perform") {
    const onMic = s.performers.includes(s.you);
    return (
      <section className="game-stage">
        <span className="eyebrow">
          <span className="status-dot" />
          {onMic ? "YOU’RE LIVE" : "LISTEN CLOSELY"}
        </span>
        <h1>
          {mode === "detective"
            ? onMic
              ? "Your turn to blend in."
              : `${person(s.performers[0])?.name} is making a sound.`
            : onMic
              ? s.prompt
              : "What on earth is that?"}
        </h1>
        <div className="performer-avatars">
          {s.performers.map((id) => (
            <div key={id} className={id === s.you ? "self" : "perf"}>
              <Avatar
                kind={person(id)?.avatar}
                size={110}
                animated
                reactive={id === s.you}
              />
              <strong>{person(id)?.name}</strong>
            </div>
          ))}
        </div>
        {onMic ? (
          <>
            <LiveMeter />
            <p>Hum, whistle, clap, squeak. No spoken clues.</p>
            <button className="text-button" onClick={() => act("pass")}>
              Finish / pass
            </button>
          </>
        ) : mode === "detective" ? (
          <p>
            {s.outsider
              ? "You’re the outsider. Listen for a clue."
              : s.prompt
                ? `Your shared prompt: ${s.prompt}`
                : "Watch closely. Who seems out of place?"}
          </p>
        ) : !s.participant ? (
          <p>
            Enjoy the performance. Guessing opens when you join a player seat
            next match.
          </p>
        ) : s.progress?.correct ? (
          <div className="correct-answer">
            <Check size={28} />
            <h2>You got it!</h2>
            <p>Your answer is hidden. Let the others figure it out.</p>
          </div>
        ) : (
          <>
            {s.hint && <p className="hint">A small hint: {s.hint}</p>}
            {s.progress?.total > 0 && (
              <p className="component-progress">
                {s.progress.components.length} / {s.progress.total} parts
                discovered
              </p>
            )}
            <GuessBox
              progress={s.progress}
              onGuess={(text) => action("guess", { text })}
            />
          </>
        )}
      </section>
    );
  }
  if (phase === "seed")
    return <SeedScreen state={s} action={action} act={act} />;
  if (phase === "record")
    return (
      <section className="game-stage recording-stage">
        <span className="eyebrow">
          {mode === "gartic"
            ? "TURN THESE WORDS INTO A SOUND"
            : mode === "foley"
              ? "GIVE THIS MOMENT A SOUNDTRACK"
              : "SAME PROMPT. YOUR OWN TAKE."}
        </span>
        <h1>
          {s.task?.text ||
            s.prompt ||
            (mode === "foley"
              ? "Five seconds of movie magic."
              : "Make your masterpiece.")}
        </h1>
        {s.task?.replacement && (
          <p className="notice">
            The previous contribution was missing. This is a replacement prompt.
          </p>
        )}
        {mode === "foley" && (
          <>
            <Foley scene={s.animation} playing playKey={foleyPlay} />
            <button
              className="text-button"
              onClick={() => setFoleyPlay((k) => k + 1)}
            >
              <Play size={16} />
              Replay silent scene
            </button>
          </>
        )}
        <Recorder
          maxSeconds={mode === "foley" ? 5 : 10}
          onSubmit={upload}
          onMic={(ready) => act("mic", { mic: ready })}
        />
        <button className="text-button" onClick={() => act("pass")}>
          Can’t record? Pass this step
        </button>
        <p className="small muted">
          Preview and retry as much as you like. Submit locks your take.
        </p>
      </section>
    );
  if (phase === "interpret")
    return (
      <section className="game-stage">
        <span className="eyebrow">EARS FIRST. IMAGINATION SECOND.</span>
        <h1>What did you just hear?</h1>
        <p>Listen again. Trust your weirdest best guess.</p>
        {s.task?.audioId ? (
          <PlayerAudio session={session} audioId={s.task.audioId} auto />
        ) : (
          <p className="notice">
            The sound is missing. Use the replacement prompt: {s.task?.text}
          </p>
        )}
        <TextAction
          label="Your interpretation"
          placeholder="A spaceship with hiccups?"
          onSubmit={(text) => action("submit", { text })}
        />
        <button className="text-button" onClick={() => act("pass")}>
          Pass this step
        </button>
      </section>
    );
  if (phase === "listening") {
    const entry = s.entries.at(-1);
    return (
      <section className="game-stage">
        <span className="eyebrow">THE ANONYMOUS LISTENING PARTY</span>
        <h1>{entry?.label || "Sound check"}</h1>
        <p>
          Listen to every take before you vote. Familiar voices may still be
          recognizable.
        </p>
        {mode === "foley" && (
          <Foley
            scene={s.animation}
            playing={foleyPlay > 0}
            playKey={foleyPlay}
          />
        )}
        <PlayerAudio
          session={session}
          audioId={entry.audioId}
          auto
          replay={s.replay}
          onPlay={() => setFoleyPlay((k) => k + 1)}
        />
        {host ? (
          <div className="host-controls">
            <button className="button outline" onClick={() => act("replay")}>
              <RotateCcw size={16} />
              Replay
            </button>
            {next}
          </div>
        ) : (
          <p className="muted">The host is moving through the sounds.</p>
        )}
      </section>
    );
  }
  if (phase === "awards")
    return <Awards state={s} action={action} session={session} />;
  if (phase === "vote")
    return <Voting state={s} act={act} action={action} session={session} />;
  if (phase === "outsider")
    return (
      <section className="game-stage">
        <span className="eyebrow">ONE LAST CHANCE</span>
        <h1>
          {s.outsider
            ? "What was the mystery sound?"
            : "The outsider gets a final guess."}
        </h1>
        <p>The votes are locked. No more clues.</p>
        {s.outsider ? (
          <TextAction
            label="Your final guess"
            button="Reveal the truth"
            placeholder="The sound was…"
            onSubmit={(text) => action("outsiderGuess", { text })}
          />
        ) : (
          <Wave decorative />
        )}
      </section>
    );
  return (
    <section className="game-stage">
      <p>Getting the next moment ready…</p>
    </section>
  );
}
