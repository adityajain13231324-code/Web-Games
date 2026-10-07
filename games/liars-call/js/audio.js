/* Liar's Call: every sound is synthesised with WebAudio, so there are no files to load. */
(function (root) {
  'use strict';
  var ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  var on = { sfx: true, music: true }, musicTimer = null, nextBeat = 0, beat = 0;
  try { var saved = JSON.parse(localStorage.getItem('lc-sound') || 'null'); if (saved) on = saved } catch (e) {}

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    var comp = ctx.createDynamicsCompressor(); comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = on.sfx ? 1 : 0; sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = on.music ? 0.32 : 0; musicBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function t0() { return ctx.currentTime }

  function env(g, t, a, peak, dec, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(end || 0.0001, t + a + dec);
  }
  function noise(t, dur, type, freq, q, peak, bus, sweepTo) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    var g = ctx.createGain(); env(g, t, 0.005, peak, dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function tone(t, freq, dur, type, peak, bus, slideTo, attack) {
    var o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    var g = ctx.createGain(); env(g, t, attack || 0.005, peak, dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  var S = {
    flick: function () { var t = t0(); noise(t, 0.07, 'bandpass', 2600, 1.2, 0.5) },
    deal: function () { var t = t0(); noise(t, 0.12, 'bandpass', 1800, 0.8, 0.35, null, 4200) },
    place: function () { var t = t0(); noise(t, 0.06, 'lowpass', 900, 1, 0.6); tone(t, 140, 0.06, 'sine', 0.25) },
    shuffle: function () { for (var i = 0; i < 9; i++) (function (i) { var t = t0() + i * 0.045; noise(t, 0.05, 'bandpass', 2000 + Math.random() * 1500, 1, 0.3) })(i) },
    flip: function () { var t = t0(); noise(t, 0.09, 'highpass', 1500, 0.7, 0.4, null, 6000) },
    click: function () { var t = t0(); tone(t, 900, 0.04, 'triangle', 0.18) },
    pop: function () { var t = t0(); tone(t, 520, 0.09, 'sine', 0.3, null, 900) },
    tick: function () { var t = t0(); tone(t, 1300, 0.03, 'square', 0.06) },
    slam: function () {
      var t = t0();
      tone(t, 120, 0.35, 'sine', 0.9, null, 40);
      noise(t, 0.25, 'lowpass', 1200, 0.7, 0.8);
      tone(t + 0.02, 70, 0.4, 'triangle', 0.5, null, 35);
    },
    gong: function (good) {
      var t = t0(), base = good ? 392 : 233;
      [1, 1.5, 2.01, 2.76].forEach(function (m, i) { tone(t, base * m, 1.4 - i * 0.25, 'sine', 0.22 / (i + 1)) });
    },
    sting: function (lie) {     // reveal verdict
      var t = t0();
      if (lie) { [0, 0.12, 0.24].forEach(function (d, i) { tone(t + d, [392, 370, 311][i], 0.25, 'sawtooth', 0.12) }) }
      else { [0, 0.1, 0.2].forEach(function (d, i) { tone(t + d, [523, 659, 784][i], 0.3, 'triangle', 0.18) }) }
    },
    heartbeat: function (n, gap) {
      n = n || 3; gap = gap || 0.62;
      for (var i = 0; i < n; i++) {
        var t = t0() + i * gap;
        tone(t, 62, 0.16, 'sine', 0.9, null, 45); tone(t + 0.17, 55, 0.14, 'sine', 0.6, null, 40);
      }
    },
    crunch: function () {
      for (var i = 0; i < 4; i++) (function (i) { var t = t0() + i * 0.06 + Math.random() * 0.02; noise(t, 0.07, 'bandpass', 900 + Math.random() * 1600, 1.5, 0.55) })(i);
    },
    phew: function () { var t = t0(); noise(t, 0.6, 'bandpass', 900, 2, 0.35, null, 400); tone(t + 0.05, 520, 0.4, 'sine', 0.12, null, 330) },
    fire: function () {
      var t = t0();
      noise(t, 1.4, 'lowpass', 300, 0.5, 0.9, null, 2800);
      noise(t + 0.1, 1.1, 'bandpass', 600, 0.8, 0.5, null, 3000);
      var o = tone(t + 0.15, 880, 1.0, 'sawtooth', 0.12, null, 1500, 0.05);   // the scream
      var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 9; lg.gain.value = 60;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 1.3);
    },
    out: function () { var t = t0(); [0, 0.22, 0.44, 0.7].forEach(function (d, i) { tone(t + d, [392, 349, 311, 233][i], i === 3 ? 0.7 : 0.22, 'triangle', 0.22) }) },
    win: function () {
      var t = t0(), notes = [523, 587, 659, 784, 659, 784, 1046];
      notes.forEach(function (f, i) { tone(t + i * 0.13, f, i === notes.length - 1 ? 0.8 : 0.16, 'square', 0.1); tone(t + i * 0.13, f / 2, 0.16, 'triangle', 0.12) });
      for (var i = 0; i < 8; i++) dhol(t + i * 0.13, i % 2);
    },
    whoosh: function () { var t = t0(); noise(t, 0.35, 'bandpass', 400, 1, 0.4, null, 3000) },
    yourturn: function () { var t = t0(); tone(t, 660, 0.12, 'triangle', 0.16); tone(t + 0.1, 880, 0.18, 'triangle', 0.16) },
    splash: function () { var t = t0(); noise(t, 0.25, 'bandpass', 1400, 1.2, 0.45, null, 500); for (var i = 0; i < 3; i++) tone(t + 0.05 + i * 0.05, 900 + Math.random() * 600, 0.06, 'sine', 0.12, null, 1800) },
    join: function () { var t = t0(); tone(t, 523, 0.1, 'triangle', 0.15); tone(t + 0.09, 784, 0.16, 'triangle', 0.15) },
    taunt: function () { var t = t0(); tone(t, 300, 0.12, 'triangle', 0.15, null, 500); tone(t + 0.12, 500, 0.15, 'triangle', 0.15, null, 300) }
  };

  /* --- background: a soft dhol groove with a little harmonium drone --- */
  function dhol(t, slap, bus) {
    bus = bus || sfxBus;
    if (slap) { noise(t, 0.08, 'bandpass', 2400, 1.5, 0.35, bus); tone(t, 330, 0.05, 'triangle', 0.15, bus) }
    else { tone(t, 95, 0.28, 'sine', 0.8, bus, 55); noise(t, 0.05, 'lowpass', 500, 1, 0.25, bus) }
  }
  //               1  .  .  2  .  .  3  .  4  .  .  5  .  6  .  .
  var PAT_BOOM = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0];
  var PAT_SLAP = [0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 1];
  var DRONE = [146.8, 220];
  var droneNodes = [];
  function schedule() {
    if (!ctx) return;
    var step = 60 / 104 / 4;                     // 104 bpm, 16th notes
    while (nextBeat < ctx.currentTime + 0.25) {
      var i = beat % 16;
      if (PAT_BOOM[i]) dhol(nextBeat, 0, musicBus);
      if (PAT_SLAP[i]) dhol(nextBeat, 1, musicBus);
      if (i === 0 && (beat / 16) % 4 === 3) noise(nextBeat, 0.4, 'highpass', 5000, 0.5, 0.15, musicBus); // little cymbal
      nextBeat += step; beat++;
    }
  }
  function startMusic() {
    if (!ctx || musicTimer) return;
    nextBeat = ctx.currentTime + 0.1; beat = 0;
    musicTimer = setInterval(schedule, 60);
    DRONE.forEach(function (f) {
      var o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = 700;
      g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 2);
      o.connect(fl); fl.connect(g); g.connect(musicBus); o.start();
      droneNodes.push({ o: o, g: g });
    });
  }
  function stopMusic() {
    clearInterval(musicTimer); musicTimer = null;
    droneNodes.forEach(function (n) { try { n.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); n.o.stop(ctx.currentTime + 1.2) } catch (e) {} });
    droneNodes = [];
  }
  function save() { try { localStorage.setItem('lc-sound', JSON.stringify(on)) } catch (e) {} }

  /* --- goofy character voices (the browser's own speech engine) --- */
  var VOICE = {
    sharma: { pitch: 0.5, rate: 0.9 }, pinky: { pitch: 1.75, rate: 1.15 }, bunty: { pitch: 2, rate: 1.3 },
    gupta: { pitch: 1.05, rate: 1.4 }, dadi: { pitch: 1.4, rate: 0.72 }, rocky: { pitch: 0.3, rate: 0.85 }
  };
  var voicePick = null;
  function pickVoice() {
    if (voicePick || !root.speechSynthesis) return voicePick;
    var vs = root.speechSynthesis.getVoices();
    voicePick = vs.find(function (v) { return /^hi/i.test(v.lang) }) || vs.find(function (v) { return /en-IN/i.test(v.lang) }) || vs.find(function (v) { return /^en/i.test(v.lang) }) || vs[0] || null;
    return voicePick;
  }
  if (root.speechSynthesis) { try { root.speechSynthesis.onvoiceschanged = function () { voicePick = null; pickVoice() } } catch (e) {} }
  function speak(text, key) {
    if (on.voice === false || !root.speechSynthesis || !root.SpeechSynthesisUtterance) return;
    try {
      var u = new SpeechSynthesisUtterance(String(text).replace(/[!?.]+/g, '!').slice(0, 60));
      var p = VOICE[key] || { pitch: 1, rate: 1 };
      u.pitch = p.pitch; u.rate = p.rate; u.volume = 1;
      var v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang }
      root.speechSynthesis.cancel();
      root.speechSynthesis.speak(u);
    } catch (e) {}
  }

  var API = {
    speak: function () {},   // character voices removed
    init: init,
    play: function (name) { if (!ctx || !on.sfx || !S[name]) return; try { S[name].apply(null, [].slice.call(arguments, 1)) } catch (e) {} },
    startMusic: startMusic, stopMusic: stopMusic,
    // duck the music during tense moments
    duck: function (yes) { if (ctx && on.music) musicBus.gain.setTargetAtTime(yes ? 0.08 : 0.32, ctx.currentTime, 0.2) },
    toggle: function (which) {
      on[which] = on[which] === false; save();
      if (ctx) {
        if (which === 'sfx') sfxBus.gain.value = on.sfx ? 1 : 0;
        if (which === 'music') musicBus.gain.setTargetAtTime(on.music ? 0.32 : 0, ctx.currentTime, 0.1);
      }
      return on[which];
    },
    isOn: function (w) { return on[w] !== false }
  };
  root.LCAudio = API;
})(this);
