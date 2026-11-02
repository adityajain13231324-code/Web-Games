import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Flame,
  Info,
  LogOut,
  Mic,
  Plus,
  Settings,
} from "lucide-react";
import { MODES } from "../../shared/modes.js";
import { mic, createMeter } from "../audio.js";
import { Poster } from "../ui/Poster.jsx";
import { RoomSettings, SettingsSummary } from "../ui/RoomSettings.jsx";
import { PlayerCard, GhostSlot } from "../ui/PlayerCard.jsx";
import { RoomCodeChip } from "../ui/RoomCodeChip.jsx";
import { Drawer, Popover } from "../ui/overlays.jsx";
import { Button, EQ } from "../ui/kit.jsx";
import { sfx } from "../ui/sfx.js";

const SCORING = {
  classic:
    "Classic: up to 200 points for a quick correct guess. Performers earn up to 200 based on the fraction who solve it.",
  gartic:
    "Gartic: no right answers and no scores. Record, interpret, pass it on, then enjoy the reveal.",
  ranking:
    "Ranking: place every other sound in order. First gets 1 point, then evenly descending fractions, scaled to 100 on the scoreboard.",
  foley:
    "Foley: one vote per person, no self-votes. Every vote is worth 100 points. Ties share the spotlight.",
  detective:
    "Detective: identify the outsider for 100 points. The outsider gets 200 if not caught or if their final guess is right. A tie does not catch anyone.",
  duo: "Duo: each performer gets one part of the scene. Guess both components; each performer earns the same solve-rate bonus.",
};

/** Live mic level with a friendly verdict. Reads the stream the mic check already opened. */
function MicMeter({ onTest }) {
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);
  const peak = useRef(0);
  useEffect(() => {
    if (!mic.stream) return;
    return createMeter(mic.stream, (v) => {
      setLevel(v);
      peak.current = Math.max(peak.current, v);
      if (peak.current > 0.12) setHeard(true);
    });
  }, []);
  if (!mic.stream)
    return (
      <button type="button" className="meter-cta" onClick={onTest}>
        Open the mic check to see your level
      </button>
    );
  return (
    <div className={`mic-meter ${heard ? "heard" : ""}`} role="status">
      <EQ level={level} count={20} />
      <span>{heard ? "Sounds good." : "Say something ridiculous…"}</span>
    </div>
  );
}

function ReadyRing({ ready, total }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const frac = total ? ready / total : 0;
  return (
    <span className="ready-ring" aria-label={`${ready} of ${total} ready`}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle className="ring-track" cx="24" cy="24" r={r} />
        <circle
          className="ring-fill"
          cx="24"
          cy="24"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <b>
        {ready}/{total}
      </b>
    </span>
  );
}

export function Lobby({ state, me, host, act, onMic, notify, onLeave }) {
  const [more, setMore] = useState(false),
    [settings, setSettings] = useState(false);
  const mode = MODES[state.settings.mode];
  const active = state.players.filter((p) => !p.spectator && p.connected);
  const readyCount = active.filter((p) => p.ready).length;
  const canStart =
    active.length >= mode.min &&
    active.every((p) => p.ready) &&
    (state.settings.mode === "classic" || active.every((p) => p.mic));
  const change = (patch) =>
    // `wordPack` is only a mirror for older pages; this page speaks in `wordPacks`.
    {
      const { wordPack, ...current } = state.settings;
      act("settings", { settings: { ...current, ...patch } });
    };
  const waiting = active.length - readyCount;
  const missing = mode.min - active.length;
  const statusLine =
    missing > 0
      ? `Invite ${missing} more friend${missing === 1 ? "" : "s"} to play ${mode.name}.`
      : waiting > 0
        ? `Waiting for ${waiting} friend${waiting === 1 ? "" : "s"} to ready up.`
        : !canStart
          ? "Check microphones or switch to spectator."
          : host
            ? "Everyone’s here. The mic is yours."
            : "All set. Waiting for the host to start.";
  const ghosts = Math.max(0, mode.min - state.players.length);
  const flagships = ["classic", "gartic"];
  const extras = Object.entries(MODES).slice(2);

  return (
    <div className="green-room">
      <section className="stage-top">
        <div className="lobby-heading">
          <span className="eyebrow">THE GREEN ROOM</span>
          <h1>
            Good company.
            <br />
            <em>Questionable acoustics.</em>
          </h1>
          <p>Get comfy, check your mic, and pick your kind of chaos.</p>
        </div>
        <RoomCodeChip code={state.code} onNotify={notify} />
      </section>

      <section className="cast-stage" aria-label="Players in the room">
        <div className="cast-grid">
          {state.players.map((p, i) => (
            <PlayerCard
              key={p.id}
              player={p}
              index={i}
              isYou={p.id === state.you}
              isHost={p.id === state.host}
              ready={!p.spectator && p.ready}
              offline={!p.connected}
              status={
                !p.connected
                  ? "Reconnecting…"
                  : p.spectator
                    ? "Spectating"
                    : state.settings.mode === "classic" && !p.mic
                      ? p.ready
                        ? "Ready · mic on their turn"
                        : "No mic check yet"
                      : p.ready
                        ? "Ready to make noise"
                        : "Getting comfy"
              }
            />
          ))}
          {Array.from({ length: ghosts }, (_, i) => (
            <GhostSlot
              key={`g${i}`}
              n={state.players.length + i + 1}
              index={state.players.length + i}
            />
          ))}
        </div>
        <div className="cast-foot">
          <span>
            {state.players.filter((p) => !p.spectator).length}/8 in the room
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onLeave}
          >
            <LogOut size={15} />
            Leave room
          </button>
        </div>
      </section>

      <section className="mode-picker">
        <div className="lobby-mode-head">
          <h2>Tonight’s game</h2>
          {!host && <small>The host picks the mode.</small>}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSettings(true)}
          >
            <Settings size={16} />
            Room settings
          </button>
        </div>
        <div className="lobby-flagships">
          {flagships.map((key, i) => (
            <Poster
              key={key}
              index={i}
              modeKey={key}
              mode={MODES[key]}
              className="lobby-mode"
              selected={state.settings.mode === key}
              disabled={!host}
              onSelect={(k) => change({ mode: k })}
            />
          ))}
        </div>
        <button
          type="button"
          className={`btn btn-ghost more-toggle ${more ? "open" : ""}`}
          aria-expanded={more}
          onClick={() => setMore(!more)}
        >
          Four more ways to make a scene
          <ChevronDown size={16} />
        </button>
        {(more || !flagships.includes(state.settings.mode)) && (
          <div className="extra-mode-grid">
            {extras.map(([key, m], i) => (
              <Poster
                key={key}
                compact
                index={i}
                modeKey={key}
                mode={m}
                selected={state.settings.mode === key}
                disabled={!host}
                onSelect={(k) => change({ mode: k })}
              />
            ))}
          </div>
        )}
        {state.settings.adultsOnly && (
          <div className="adult-banner" role="status">
            <Flame size={18} aria-hidden="true" />
            <span>
              <strong>Spicy words are on.</strong> Flirty and cheeky, for 18+
              groups only. The host can switch back anytime.
            </span>
          </div>
        )}
        <div className="mode-tools">
          <SettingsSummary
            settings={state.settings}
            onOpen={() => setSettings(true)}
          />
          <Popover
            label="How scoring works"
            align="start"
            trigger={({ toggle, props }) => (
              <button
                type="button"
                className="chip-button"
                onClick={toggle}
                {...props}
              >
                <Info size={15} />
                How scoring works
              </button>
            )}
          >
            <p className="scoring-note">{SCORING[state.settings.mode]}</p>
          </Popover>
        </div>
      </section>

      <section className="lobby-bottom">
        <div className="mic-station">
          <button type="button" className="mic-check" onClick={onMic}>
            {me.mic ? <Check size={23} /> : <Mic size={23} />}
            <span>
              <strong>
                {me.mic ? "Microphone checked" : "A quick mic check?"}
              </strong>
              <small>
                {me.mic
                  ? "You’re ready to be ridiculous."
                  : "Make sure we can hear your masterpiece."}
              </small>
            </span>
            <ArrowRight size={18} />
          </button>
          <MicMeter onTest={onMic} />
        </div>

        <div className="action-bar">
          <div className="ready-controls">
            {me.spectator ? (
              <Button
                variant="secondary"
                icon={<Plus size={17} />}
                onClick={() => act("seat", { spectator: false })}
              >
                Take a player seat
              </Button>
            ) : (
              <>
                <Button
                  variant={me.ready ? "mint" : "secondary"}
                  icon={<Check size={18} />}
                  className={me.ready ? "is-ready" : ""}
                  onClick={() => {
                    sfx(me.ready ? "tap" : "success");
                    act("ready", { ready: !me.ready });
                  }}
                >
                  {me.ready ? "I’m ready!" : "Ready up"}
                </Button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => act("seat", { spectator: true })}
                >
                  Watch instead
                </button>
              </>
            )}
          </div>
          {host && (
            <button
              type="button"
              className={`start-cta ${canStart ? "go" : ""}`}
              disabled={!canStart}
              onClick={() => act("start")}
            >
              <ReadyRing
                ready={readyCount}
                total={Math.max(active.length, 1)}
              />
              <span className="start-text">Let’s make noise</span>
              <ArrowRight size={22} />
            </button>
          )}
        </div>
        <p className="lobby-note" role="status" aria-live="polite">
          <span className="note-dot" aria-hidden="true" />
          {statusLine}
        </p>
        {state.settings.mode === "classic" &&
          active.some((p) => !p.mic) &&
          active.length >= 2 && (
            <p className="lobby-note warn" role="status">
              <Mic size={15} aria-hidden="true" />
              {active
                .filter((p) => !p.mic)
                .map((p) => p.name)
                .join(", ")}{" "}
              {active.filter((p) => !p.mic).length === 1 ? "hasn’t" : "haven’t"}{" "}
              done a mic check yet. Everyone takes a turn, so they’ll be asked
              to allow their mic when it’s theirs.
            </p>
          )}
      </section>

      {settings && (
        <Drawer title="Room settings" onClose={() => setSettings(false)}>
          <RoomSettings settings={state.settings} host={host} change={change} />
        </Drawer>
      )}
    </div>
  );
}
