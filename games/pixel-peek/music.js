/* Pixel Peek background music.
   Three original loops, synthesised live with WebAudio: no audio files, no licences, works offline.
   Silent until the player taps the note button (browser rule), remembers the choice, and follows the
   existing sound button (pp-mute). Pauses while the tab is hidden. */
(function () {
  'use strict';
  var AudioCtor = window.AudioContext || window.webkitAudioContext;
  var bar = document.querySelector('header.top');
  var muteBtn = document.getElementById('muteBtn');
  if (!AudioCtor || !bar || !muteBtn) return;

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
  };

  // chord shapes (semitones above the root)
  var MAJ = [0, 4, 7, 12], MIN = [0, 3, 7, 12], MIN7 = [0, 3, 7, 10], MAJ7 = [0, 4, 7, 11], DOM7 = [0, 4, 7, 10];
  var TRACKS = [
    { name: 'Pixel Playground', bpm: 118, wave: 'square', lead: 'triangle', seed: 7, drums: 'full', level: 1,
      scale: [0, 2, 4, 7, 9], bars: [[48, MAJ], [53, MAJ], [45, MIN], [55, MAJ]],
      bass: [0, 6, 8, 14], kick: [0, 8], hat: [2, 6, 10, 14] },
    { name: 'Night Arcade', bpm: 102, wave: 'sawtooth', lead: 'square', seed: 21, drums: 'full', level: .8,
      scale: [0, 3, 5, 7, 10], bars: [[45, MIN], [41, MAJ], [48, MAJ], [43, MAJ]],
      bass: [0, 3, 8, 11], kick: [0, 6, 8], hat: [4, 12] },
    { name: 'Lo-fi Focus', bpm: 80, wave: 'sine', lead: 'triangle', seed: 3, drums: 'soft', level: 1.1,
      scale: [0, 2, 4, 7, 9], bars: [[50, MIN7], [43, DOM7], [48, MAJ7], [45, MIN7]],
      bass: [0, 10], kick: [0, 10], hat: [4, 12] }
  ];

  function rng(seed) { // small deterministic PRNG so each loop plays the same melody every time round
    return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  TRACKS.forEach(function (tr) { // 4 bars x 8 eighth-note slots; -1 is a rest
    var r = rng(tr.seed), mel = [], prev = 2;
    for (var b = 0; b < 4; b++) for (var s = 0; s < 8; s++) {
      if (r() < (s === 0 ? .1 : .38)) { mel.push(-1); continue; }
      prev = Math.max(0, Math.min(tr.scale.length * 2 - 1, prev + Math.round(r() * 4 - 2)));
      mel.push(prev);
    }
    tr.mel = mel;
  });

  var ac = null, master = null, bus = null, noise = null, timer = null;
  var index = -1, step = 0, nextAt = 0, muted = store.get('pp-mute') === '1';
  var saved = parseInt(store.get('pp-music'), 10);
  var want = saved >= 0 && saved < TRACKS.length ? saved : -1; // the track the player last chose

  function setup() {
    ac = new AudioCtor();
    master = ac.createGain(); master.gain.value = .32;
    var comp = ac.createDynamicsCompressor();
    master.connect(comp); comp.connect(ac.destination);
    var len = ac.sampleRate >> 3, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noise = buf;
  }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function tone(m, t, dur, vol, type) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = hz(m);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + .03);
    o.onended = function () { o.disconnect(); g.disconnect(); };
  }
  function kick(t, vol) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .18);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + .2);
    o.onended = function () { o.disconnect(); g.disconnect(); };
  }
  function hat(t, vol) {
    var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + .06);
    s.onended = function () { s.disconnect(); f.disconnect(); g.disconnect(); };
  }

  function schedule() {
    if (index < 0 || !ac || ac.state !== 'running') return;
    var tr = TRACKS[index], sec = 60 / tr.bpm / 4; // one 16th note
    if (nextAt < ac.currentTime - .15) nextAt = ac.currentTime + .03; // fell behind (tab stalled): resync
    while (nextAt < ac.currentTime + .2) {
      var bar16 = step % 64, barNo = bar16 >> 4, s = bar16 & 15, ch = tr.bars[barNo], root = ch[0], shape = ch[1];
      if (tr.bass.indexOf(s) >= 0) tone(root - 12, nextAt, sec * 3, .34 * tr.level, 'triangle');
      if (s === 0) for (var k = 0; k < shape.length - 1; k++) tone(root + shape[k], nextAt, sec * 14, .05 * tr.level, 'sine');
      if (!(s & 1)) { // eighth-note arpeggio
        var n = shape[(s >> 1) % shape.length];
        tone(root + 12 + n, nextAt, sec * 1.8, .07 * tr.level, tr.wave);
        var m = tr.mel[barNo * 8 + (s >> 1)];
        if (m >= 0) tone(root + 24 + tr.scale[m % tr.scale.length] + 12 * Math.floor(m / tr.scale.length) - 12, nextAt, sec * 2.2, .085 * tr.level, tr.lead);
      }
      if (tr.kick.indexOf(s) >= 0) kick(nextAt, tr.drums === 'soft' ? .22 : .38);
      if (tr.hat.indexOf(s) >= 0) hat(nextAt, tr.drums === 'soft' ? .035 : .06);
      step++; nextAt += sec;
    }
  }

  function play(i) {
    stop();
    index = i;
    bus = ac.createGain();
    bus.gain.setValueAtTime(0, ac.currentTime);
    bus.gain.linearRampToValueAtTime(muted ? 0 : 1, ac.currentTime + .5);
    bus.connect(master);
    step = 0; nextAt = ac.currentTime + .05;
    schedule(); timer = setInterval(schedule, 50);
  }
  function stop() {
    clearInterval(timer); timer = null;
    if (bus) {
      var old = bus; bus = null;
      old.gain.cancelScheduledValues(ac.currentTime);
      old.gain.setTargetAtTime(0, ac.currentTime, .1);
      setTimeout(function () { old.disconnect(); }, 1200);
    }
    index = -1;
  }

  /* ---- the button ---- */
  var btn = document.createElement('button');
  btn.className = 'iconbtn'; btn.id = 'musicBtn'; btn.type = 'button';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';
  bar.insertBefore(btn, muteBtn);
  var style = document.createElement('style');
  style.textContent = '#musicBtn.on{color:var(--fg,#f7f0e6);border-color:var(--line2,#6f6290)}' +
    '#musicBtn.on svg{animation:ppBob 1s ease-in-out infinite alternate}@keyframes ppBob{to{transform:translateY(-2px)}}' +
    '@media (prefers-reduced-motion:reduce){#musicBtn.on svg{animation:none}}';
  document.head.appendChild(style);

  function label() {
    var text = index < 0 ? 'Music off. Tap to play ' + TRACKS[0].name
      : muted ? 'Music paused while sound is off'
      : 'Now playing ' + TRACKS[index].name + '. Tap for ' + (index === TRACKS.length - 1 ? 'no music' : TRACKS[index + 1].name);
    btn.setAttribute('aria-label', text); btn.title = text;
    btn.classList.toggle('on', index >= 0 && !muted);
  }
  function say(msg) { if (typeof window.toast === 'function') try { window.toast(msg); } catch (e) { /* page has no toast */ } }

  async function ensure() {
    if (!ac) setup();
    if (ac.state !== 'running') await ac.resume();
    return ac.state === 'running';
  }
  btn.addEventListener('click', async function () {
    try {
      if (!(await ensure())) throw new Error('suspended');
      if (muted) { say('Turn sound on first (speaker button)'); return; }
      var next = index + 1 >= TRACKS.length ? -1 : index + 1;
      want = next; store.set('pp-music', String(next));
      if (next < 0) stop(); else play(next);
      label();
      say(next < 0 ? 'Music off' : '♪ ' + TRACKS[next].name);
    } catch (e) { stop(); label(); say('Music could not start. Tap again.'); }
  });
  btn.addEventListener('keydown', function (e) { e.stopPropagation(); }); // typing guesses must not trigger it

  // the page's sound button also controls the music (its handler runs first, then we re-read the flag)
  muteBtn.addEventListener('click', function () {
    setTimeout(function () {
      muted = store.get('pp-mute') === '1';
      if (bus) { bus.gain.cancelScheduledValues(ac.currentTime); bus.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, .1); }
      label();
    }, 0);
  });

  // a saved choice resumes on the player's first tap anywhere (browsers need a gesture)
  if (want >= 0) {
    var resume = async function () {
      document.removeEventListener('pointerdown', resume, true);
      document.removeEventListener('keydown', resume, true);
      try { if (await ensure() && index < 0) { play(want); label(); } } catch (e) { /* stays off */ }
    };
    document.addEventListener('pointerdown', resume, true);
    document.addEventListener('keydown', resume, true);
  }

  document.addEventListener('visibilitychange', async function () {
    if (!ac) return;
    try {
      if (document.hidden) { clearInterval(timer); timer = null; await ac.suspend(); }
      else if (index >= 0) { await ac.resume(); nextAt = ac.currentTime + .05; if (!timer) timer = setInterval(schedule, 50); }
    } catch (e) { /* tap the button to restart */ }
  });
  window.addEventListener('pagehide', function () { clearInterval(timer); if (ac) ac.close(); });

  label();
})();
