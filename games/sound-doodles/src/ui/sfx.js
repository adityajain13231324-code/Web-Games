// Tiny synthesized UI sounds (tap, join, tick, success, pop). No assets are downloaded.
// They follow the existing "Game sound effects" volume and stay silent during any performance,
// recording or replay, and until the browser has seen a user gesture.
import { audioBus, audioPrefs } from "../audio.js";

let context;
const recipes = {
  tap: [[520, 0.035, "triangle", 0.5]],
  pop: [
    [420, 0.05, "sine", 0.7],
    [680, 0.07, "sine", 0.5],
  ],
  join: [
    [392, 0.08, "triangle", 0.8],
    [587, 0.12, "triangle", 0.8],
  ],
  tick: [[880, 0.04, "square", 0.25]],
  success: [
    [523, 0.09, "triangle", 0.8],
    [659, 0.09, "triangle", 0.8],
    [784, 0.18, "triangle", 0.8],
  ],
};

export function sfx(name) {
  if (!audioPrefs.effects || audioBus.busy || audioBus.live) return;
  if (!navigator.userActivation?.hasBeenActive) return;
  try {
    context ||= new AudioContext();
    if (context.state === "suspended") context.resume();
    let t = context.currentTime;
    for (const [freq, len, type, vol] of recipes[name] || []) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const peak = 0.12 * audioPrefs.effects * vol;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(gain).connect(context.destination);
      osc.start(t);
      osc.stop(t + len + 0.02);
      t += len * 0.85;
    }
  } catch {
    /* sound is never essential */
  }
}
