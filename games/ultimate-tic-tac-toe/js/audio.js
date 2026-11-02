/* Sound: everything is synthesised with the Web Audio API, no files.
   Each theme picks a "pack" that changes the waveform, filter, envelope and extras, so the same
   events (place, illegal, board win, ...) sound different per theme.
   The AudioContext is only created after the first user gesture (browsers require it). */
(function (root) {
  'use strict';
  const store = root.UTTT.store;

  /* wave: oscillator type; lp: low-pass cutoff Hz; base: root note Hz; len: envelope length scale;
     noise: 0-1 amount of noisy "scratch" in the place sound; echo: delay feedback (0 = none);
     glide: pitch bend on place (+up / -down); partial: gain of an octave overtone (bell-like). */
  const PACKS = {
    synth:  { wave: 'sawtooth', lp: 2200, base: 262, len: 1,   noise: 0,   echo: .28, glide: -.1,  partial: 0 },
    pencil: { wave: 'triangle', lp: 1800, base: 196, len: .7,  noise: .9,  echo: 0,   glide: 0,    partial: 0 },
    soft:   { wave: 'sine',     lp: 3200, base: 330, len: 1.2, noise: 0,   echo: .12, glide: 0,    partial: .15 },
    chip:   { wave: 'square',   lp: 9000, base: 392, len: .6,  noise: 0,   echo: 0,   glide: .0,   partial: 0 },
    bubble: { wave: 'sine',     lp: 2600, base: 294, len: 1.3, noise: 0,   echo: .35, glide: .35,  partial: 0 },
    wood:   { wave: 'triangle', lp: 1500, base: 175, len: .8,  noise: .35, echo: 0,   glide: -.04, partial: .2 },
    bell:   { wave: 'sine',     lp: 6000, base: 523, len: 1.6, noise: 0,   echo: .18, glide: 0,    partial: .45 },
  };
  const MAJOR = [0, 4, 7, 12, 16];
  const semis = (n) => Math.pow(2, n / 12);

  let ctx = null, master = null, bus = null, echoSend = null;
  let pack = PACKS.synth;
  const state = Object.assign({ muted: false, vol: .7 }, store.get('sound', {}));

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      bus = ctx.createDynamicsCompressor();
      bus.connect(master); master.connect(ctx.destination);
      echoSend = ctx.createGain(); echoSend.gain.value = 0;
      const delay = ctx.createDelay(1); delay.delayTime.value = .19;
      const fb = ctx.createGain(); fb.gain.value = .35;
      echoSend.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(bus);
      applyVolume();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function applyVolume() {
    if (master) master.gain.value = state.muted ? 0 : Math.pow(state.vol, 1.6) * .8;
  }

  /* Browsers only allow audio after a gesture: the first one anywhere unlocks it. */
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => root.addEventListener(ev, unlock, { passive: true }));

  /* One note: oscillator -> low-pass -> envelope -> bus (and the echo send). */
  function tone(freq, o) {
    if (!ctx || state.muted) return;
    o = o || {};
    const t0 = ctx.currentTime + (o.at || 0), dur = (o.dur || .15) * pack.len;
    const osc = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    osc.type = o.wave || pack.wave;
    osc.frequency.setValueAtTime(freq, t0);
    const bend = o.glide == null ? pack.glide : o.glide;
    if (bend) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * (1 + bend)), t0 + dur * .9);
    lp.type = 'lowpass'; lp.frequency.value = o.lp || pack.lp;
    const vol = (o.vol == null ? .5 : o.vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + .006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(lp); lp.connect(g); g.connect(bus);
    if (pack.echo) { const s = ctx.createGain(); s.gain.value = pack.echo; g.connect(s); s.connect(echoSend); echoSend.gain.value = 1; }
    osc.start(t0); osc.stop(t0 + dur + .05);
    if (pack.partial && !o.plain) tone(freq * 2, { at: o.at, dur: o.dur, vol: vol * pack.partial, plain: true, glide: 0 });
  }

  /* A short burst of filtered noise: the pencil scratch, a drum tick, a soft "nope". */
  function noise(o) {
    if (!ctx || state.muted) return;
    const t0 = ctx.currentTime + (o.at || 0), dur = o.dur || .08;
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.freq || 2400; f.Q.value = o.q || 1.2;
    const g = ctx.createGain(); g.gain.value = o.vol || .3;
    src.connect(f); f.connect(g); g.connect(bus); src.start(t0);
  }

  const SOUNDS = {
    place(p) {
      const f = pack.base * (p === 2 ? semis(7) : 1) * 2;
      tone(f, { dur: .13, vol: .42 });
      if (pack.noise) noise({ dur: .07, freq: 2600, vol: .5 * pack.noise });
      tone(f / 4, { dur: .09, vol: .25, glide: -.2, wave: 'sine' });
    },
    illegal() {
      tone(pack.base * .55, { dur: .1, vol: .3, wave: 'square', lp: 700, glide: -.12 });
      tone(pack.base * .5, { at: .09, dur: .12, vol: .3, wave: 'square', lp: 600, glide: -.12 });
    },
    boardWin(p) {
      const r = pack.base * 2 * (p === 2 ? semis(2) : 1);
      [0, 4, 7].forEach((n, i) => tone(r * semis(n), { at: i * .075, dur: .22, vol: .38, glide: 0 }));
    },
    gameWin() {
      const r = pack.base * 2;
      MAJOR.forEach((n, i) => tone(r * semis(n), { at: i * .1, dur: .34, vol: .38, glide: 0 }));
      [0, 4, 7, 12].forEach((n) => tone(r * semis(n), { at: .55, dur: .9, vol: .22, glide: 0 }));
    },
    draw() {
      const r = pack.base * 2;
      tone(r * semis(7), { dur: .3, vol: .3, glide: 0 });
      tone(r * semis(3), { at: .2, dur: .45, vol: .3, glide: 0 });
    },
    click() { tone(pack.base * 4, { dur: .04, vol: .18, glide: 0 }); },
    theme() {
      tone(pack.base * 1.5, { dur: .22, vol: .3, glide: 1 });
      tone(pack.base * 3, { at: .1, dur: .25, vol: .25, glide: 0 });
    },
    hint() {
      tone(pack.base * 4, { dur: .12, vol: .25, glide: 0 });
      tone(pack.base * 4 * semis(7), { at: .1, dur: .18, vol: .25, glide: 0 });
    },
    tick() { tone(pack.base * 4, { dur: .05, vol: .2, glide: 0, wave: 'square', lp: 2500 }); },
    undo() { tone(pack.base * 2, { dur: .16, vol: .28, glide: -.4 }); },
  };

  function play(name, arg) {
    if (!ctx || state.muted) return;
    const fn = SOUNDS[name];
    if (fn) try { fn(arg); } catch (e) { console.warn('sound failed:', name, e); }
  }

  function save() { store.set('sound', { muted: state.muted, vol: state.vol }); }

  root.UTTT.audio = {
    play,
    unlock,
    setPack(id) { pack = PACKS[id] || PACKS.synth; },
    setMuted(m) { state.muted = !!m; applyVolume(); save(); },
    setVolume(v) { state.vol = Math.min(1, Math.max(0, v)); applyVolume(); save(); },
    get muted() { return state.muted; },
    get volume() { return state.vol; },
    get running() { return !!ctx && ctx.state === 'running'; },
  };
})(window);
