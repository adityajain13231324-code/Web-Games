/**
 * Apartment 07 sound: a small procedural music engine (no audio files), rain ambience and effects.
 * Every track is composed from chord progressions + seeded melody generation, so loops vary gently.
 */

export interface TrackInfo { id: string; title: string; mood: string; bpm: number }
export interface AudioSettings { track: string; music: number; sfx: number; ambience: number; muted: boolean }

type Voice = (e: Engine, t: number, step: number, bar: number, chord: number[], next: number[]) => void;
interface TrackDef extends TrackInfo { steps: number; swing: number; chords: number[][]; voices: Voice[]; crackle?: number }

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// Seeded random so a bar's melody is the same each time the loop comes round, with variety across bars.
const rand = (seed: number) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };

class Engine {
  ctx: AudioContext;
  out: GainNode;
  verb: GainNode;
  constructor(ctx: AudioContext, out: GainNode, verb: GainNode) { this.ctx = ctx; this.out = out; this.verb = verb; }

  private env(t: number, peak: number, attack: number, decay: number, dest: AudioNode, wet = 0.3) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    if (wet > 0) { const s = this.ctx.createGain(); s.gain.value = wet; g.connect(s).connect(this.verb); }
    return g;
  }
  private osc(type: OscillatorType, f: number, t: number, len: number, dest: AudioNode, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(t + len + 0.05);
    return o;
  }

  piano(t: number, n: number, vel = 0.5, len = 1.6) {
    const f = midi(n);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, f * 9), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 2), t + len);
    lp.connect(this.out);
    const s = this.ctx.createGain(); s.gain.value = 0.35; lp.connect(s).connect(this.verb);
    const g = this.env(t, 0.13 * vel, 0.006, len, lp, 0);
    this.osc('triangle', f, t, len, g, -3);
    this.osc('sine', f, t, len, g, 4);
    const h = this.env(t, 0.03 * vel, 0.004, len * 0.35, lp, 0);
    this.osc('sine', f * 2, t, len, h);
  }

  rhodes(t: number, n: number, vel = 0.5, len = 2.2) {
    const f = midi(n);
    const g = this.env(t, 0.11 * vel, 0.01, len, this.out, 0.4);
    const car = this.ctx.createOscillator(); car.frequency.value = f;
    const mod = this.ctx.createOscillator(); mod.frequency.value = f;
    const depth = this.ctx.createGain();
    depth.gain.setValueAtTime(f * 1.6 * vel, t);
    depth.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.6);
    mod.connect(depth).connect(car.frequency);
    car.connect(g);
    // Gentle tremolo is the signature of an electric piano.
    const trem = this.ctx.createOscillator(), tg = this.ctx.createGain();
    trem.frequency.value = 4.5; tg.gain.value = 0.025 * vel; trem.connect(tg).connect(g.gain);
    for (const o of [car, mod, trem]) { o.start(t); o.stop(t + len + 0.1); }
  }

  bell(t: number, n: number, vel = 0.5, len = 1.4) {
    const f = midi(n);
    const g = this.env(t, 0.07 * vel, 0.002, len, this.out, 0.55);
    this.osc('sine', f, t, len, g);
    const h = this.env(t, 0.025 * vel, 0.002, len * 0.3, this.out, 0.55);
    this.osc('sine', f * 4.01, t, len, h);
    const k = this.env(t, 0.012 * vel, 0.001, len * 0.15, this.out, 0.3);
    this.osc('sine', f * 6.8, t, len, k);
  }

  pad(t: number, notes: number[], len: number, vel = 0.5, bright = 900) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = bright; lp.Q.value = 0.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.03 * vel, t + len * 0.35);
    g.gain.setValueAtTime(0.03 * vel, t + len * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.8);
    lp.connect(g).connect(this.out);
    const s = this.ctx.createGain(); s.gain.value = 0.6; g.connect(s).connect(this.verb);
    for (const n of notes) for (const d of [-7, 6]) this.osc('sawtooth', midi(n), t, len + 0.9, lp, d);
  }

  bass(t: number, n: number, vel = 0.5, len = 0.6) {
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.connect(this.out);
    const g = this.env(t, 0.2 * vel, 0.01, len, lp, 0);
    this.osc('triangle', midi(n), t, len, g);
    this.osc('sine', midi(n - 12), t, len, g);
  }

  pluck(t: number, n: number, vel = 0.5, len = 0.35, cutoff = 2400) {
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff, t); lp.frequency.exponentialRampToValueAtTime(400, t + len);
    lp.connect(this.out);
    const s = this.ctx.createGain(); s.gain.value = 0.45; lp.connect(s).connect(this.verb);
    const g = this.env(t, 0.06 * vel, 0.004, len, lp, 0);
    this.osc('square', midi(n), t, len, g, 5);
  }

  private noise(t: number, len: number, filter: BiquadFilterType, freq: number, peak: number, decay: number, wet = 0.15) {
    const src = this.ctx.createBufferSource(); src.buffer = noiseBuffer(this.ctx);
    const f = this.ctx.createBiquadFilter(); f.type = filter; f.frequency.value = freq;
    const g = this.env(t, peak, 0.002, decay, this.out, wet);
    src.connect(f).connect(g);
    src.start(t, Math.random() * 1.5); src.stop(t + len);
  }
  kick(t: number, vel = 0.6) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = this.env(t, 0.32 * vel, 0.003, 0.3, this.out, 0);
    o.connect(g); o.start(t); o.stop(t + 0.4);
  }
  brush(t: number, vel = 0.5) { this.noise(t, 0.3, 'bandpass', 2600, 0.05 * vel, 0.22); }
  hat(t: number, vel = 0.5) { this.noise(t, 0.1, 'highpass', 7000, 0.035 * vel, 0.05, 0.05); }
  snap(t: number, vel = 0.5) { this.noise(t, 0.2, 'bandpass', 1500, 0.08 * vel, 0.12, 0.3); }
  crackle(t: number, amount: number) { if (Math.random() < amount) this.noise(t, 0.03, 'highpass', 3000, 0.02 + Math.random() * 0.03, 0.01, 0); }
}

let cachedNoise: AudioBuffer | undefined;
function noiseBuffer(ctx: AudioContext) {
  if (cachedNoise) return cachedNoise;
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return (cachedNoise = b);
}

/** Pick a melody note from the chord (strong beats) or the scale around it (passing notes). */
function melodyNote(chord: number[], seed: number, low = 67, high = 81, scale = [0, 2, 4, 5, 7, 9, 11], root = 60) {
  const r = rand(seed);
  if (r < 0.65) {
    const tones = chord.flatMap(n => [n, n + 12, n + 24]).filter(n => n >= low && n <= high);
    return tones[Math.floor(rand(seed + 7) * tones.length)] ?? chord[0] + 12;
  }
  const notes: number[] = [];
  for (let o = -12; o <= 24; o += 12) for (const s of scale) { const n = root + o + s; if (n >= low && n <= high) notes.push(n); }
  return notes[Math.floor(rand(seed + 3) * notes.length)];
}

// Chord voicings (MIDI note numbers).
const C = {
  Fmaj7: [53, 57, 60, 64], Em7: [52, 55, 59, 62], Dm7: [50, 53, 57, 60], Cmaj7: [48, 52, 55, 59],
  C: [48, 52, 55, 60], Am: [45, 52, 57, 60], F: [53, 57, 60, 65], G: [55, 59, 62, 67], GB: [47, 55, 59, 62],
  Am9: [45, 52, 55, 59, 60], Fmaj9: [41, 52, 55, 57, 60], Cmaj9: [48, 52, 55, 59, 62], G6: [43, 50, 55, 59, 64],
  Dm9: [50, 53, 57, 60, 64], G13: [43, 53, 59, 64], A7b9: [45, 55, 58, 61, 64],
  Em: [52, 55, 59, 64], D: [50, 54, 57, 62], Bm: [47, 54, 59, 62], Dsus: [50, 55, 57, 62],
};

const TRACKS: TrackDef[] = [
  {
    id: 'rain', title: 'Rain on the Window', mood: 'Lo-fi piano · cosy', bpm: 72, steps: 16, swing: 0.18, crackle: 0.25,
    chords: [C.Fmaj7, C.Em7, C.Dm7, C.Cmaj7],
    voices: [
      (e, t, s, _b, ch) => { if (s === 0) ch.forEach((n, i) => e.piano(t + i * 0.025, n, 0.4, 3.2)); if (s === 10) e.piano(t, ch[2] + 12, 0.25, 1.2); },
      (e, t, s, b, ch) => { if ([2, 6, 7, 11, 14].includes(s) && rand(b * 31 + s) > 0.35) e.piano(t, melodyNote(ch, b * 17 + s), 0.45 + rand(s + b) * 0.2, 1.4); },
      (e, t, s, _b, ch) => { if (s === 0) e.bass(t, ch[0] - 12, 0.6, 1.6); if (s === 10) e.bass(t, ch[0] - 5, 0.4, 0.6); },
      (e, t, s) => { if (s === 0 || s === 9) e.kick(t, 0.45); if (s === 4 || s === 12) e.brush(t, 0.7); if (s % 2 === 0) e.hat(t, s % 4 ? 0.25 : 0.4); },
    ],
  },
  {
    id: 'explorer', title: 'Little Explorer', mood: 'Music box lullaby', bpm: 92, steps: 12, swing: 0, crackle: 0,
    chords: [C.C, C.Am, C.F, C.G],
    voices: [
      (e, t, s, _b, ch) => { if (s % 2 === 0) e.bell(t, [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 12][s / 2], 0.5, 1.2); },
      (e, t, s, b, ch) => { if ((s === 0 || s === 4 || s === 8) && rand(b * 13 + s) > 0.2) e.bell(t, melodyNote(ch, b * 11 + s, 76, 88), 0.7, 1.8); },
      (e, t, s, _b, ch) => { if (s === 0) e.pad(t, [ch[0], ch[1] + 12], 1.9, 0.35, 700); },
    ],
  },
  {
    id: 'hallway', title: 'Quiet Hallway', mood: 'Ambient · mysterious', bpm: 58, steps: 16, swing: 0, crackle: 0.08,
    chords: [C.Am9, C.Fmaj9, C.Cmaj9, C.G6],
    voices: [
      (e, t, s, _b, ch) => { if (s === 0) e.pad(t, ch, 60 / 58 * 4, 0.7, 650); },
      (e, t, s, b, ch) => { if ((s === 3 || s === 9 || s === 14) && rand(b * 7 + s) > 0.45) e.rhodes(t, melodyNote(ch, b * 19 + s, 64, 79, [0, 2, 3, 5, 7, 8, 10], 57), 0.4, 3); },
      (e, t, s, _b, ch) => { if (s === 0) e.bass(t, ch[0] - 12, 0.35, 3); },
      (e, t, s, b) => { if (s === 8 && rand(b) > 0.5) e.bell(t, 88, 0.15, 3); },
    ],
  },
  {
    id: 'kitchen', title: 'Midnight Kitchen', mood: 'Jazzy · late night', bpm: 86, steps: 16, swing: 0.3, crackle: 0.15,
    chords: [C.Dm9, C.G13, C.Cmaj9, C.A7b9],
    voices: [
      (e, t, s, _b, ch) => { if (s === 0 || s === 7) ch.slice(1).forEach(n => e.rhodes(t, n + 12, 0.35, s ? 0.6 : 1.8)); },
      (e, t, s, _b, ch, nx) => { if (s % 4 === 0) { const walk = [ch[0], ch[0] + 4, ch[0] + 7, nx[0] - 1][s / 4]; e.bass(t, walk - 12 + (walk > 55 ? -12 : 0), 0.7, 0.45); } },
      (e, t, s, b, ch) => { if ([2, 3, 6, 10, 13].includes(s) && rand(b * 23 + s) > 0.4) e.rhodes(t, melodyNote(ch, b * 29 + s, 70, 84), 0.45, 0.9); },
      (e, t, s) => { if (s % 4 === 0) e.brush(t, 0.5); if (s % 4 === 2) e.hat(t, 0.45); if (s === 4 || s === 12) e.snap(t, 0.3); },
    ],
  },
  {
    id: 'backup', title: 'Backup Power', mood: 'Warm synth · hopeful', bpm: 100, steps: 16, swing: 0, crackle: 0,
    chords: [C.Em, C.C, C.G, C.D],
    voices: [
      (e, t, s, _b, ch) => { const arp = [0, 1, 2, 3, 2, 1]; e.pluck(t, ch[arp[s % 6]] + 12, s % 4 === 0 ? 0.7 : 0.45, 0.3, 1800 + (s % 4) * 300); },
      (e, t, s, _b, ch) => { if (s === 0) e.pad(t, ch, 2.4, 0.6, 1100); },
      (e, t, s, _b, ch) => { if (s % 4 === 0) e.bass(t, ch[0] - 12, 0.55, 0.4); },
      (e, t, s) => { if (s % 8 === 0) e.kick(t, 0.5); if (s % 8 === 4) e.snap(t, 0.25); if (s % 2 === 1) e.hat(t, 0.2); },
    ],
  },
  {
    id: 'home', title: 'Home Again', mood: 'Piano · warm ending', bpm: 76, steps: 16, swing: 0.08, crackle: 0.05,
    chords: [C.C, C.GB, C.Am, C.F],
    voices: [
      (e, t, s, _b, ch) => { if (s % 4 === 0) e.piano(t, ch[1 + (s / 4) % 3] , 0.3, 1.2); },
      (e, t, s, b, ch) => { const rhythm = [0, 3, 6, 8, 12, 14]; if (rhythm.includes(s) && rand(b * 41 + s) > 0.25) e.piano(t, melodyNote(ch, b * 37 + s, 69, 84), 0.55, 1.8); },
      (e, t, s, _b, ch) => { if (s === 0) { e.bass(t, ch[0] - 12, 0.6, 2.4); e.pad(t, ch.slice(1), 3, 0.45, 800); } },
      (e, t, s, b) => { if (b % 4 >= 2 && s === 8) e.bell(t, 84, 0.2, 2); },
    ],
  },
];

export const TRACK_LIST: TrackInfo[] = TRACKS.map(({ id, title, mood, bpm }) => ({ id, title, mood, bpm }));

function load(): AudioSettings {
  const fallback: AudioSettings = { track: 'rain', music: 0.55, sfx: 0.8, ambience: 0.5, muted: false };
  try { return { ...fallback, ...JSON.parse(localStorage.getItem('a07-audio') ?? '{}') }; } catch { return fallback; }
}

export class GameAudio {
  ctx?: AudioContext;
  master?: GainNode;
  musicBus?: GainNode;
  sfxBus?: GainNode;
  ambBus?: GainNode;
  reverb?: ConvolverNode;
  verbIn?: GainNode;
  musicVerb?: GainNode;
  settings = load();
  playing?: { def: TrackDef; gain: GainNode; wet: GainNode; engine: Engine; nextTime: number; step: number; bar: number };
  timer?: ReturnType<typeof setInterval>;
  listeners = new Set<() => void>();

  get started() { return !!this.ctx; }

  /** Must run from a user gesture (browser autoplay rules). */
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      const ctx = this.ctx = new AudioContext();
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 3;
      this.master.connect(comp).connect(ctx.destination);
      this.musicBus = ctx.createGain(); this.sfxBus = ctx.createGain(); this.ambBus = ctx.createGain();
      for (const b of [this.musicBus, this.sfxBus, this.ambBus]) b.connect(this.master);
      // Separate reverbs so the music and effects volume sliders each control their own tails.
      const ir = this.impulse(2.8);
      this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
      this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.9;
      this.verbIn.connect(this.reverb).connect(this.sfxBus);
      const musicConv = ctx.createConvolver(); musicConv.buffer = ir;
      this.musicVerb = ctx.createGain();
      this.musicVerb.connect(musicConv).connect(this.musicBus);
      this.rain();
      this.apply();
      this.play(this.settings.track);
      this.timer = setInterval(() => this.schedule(), 25);
    } catch { /* Sound is optional. */ }
  }

  private impulse(seconds: number) {
    const ctx = this.ctx!, len = ctx.sampleRate * seconds, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    return b;
  }

  private rain() {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx); src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const g = ctx.createGain(); g.gain.value = 0.16;
    // Slow swells make the rain breathe instead of hissing flatly.
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.05;
    lfo.connect(lg).connect(g.gain); lfo.start();
    src.connect(hp).connect(lp).connect(g).connect(this.ambBus!); src.start();
    const low = ctx.createBufferSource(); low.buffer = noiseBuffer(ctx); low.loop = true;
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 260;
    const g2 = ctx.createGain(); g2.gain.value = 0.22;
    low.connect(lp2).connect(g2).connect(this.ambBus!); low.start(0.7);
  }

  apply() {
    const t = this.ctx?.currentTime ?? 0, s = this.settings;
    this.master?.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.15);
    this.musicBus?.gain.setTargetAtTime(s.music * 0.9, t, 0.15);
    this.sfxBus?.gain.setTargetAtTime(s.sfx, t, 0.1);
    this.ambBus?.gain.setTargetAtTime(s.ambience * 0.8, t, 0.2);
    try { localStorage.setItem('a07-audio', JSON.stringify(s)); } catch { /* storage optional */ }
    this.listeners.forEach(f => f());
  }

  set(patch: Partial<AudioSettings>) {
    const trackChanged = patch.track && patch.track !== this.settings.track;
    Object.assign(this.settings, patch);
    if (trackChanged && this.ctx) this.play(this.settings.track);
    this.apply();
  }

  onChange(f: () => void) { this.listeners.add(f); return () => this.listeners.delete(f); }

  step(by: number) {
    const i = TRACKS.findIndex(t => t.id === this.settings.track);
    this.set({ track: TRACKS[(i + by + TRACKS.length) % TRACKS.length].id });
  }

  current() { return TRACK_LIST.find(t => t.id === this.settings.track) ?? TRACK_LIST[0]; }

  /** Crossfade to another track. */
  private play(id: string) {
    const ctx = this.ctx!, def = TRACKS.find(t => t.id === id) ?? TRACKS[0];
    if (this.playing) {
      for (const old of [this.playing.gain, this.playing.wet]) {
        old.gain.cancelScheduledValues(ctx.currentTime);
        old.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        setTimeout(() => old.disconnect(), 5000);
      }
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
    gain.connect(this.musicBus!);
    // The track's reverb send fades with the track.
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(0.0001, ctx.currentTime); wet.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 2);
    wet.connect(this.musicVerb!);
    this.playing = { def, gain, wet, engine: new Engine(ctx, gain, wet), nextTime: ctx.currentTime + 0.15, step: 0, bar: 0 };
  }

  private schedule() {
    const ctx = this.ctx, p = this.playing;
    if (!ctx || !p || ctx.state !== 'running') return;
    const stepLen = 60 / p.def.bpm / 4;
    while (p.nextTime < ctx.currentTime + 0.12) {
      const chord = p.def.chords[p.bar % p.def.chords.length], next = p.def.chords[(p.bar + 1) % p.def.chords.length];
      const t = p.nextTime + (p.step % 2 ? p.def.swing * stepLen : 0);
      for (const v of p.def.voices) v(p.engine, t, p.step, p.bar, chord, next);
      if (p.def.crackle) p.engine.crackle(t, p.def.crackle);
      p.nextTime += stepLen;
      if (++p.step >= p.def.steps) { p.step = 0; p.bar++; }
    }
  }

  // ── Sound effects ──────────────────────────────────────────────
  private tone(f: number, at: number, len: number, peak: number, type: OscillatorType = 'sine', wet = 0.3) {
    const ctx = this.ctx; if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(this.sfxBus);
    if (wet) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s).connect(this.verbIn!); }
    o.start(t); o.stop(t + len + 0.05);
  }
  private burst(at: number, len: number, type: BiquadFilterType, freq: number, peak: number, sweepTo?: number) {
    const ctx = this.ctx; if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime + at, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuffer(ctx); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(this.sfxBus); src.start(t, Math.random()); src.stop(t + len + 0.05);
  }

  click() { this.tone(880, 0, 0.08, 0.04, 'triangle', 0); }
  hover() { this.tone(1320, 0, 0.05, 0.012, 'sine', 0); }
  whoosh() { this.burst(0, 0.35, 'bandpass', 600, 0.06, 2400); }
  good() { this.tone(523, 0, 0.5, 0.06); this.tone(784, 0.09, 0.6, 0.05); }
  bad() { this.tone(196, 0, 0.35, 0.06, 'triangle'); this.tone(185, 0.08, 0.4, 0.04, 'triangle'); }
  pickup() { [659, 784, 988, 1319].forEach((f, i) => this.tone(f, i * 0.06, 0.5, 0.045)); }
  unlock() { this.burst(0, 0.06, 'highpass', 3000, 0.12); this.burst(0.09, 0.08, 'bandpass', 1800, 0.1); this.tone(392, 0.15, 0.7, 0.05); this.tone(587, 0.25, 0.9, 0.05); }
  ping() { this.tone(1046, 0, 0.6, 0.05); this.tone(1568, 0.12, 0.7, 0.035); }
  page() { this.burst(0, 0.25, 'bandpass', 3500, 0.04, 1200); }
  footstep(running: boolean) { this.burst(0, running ? 0.09 : 0.07, 'lowpass', 300 + Math.random() * 250, running ? 0.09 : 0.05); }
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, i * 0.12, 1.6, 0.05)); }
  thunder(strength: number) {
    const ctx = this.ctx; if (!ctx || !this.ambBus) return;
    const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuffer(ctx); src.loop = true; f.type = 'lowpass';
    f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(90, t + 3.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * strength, t + 0.08);
    g.gain.setTargetAtTime(0.25 * strength, t + 0.3, 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    src.connect(f).connect(g).connect(this.ambBus); src.start(t); src.stop(t + 4.6);
  }
}

export const sound = new GameAudio();
