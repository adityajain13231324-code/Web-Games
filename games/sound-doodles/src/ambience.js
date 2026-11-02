// Optional quiet background music and sparse announcer lines.
// The music is synthesized in the browser (original, no licensing concerns). Announcer lines are
// optional mp3 files in public/audio/announce/ (see scripts/generate-announcer.mjs); a missing
// file is simply skipped. Both stay silent while anyone is recording, speaking or being replayed.
import { audioBus, audioPrefs } from "./audio.js";

const CHORDS = [
  [130.81, 196.0, 246.94, 329.63], // C maj7
  [110.0, 164.81, 220.0, 261.63], // A min7
  [87.31, 130.81, 174.61, 220.0], // F maj6
  [98.0, 146.83, 196.0, 246.94], // G6
];
const CHORD_SECONDS = 8;
const MAX_GAIN = 0.16;

let context,
  master,
  timer,
  duckTimer,
  step = 0;

function playChord(freqs) {
  const now = context.currentTime;
  for (const f of freqs) {
    for (const detune of [-5, 5]) {
      const osc = context.createOscillator();
      const env = context.createGain();
      const filter = context.createBiquadFilter();
      osc.type = "triangle";
      osc.frequency.value = f;
      osc.detune.value = detune;
      filter.type = "lowpass";
      filter.frequency.value = 900;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.05, now + 3);
      env.gain.linearRampToValueAtTime(0, now + CHORD_SECONDS + 2);
      osc.connect(filter).connect(env).connect(master);
      osc.start(now);
      osc.stop(now + CHORD_SECONDS + 2.2);
    }
  }
}

function target() {
  const quiet = audioBus.busy > 0 || audioBus.live;
  return quiet ? 0 : audioPrefs.music * MAX_GAIN;
}

function begin() {
  if (context) return;
  context = new AudioContext();
  master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);
  playChord(CHORDS[0]);
  timer = setInterval(() => {
    step = (step + 1) % CHORDS.length;
    playChord(CHORDS[step]);
  }, CHORD_SECONDS * 1000);
  // Duck smoothly whenever player audio matters.
  duckTimer = setInterval(() => {
    master.gain.setTargetAtTime(target(), context.currentTime, 0.4);
  }, 120);
}

function end() {
  clearInterval(timer);
  clearInterval(duckTimer);
  if (context) context.close().catch(() => {});
  context = master = undefined;
}

/** Call whenever the music preference changes, and once at startup. */
export function syncMusic() {
  if (audioPrefs.music > 0) {
    if (context) {
      if (context.state === "suspended") context.resume().catch(() => {});
    } else if (navigator.userActivation?.hasBeenActive) begin();
    else
      document.addEventListener(
        "pointerdown",
        () => audioPrefs.music > 0 && begin(),
        {
          once: true,
        },
      );
  } else end();
}

const announceCache = new Map();
/** Plays /audio/announce/<name>.mp3 once per phase if the file exists and nobody is performing. */
export function announce(name) {
  if (!audioPrefs.announcements || audioBus.busy || audioBus.live) return;
  if (announceCache.get(name) === false) return;
  const line = new Audio(`/audio/announce/${name}.mp3`);
  line.volume = audioPrefs.announcements;
  audioBus.effects.add(line);
  line.onended = () => audioBus.effects.delete(line);
  line.onerror = () => {
    announceCache.set(name, false);
    audioBus.effects.delete(line);
  };
  line.play().catch(() => audioBus.effects.delete(line));
}

/** True when at least one announcer file has been installed. */
export async function announcerAvailable() {
  try {
    const r = await fetch("/audio/announce/your-turn.mp3", { method: "HEAD" });
    return r.ok && /audio/.test(r.headers.get("content-type") || "");
  } catch {
    return false;
  }
}
