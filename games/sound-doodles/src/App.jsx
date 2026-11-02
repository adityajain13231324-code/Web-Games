import React, { useState, useEffect, useRef } from "react";
import { MODES } from "../shared/modes.js";
import { Avatar, Modal, Recorder } from "./components.jsx";
import { cue, liveConnections, mic } from "./audio.js";
import { announce } from "./ambience.js";
import { initialCode, readStored } from "./support.js";
import { applyTheme, watchVisibility } from "./theme.js";
import { StageBackground } from "./ui/StageBackground.jsx";
import { ThemePicker } from "./ui/ThemePicker.jsx";
import { ReconnectPill, UpdatePill } from "./ui/overlays.jsx";
import { Cast } from "./ui/Cast.jsx";
import { TimerRing } from "./ui/kit.jsx";
import { CountdownOverlay } from "./ui/ceremony.jsx";
import { sfx } from "./ui/sfx.js";
import { PingBadge } from "./ui/PingBadge.jsx";
import { Landing } from "./screens/Landing.jsx";
import { Entry } from "./screens/Entry.jsx";
import { Lobby } from "./screens/Lobby.jsx";
import { Game } from "./screens/Game/index.jsx";
import { AudioSettings } from "./screens/AudioSettings.jsx";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  HelpCircle,
  Link,
  LogOut,
  Mic,
  MicOff,
  Palette,
  Play,
  Radio,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import { io } from "socket.io-client";

// WebSocket first: Socket.IO's default starts with slow HTTP polling, which adds round trips on every connect.
const socket = io({ autoConnect: false, transports: ["websocket", "polling"] });
function phaseLabel(state) {
  const onMic = state.performers?.includes(state.you);
  const labels = {
    choose: "Pick a sound",
    prepare: "Get ready",
    perform: onMic ? "Perform" : "Guess",
    record: "Record",
    interpret: "Write",
    seed: "Write",
    handoff: "Passing it on",
    listening: "Listen",
    vote: "Vote",
    outsider: "The outsider's guess",
    roundReveal: "Reveal",
    chainReveal: "The big reveal",
    awards: "Awards",
    results: "Results",
  };
  return labels[state.phase] || "Play";
}

export function App() {
  const [state, setState] = useState(null),
    [session, setSession] = useState(() =>
      readStored("sd-session", null, sessionStorage),
    ),
    [connected, setConnected] = useState(false),
    [modal, setModal] = useState(initialCode ? "join" : null),
    [error, setError] = useState(""),
    [theme, setTheme] = useState(localStorage.getItem("sd-theme") || "paper"),
    [audioStatus, setAudioStatus] = useState(""),
    [muted, setMuted] = useState(false),
    [busy, setBusy] = useState(false);
  const sessionRef = useRef(session),
    stateRef = useRef(state),
    previousPhase = useRef(""),
    firstBuild = useRef(null),
    [now, setNow] = useState(Date.now());
  sessionRef.current = session;
  stateRef.current = state;
  const notify = (message) => setError(message);
  const enter = async (data) => {
    setBusy(true);
    setError("");
    return new Promise((resolve) =>
      socket.timeout(10000).emit("enter", data, (timeout, result) => {
        setBusy(false);
        if (timeout || !result?.ok) {
          setError(
            result?.error ||
              "The server is taking a while. Check your connection and retry.",
          );
          resolve(false);
          return;
        }
        const s = { code: result.code, token: result.token, id: result.id };
        sessionRef.current = s;
        setSession(s);
        sessionStorage.setItem("sd-session", JSON.stringify(s));
        history.replaceState({}, "", `?room=${s.code}`);
        setModal(null);
        cue("confirm");
        resolve(true);
      }),
    );
  };
  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      const s = sessionRef.current;
      if (s)
        socket.emit("enter", s, (result) => {
          if (!result?.ok) {
            setError(result?.error || "Session expired.");
            setSession(null);
            sessionRef.current = null;
            sessionStorage.removeItem("sd-session");
            setState(null);
            setModal("join");
          }
        });
    };
    const onState = (s) => {
      setState(s);
      setConnected(true);
    };
    const onDisconnect = () => setConnected(false);
    const onExpired = () => {
      sessionStorage.removeItem("sd-session");
      sessionRef.current = null;
      setSession(null);
      setState(null);
      mic.stop();
      setError(
        "This room has expired and its recordings were deleted. Create a new room to keep playing.",
      );
    };
    socket.on("connect", onConnect);
    socket.on("state", onState);
    socket.on("disconnect", onDisconnect);
    socket.on("expired", onExpired);
    socket.connect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("state", onState);
      socket.off("disconnect", onDisconnect);
      socket.off("expired", onExpired);
      socket.disconnect();
    };
  }, []);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useEffect(() => watchVisibility(), []);
  const playerCount = state?.players.length || 0;
  const seenCount = useRef(playerCount);
  useEffect(() => {
    if (playerCount > seenCount.current && state?.phase === "lobby")
      sfx("join");
    seenCount.current = playerCount;
  }, [playerCount]);
  if (state?.build && !firstBuild.current) firstBuild.current = state.build;
  const counting = !!state?.deadline;
  useEffect(() => {
    if (!counting) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [counting]);
  // Live ping to the server, shown in the header so network delay is visible.
  const [ping, setPing] = useState(null);
  useEffect(() => {
    if (!connected || !state) return setPing(null);
    const measure = () => {
      const t = performance.now();
      socket.timeout(4000).emit("latency", (err) => {
        if (!err) setPing(Math.round(performance.now() - t));
      });
    };
    measure();
    const id = setInterval(measure, 6000);
    return () => clearInterval(id);
  }, [connected, !!state]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 10000);
    return () => clearTimeout(t);
  }, [error]);
  useEffect(() => {
    if (!state) return;
    const phase = state.phase;
    if (previousPhase.current !== phase) {
      if (phase === "prepare") {
        cue("prepare");
        if (state.performers?.includes(state.you)) announce("your-turn");
      }
      if (
        phase === "perform" &&
        state.participant &&
        !state.performers?.includes(state.you)
      )
        announce("time-to-guess");
      if (phase === "chainReveal") announce("lets-hear");
      if (["chainReveal", "roundReveal"].includes(phase)) cue("reveal");
      if (phase === "results") cue("results");
      previousPhase.current = phase;
    }
  }, [state?.phase]);
  const liveKey =
    connected && state?.phase === "perform"
      ? `${state.phaseId}:${state.performers.join(",")}:${state.players
          .filter((p) => p.connected)
          .map((p) => p.id)
          .join(",")}`
      : "";
  useEffect(() => {
    if (!liveKey) {
      setAudioStatus("");
      return;
    }
    return liveConnections(socket, stateRef.current, setAudioStatus);
  }, [liveKey]);
  const action = (event, data = {}) =>
    new Promise((resolve, reject) => {
      if (!socket.connected) {
        const e = Error("Reconnecting. Your place is saved.");
        setError(e.message);
        reject(e);
        return;
      }
      socket
        .timeout(8000)
        .emit(
          "action",
          { event, data: { ...data, phaseId: stateRef.current?.phaseId } },
          (timeout, result) => {
            if (timeout || !result?.ok) {
              const e = Error(
                result?.error || "No response yet. Reconnect and retry.",
              );
              setError(e.message);
              reject(e);
            } else resolve(result);
          },
        );
    });
  // Controls that only flip a flag feel instant: show the result now, the server's state confirms (or corrects) it.
  const optimistic = (s, event, data) => {
    if (!s) return s;
    if (event === "ready")
      return {
        ...s,
        players: s.players.map((p) =>
          p.id === s.you ? { ...p, ready: !!data?.ready } : p,
        ),
      };
    if (event === "seat")
      return {
        ...s,
        players: s.players.map((p) =>
          p.id === s.you
            ? { ...p, spectator: !!data?.spectator, ready: false }
            : p,
        ),
      };
    if (event === "settings" && data?.settings)
      return {
        ...s,
        settings: { ...s.settings, ...data.settings },
        players: s.players.map((p) => ({ ...p, ready: false })),
      };
    return s;
  };
  const act = (event, data) => {
    const before = stateRef.current;
    if (["ready", "seat", "settings"].includes(event))
      setState((s) => optimistic(s, event, data));
    action(event, data).catch(() => before && setState(before));
  };
  const leave = () => {
    socket.emit("leave");
    mic.stop();
    sessionStorage.removeItem("sd-session");
    sessionRef.current = null;
    setSession(null);
    setState(null);
    history.replaceState({}, "", "/");
  };
  const host = state?.host === state?.you;
  // A mode picked on the landing page becomes the lobby's mode as soon as the room exists.
  const [wantedMode, setWantedMode] = useState(null);
  useEffect(() => {
    if (!wantedMode || !state || state.phase !== "lobby") return;
    if (host && state.settings.mode !== wantedMode && MODES[wantedMode]) {
      const { wordPack, ...current } = state.settings;
      act("settings", { settings: { ...current, mode: wantedMode } });
    }
    setWantedMode(null);
  }, [wantedMode, state?.phase, host]);
  const me = state?.players.find((p) => p.id === state.you);
  // A snapshot captures the local offset; subsequent renders must not reset it.
  const offset = useRef(0);
  useEffect(() => {
    if (state) offset.current = state.serverNow - Date.now();
  }, [state]);
  const seconds = state?.deadline
    ? Math.max(0, Math.ceil((state.deadline - now - offset.current) / 1000))
    : 0;
  // Remember each phase's full length so the time bar can show what is left.
  const phaseLength = useRef({ id: null, total: 1 });
  if (state?.deadline && phaseLength.current.id !== state.phaseId)
    phaseLength.current = {
      id: state.phaseId,
      total: Math.max(1, (state.deadline - state.serverNow) / 1000),
    };
  const upload = async (blob, duration) => {
    const r = await fetch(`/api/rooms/${session.code}/audio`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": blob.type,
        "X-Duration": String(duration),
        "X-Phase-Id": String(state.phaseId),
      },
      body: blob,
    });
    const result = await r.json();
    if (!r.ok)
      throw Error(
        result.error || "Upload failed. Your take is still here; retry.",
      );
    await action("submit", { audioId: result.audioId });
    cue("submit");
  };
  return (
    <>
      <StageBackground />
      <header className="site-header">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            if (state) e.preventDefault();
          }}
          aria-label="Sound Doodles home"
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            sound<span className="brand-second">doodles</span>
            <span className="brand-dot">.</span>
          </span>
        </a>
        <div className="header-right">
          {state ? (
            <span className="room-pill">
              <span className="status-dot" /> ROOM {state.code}
            </span>
          ) : (
            <span className="header-note">
              GOOD FRIENDS. QUESTIONABLE SOUNDS.
            </span>
          )}
          {state && <PingBadge ping={ping} />}
          <ThemePicker theme={theme} onChange={setTheme} />
          <button
            className="icon-button"
            title="Audio settings"
            aria-label="Audio settings"
            onClick={() => setModal("audio")}
          >
            <Volume2 size={20} />
          </button>
          <button
            className="icon-button"
            title="How to play"
            aria-label="How to play"
            onClick={() => setModal("help")}
          >
            <HelpCircle size={20} />
          </button>
        </div>
      </header>
      {connected &&
        state?.build &&
        firstBuild.current &&
        state.build !== firstBuild.current && <UpdatePill />}
      {!connected && state && (
        <ReconnectPill
          onRetry={() => {
            socket.disconnect();
            socket.connect();
          }}
        />
      )}
      <main>
        {!state ? (
          <Landing
            onCreate={(mode) => {
              setWantedMode(typeof mode === "string" ? mode : null);
              setModal("create");
            }}
            onJoin={() => {
              setWantedMode(null);
              setModal("join");
            }}
            onHelp={() => setModal("help")}
          />
        ) : (
          <div className="room-layout">
            {state.phase !== "lobby" && (
              <Cast state={state} onLeave={() => setModal("leave")} />
            )}
            <section className="room-content">
              {state.phase === "lobby" ? (
                <Lobby
                  state={state}
                  me={me}
                  host={host}
                  act={act}
                  onMic={() => setModal("mic")}
                  notify={notify}
                  onLeave={() => setModal("leave")}
                />
              ) : (
                <>
                  <div className="game-topline">
                    <span className="eyebrow">
                      {MODES[state.settings.mode].name}
                    </span>
                    <span className="phase-chip">{phaseLabel(state)}</span>
                    <span>
                      {["chainReveal", "awards", "results"].includes(
                        state.phase,
                      )
                        ? ""
                        : state.settings.mode === "gartic"
                          ? `Step ${Math.min(state.chainRounds, state.contributionRound + 1)} of ${state.chainRounds}`
                          : `Round ${Math.min(state.round + 1, state.totalRounds)} of ${state.totalRounds}`}
                    </span>
                    {state.deadline && (
                      <TimerRing
                        seconds={seconds}
                        total={phaseLength.current.total}
                        size={56}
                      />
                    )}
                  </div>
                  {state.deadline && (
                    <div className="time-track" aria-hidden="true">
                      <i
                        className={seconds < 6 ? "urgent" : ""}
                        style={{
                          transform: `scaleX(${Math.min(1, seconds / phaseLength.current.total)})`,
                        }}
                      />
                    </div>
                  )}
                  {state.phase === "prepare" && (
                    <CountdownOverlay seconds={seconds} />
                  )}
                  <Game
                    key={`${state.phaseId}-${state.phase}`}
                    state={state}
                    me={me}
                    session={session}
                    host={host}
                    act={act}
                    action={action}
                    upload={upload}
                  />
                  {state.phase === "perform" && (
                    <div
                      className={`live-bar ${/Tap Enable audio/.test(audioStatus) ? "attention" : ""}`}
                    >
                      <Radio size={17} />
                      <span>{audioStatus || "Connecting live audio…"}</span>
                      {!state.performers.includes(state.you) &&
                        (/Tap Enable audio/.test(audioStatus) ? (
                          <button
                            className="button primary"
                            onClick={() =>
                              window.dispatchEvent(new Event("enable-audio"))
                            }
                          >
                            <Volume2 size={17} />
                            Tap to hear your friends
                          </button>
                        ) : (
                          <button
                            className="text-button"
                            onClick={() =>
                              window.dispatchEvent(new Event("enable-audio"))
                            }
                          >
                            Enable audio
                          </button>
                        ))}
                      {state.performers.includes(state.you) && (
                        <button
                          className="button subtle"
                          onClick={() => {
                            mic.setMuted(!muted);
                            setMuted(!muted);
                          }}
                        >
                          {muted ? <MicOff size={16} /> : <Mic size={16} />}{" "}
                          {muted ? "Unmute" : "Mute"}
                        </button>
                      )}
                    </div>
                  )}
                  {state.phase !== "results" && (
                    <div className="reactions">
                      <div aria-live="polite">
                        {state.reactions.map((r) => (
                          <span key={r.id} title={r.name}>
                            {r.emoji}
                          </span>
                        ))}
                      </div>
                      <span>Send a little love</span>
                      {["👏", "😂", "✨", "🤯"].map((emoji) => (
                        <button
                          key={emoji}
                          aria-label={`React ${emoji}`}
                          onClick={() => act("reaction", { emoji })}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </main>
      {!state && (
        <footer>
          <span>
            A LITTLE LESS TALK. A LOT MORE <em>WAAAH.</em>
          </span>
          <div>
            <ShieldCheck size={14} />
            Private rooms <span>·</span> No accounts <span>·</span> Just bring
            your voice
          </div>
        </footer>
      )}
      {error && (
        <div className="toast" role="status">
          <span>{error}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}
      {["create", "join"].includes(modal) && (
        <Entry
          type={modal}
          busy={busy}
          connected={connected}
          enter={enter}
          code={initialCode || session?.code}
          startMode={wantedMode ? MODES[wantedMode]?.name : ""}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "audio" && (
        <Modal title="Sound & motion" onClose={() => setModal(null)}>
          <AudioSettings />
          <button className="button subtle" onClick={() => setModal("mic")}>
            <Mic size={17} />
            Check microphone
            <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {modal === "mic" && (
        <Modal title="Mic check. One, two, moo." onClose={() => setModal(null)}>
          <Recorder
            check
            maxSeconds={5}
            onMic={(ready) => {
              if (state) act("mic", { mic: ready });
            }}
          />
          <button className="button wide" onClick={() => setModal(null)}>
            Done
            <Check size={17} />
          </button>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="Bad impressions. Great company."
          onClose={() => setModal(null)}
        >
          <div className="instructions">
            <div>
              <b>01</b>
              <p>
                <strong>Get the gang together.</strong>Create a private room and
                send the link. Bring 1 to 7 friends and headphones.
              </p>
            </div>
            <div>
              <b>02</b>
              <p>
                <strong>Become the sound.</strong>Hum, whistle, clap, squeak. No
                words, spoken clues, or external recordings.
              </p>
            </div>
            <div>
              <b>03</b>
              <p>
                <strong>Guess. Giggle. Go again.</strong>Classic rewards quick
                guesses. Gartic passes sounds and words around, then reveals the
                whole wonderful mess.
              </p>
            </div>
          </div>
          <p className="notice">
            Listening is central to this game. A visual meter cannot replace
            hearing the sounds. Spectators can watch reveals and send reactions.
            Classic supports guessers without a microphone.
          </p>
          <p className="small muted">
            Live rounds are not recorded. Submitted clips stay private to the
            room and are deleted on Play Again, server restart, after room
            expiry (at most 2 hours), or after everyone leaves for 10 minutes.
            There is no replay export.
          </p>
          <button
            className="button primary wide"
            onClick={() => setModal(null)}
          >
            Sounds good
            <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {modal === "leave" && (
        <Modal title="Heading out?" onClose={() => setModal(null)}>
          <p>
            Your microphone will stop. The next connected player takes over if
            you’re hosting.
          </p>
          <div className="button-row">
            <button className="button" onClick={() => setModal(null)}>
              Stay a little longer
            </button>
            <button
              className="button danger"
              onClick={() => {
                leave();
                setModal(null);
              }}
            >
              Leave room
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
