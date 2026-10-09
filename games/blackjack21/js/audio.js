/* Blackjack 21: audio. Every sound and all ten music tracks are synthesised with WebAudio, so there are no
   audio files to load or license. The music is composed on the fly from small rule sets (chords, bass line,
   comping rhythm, drums, a generated melody), so each track is a loop that never plays the exact same lead twice
   in a row. The composer (pure data) is kept apart from the player (WebAudio) so it can be tested in Node. */
(function (root) {
  'use strict';

  /* ================= composer: pure functions, no audio ================= */
  var Q = { M: [0, 4, 7], maj7: [0, 4, 7, 11], '6': [0, 4, 7, 9], m: [0, 3, 7], m7: [0, 3, 7, 10], m6: [0, 3, 7, 9],
    '7': [0, 4, 7, 10], m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9], sus: [0, 5, 7, 10], '7b9': [0, 4, 7, 10, 13], add9: [0, 4, 7, 14] };
  var PC = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
  function ch(name, q) { return [PC[name], q] }
  var MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], MAJP = [0, 2, 4, 7, 9], MINP = [0, 3, 5, 7, 10];

  function R(steps) { return steps.map(function (s) { return { step: s[0], dur: s[1] } }) }   // [step, length in steps]

  /* The ten tracks. steps = sixteenth notes per bar (16, or 12 for the waltz). prog = one array of chords per bar. */
  var TRACKS = [
    { id: 1, name: 'Green Felt', mood: 'Lobby, warm swing', bpm: 96, swing: .6, steps: 16, scale: MAJ, key: 'F',
      prog: [[ch('F', 'maj7')], [ch('D', 'm7')], [ch('G', 'm7')], [ch('C', '7')], [ch('F', 'maj7')], [ch('D', 'm7')], [ch('G', 'm7'), ch('C', '7')], [ch('F', '6')]],
      bass: 'walk', drums: 'swing', comp: 'charleston', compInst: 'rhodes', pad: false, lead: 'vibes', leadLo: 65, leadHi: 84, leadProb: .8,
      leadRhythms: [R([[0, 6], [8, 4], [12, 4]]), R([[0, 4], [6, 6], [12, 4]]), R([[2, 6], [8, 8]]), R([[0, 8], [8, 4], [14, 2]])], vol: { bass: .9, comp: .8, lead: .85, drums: .8 } },

    { id: 2, name: 'Smoky Back Room', mood: 'Calm betting, slow noir', bpm: 72, swing: .62, steps: 16, scale: MIN, key: 'D',
      prog: [[ch('D', 'm7')], [ch('Bb', 'maj7')], [ch('G', 'm7')], [ch('A', '7b9')], [ch('D', 'm7')], [ch('Bb', 'maj7')], [ch('E', 'm7b5'), ch('A', '7')], [ch('D', 'm6')]],
      bass: 'half', drums: 'brush', comp: 'sustain', compInst: 'rhodes', pad: true, lead: 'trumpet', leadLo: 62, leadHi: 79, leadProb: .92,
      leadRhythms: [R([[0, 12]]), R([[4, 8], [12, 4]]), R([[0, 6], [8, 8]]), R([[2, 14]])], vol: { bass: .9, comp: .7, lead: .9, drums: .7, pad: .8 } },

    { id: 3, name: 'Shuffle & Deal', mood: 'Early rounds, upbeat swing', bpm: 132, swing: .6, steps: 16, scale: MAJ, key: 'Bb',
      prog: [[ch('Bb', '6')], [ch('G', '7')], [ch('C', 'm7')], [ch('F', '7')], [ch('Bb', '6')], [ch('G', 'm7')], [ch('C', 'm7'), ch('F', '7')], [ch('Bb', '6'), ch('F', '7')]],
      bass: 'walk', drums: 'swing', comp: 'charleston', compInst: 'piano', pad: false, lead: 'piano', leadLo: 67, leadHi: 86, leadProb: .9,
      leadRhythms: [R([[0, 3], [3, 3], [6, 2], [8, 4], [12, 4]]), R([[0, 2], [2, 4], [6, 4], [10, 2], [12, 4]]), R([[2, 2], [4, 4], [8, 2], [10, 6]]), R([[0, 6], [6, 2], [8, 2], [10, 2], [12, 4]])], vol: { bass: .85, comp: .8, lead: .8, drums: .75 } },

    { id: 4, name: 'High Roller', mood: 'Big bets, big band', bpm: 120, swing: .55, steps: 16, scale: MAJ, key: 'C',
      prog: [[ch('C', 'M')], [ch('C', '7')], [ch('F', 'M')], [ch('F', 'm')], [ch('C', 'M')], [ch('A', '7')], [ch('D', 'm7'), ch('G', '7')], [ch('C', '6')]],
      bass: 'walk', drums: 'bigband', comp: 'stab', compInst: 'brass', pad: false, lead: 'trumpet', leadLo: 67, leadHi: 86, leadProb: .8,
      leadRhythms: [R([[0, 2], [2, 2], [4, 4], [8, 4], [12, 4]]), R([[0, 6], [6, 2], [8, 4], [12, 2], [14, 2]]), R([[2, 2], [6, 2], [8, 8]]), R([[0, 4], [4, 2], [6, 2], [8, 8]])], vol: { bass: .85, comp: .75, lead: .75, drums: .8 } },

    { id: 5, name: 'Chip Stack Bossa', mood: 'Relaxed, bossa nova', bpm: 110, swing: 0, steps: 16, scale: MIN, key: 'A',
      prog: [[ch('A', 'm7')], [ch('D', 'm7')], [ch('B', 'm7b5')], [ch('E', '7b9')], [ch('A', 'm7')], [ch('D', 'm7')], [ch('E', '7')], [ch('A', 'm6')]],
      bass: 'bossa', drums: 'bossa', comp: 'bossa', compInst: 'pluck', pad: false, lead: 'vibes', leadLo: 64, leadHi: 83, leadProb: .7,
      leadRhythms: [R([[0, 3], [3, 3], [6, 4], [10, 6]]), R([[0, 6], [6, 3], [9, 3], [12, 4]]), R([[2, 4], [6, 2], [8, 8]]), R([[0, 4], [4, 4], [10, 2], [12, 4]])], vol: { bass: .9, comp: .8, lead: .8, drums: .75 } },

    { id: 6, name: 'Midnight Vegas', mood: 'Mid game, rat-pack lounge', bpm: 100, swing: .6, steps: 16, scale: MAJ, key: 'Eb',
      prog: [[ch('Eb', 'maj7')], [ch('C', 'm7')], [ch('F', 'm7')], [ch('Bb', '7')], [ch('Eb', 'maj7')], [ch('C', '7')], [ch('F', 'm7')], [ch('Bb', '7')]],
      bass: 'walk', drums: 'brush', comp: 'sustain', compInst: 'vibes', pad: true, lead: 'vibes', leadLo: 67, leadHi: 86, leadProb: .75,
      leadRhythms: [R([[0, 6], [6, 2], [8, 8]]), R([[0, 4], [4, 4], [8, 4], [12, 4]]), R([[2, 6], [8, 4], [12, 4]]), R([[0, 8], [10, 6]])], vol: { bass: .85, comp: .75, lead: .85, drums: .65, pad: .6 } },

    { id: 7, name: 'Dealer Stands on 17', mood: 'Tension, the dealer plays', bpm: 90, swing: 0, steps: 16, scale: [0, 1, 3, 5, 7, 8, 10], key: 'E',
      prog: [[ch('E', 'm')], [ch('E', 'm')], [ch('C', 'maj7')], [ch('B', '7')], [ch('E', 'm')], [ch('E', 'm')], [ch('C', 'maj7')], [ch('B', '7')]],
      bass: 'pedal', drums: 'tense', comp: 'none', compInst: 'pad', pad: true, lead: 'ping', leadLo: 76, leadHi: 91, leadProb: .8,
      leadRhythms: [R([[0, 2]]), R([[6, 2]]), R([[10, 2]]), R([[3, 2], [11, 2]])], vol: { bass: .9, drums: .9, pad: .9, lead: .5 } },

    { id: 8, name: 'All In', mood: 'Final rounds, driving', bpm: 140, swing: 0, steps: 16, scale: MINP, key: 'A',
      prog: [[ch('A', 'm')], [ch('F', 'M')], [ch('C', 'M')], [ch('G', 'M')], [ch('A', 'm')], [ch('F', 'M')], [ch('C', 'M')], [ch('E', '7')]],
      bass: 'drive', drums: 'drive', comp: 'arp', compInst: 'synth', pad: true, lead: 'none', leadLo: 72, leadHi: 91, leadProb: 0,
      leadRhythms: [R([[0, 2]])], vol: { bass: 1.6, comp: 1.6, drums: 1.2, pad: 1.5 } },

    { id: 9, name: 'Lucky Streak', mood: 'Win streaks, ragtime', bpm: 150, swing: 0, steps: 16, scale: MAJ, key: 'G',
      prog: [[ch('G', 'M')], [ch('E', '7')], [ch('A', '7')], [ch('D', '7')], [ch('G', 'M')], [ch('E', '7')], [ch('A', 'm7'), ch('D', '7')], [ch('G', '6')]],
      bass: 'oompah', drums: 'ragtime', comp: 'oompah', compInst: 'piano', pad: false, lead: 'piano', leadLo: 67, leadHi: 91, leadProb: 1,
      leadRhythms: [R([[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]]), R([[0, 2], [2, 2], [4, 2], [6, 3], [9, 3], [12, 4]]), R([[3, 3], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]]), R([[0, 3], [3, 3], [6, 4], [10, 2], [12, 4]])], vol: { bass: .8, comp: .75, lead: .85, drums: .4 } },

    { id: 10, name: 'Last Hand', mood: 'Final round and standings, waltz', bpm: 66, swing: 0, steps: 12, scale: MIN, key: 'G',
      prog: [[ch('G', 'm')], [ch('C', 'm')], [ch('D', '7')], [ch('G', 'm')], [ch('Eb', 'M')], [ch('C', 'm')], [ch('D', '7')], [ch('G', 'm')]],
      bass: 'waltz', drums: 'none', comp: 'waltz', compInst: 'piano', pad: true, lead: 'piano', leadLo: 67, leadHi: 84, leadProb: .85,
      leadRhythms: [R([[0, 8], [8, 4]]), R([[0, 4], [4, 4], [8, 4]]), R([[0, 12]]), R([[0, 6], [6, 6]])], vol: { bass: .8, comp: .6, lead: .85, pad: .8 } }
  ];

  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
  }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12) }

  function chordAt(tr, bar, step) { var b = tr.prog[bar % tr.prog.length]; return b.length === 2 && step >= tr.steps / 2 ? b[1] : b[0] }
  function tonesOf(c) { return Q[c[1]].map(function (i) { return (c[0] + i) % 12 }) }
  function place(pc, lo, hi) { var m = pc + 12 * Math.ceil((lo - pc) / 12); while (m > hi) m -= 12; return m }
  function voicing(c, lo, hi) { return tonesOf(c).map(function (pc) { return place(pc, lo, hi) }).sort(function (a, b) { return a - b }) }
  function bassRoot(c) { var m = c[0]; while (m < 28) m += 12; return m }

  // melody for one loop of the progression: phrases of 4 bars; the second phrase repeats the first and answers at the end
  function buildLead(tr) {
    var rand = rng(hash('lead' + tr.id)), bars = tr.prog.length, out = [];
    if (tr.lead === 'none') { for (var z = 0; z < bars; z++) out.push([]); return out }
    var scaleNotes = [];       // the notes of the key inside the lead's range (scale degrees are relative to the key root)
    for (var n = tr.leadLo; n <= tr.leadHi; n++) if (tr.scale.indexOf((((n - PC[tr.key]) % 12) + 12) % 12) >= 0) scaleNotes.push(n);
    var idx = Math.floor(scaleNotes.length / 2);
    function nearestTone(c, target) {
      var tones = tonesOf(c), best = idx, bd = 99;
      for (var i = 0; i < scaleNotes.length; i++) if (tones.indexOf(scaleNotes[i] % 12) >= 0) { var d = Math.abs(i - target); if (d < bd) { bd = d; best = i } }
      return best;
    }
    function makeBar(b, resolve) {
      var ev = [];
      if (!resolve && rand() > tr.leadProb) return ev;
      var tpl = tr.leadRhythms[Math.floor(rand() * tr.leadRhythms.length)];
      tpl.forEach(function (r, k) {
        var c = chordAt(tr, b, r.step), strong = r.step % 8 === 0 || k === 0;
        if (resolve && k === tpl.length - 1) idx = nearestTone([c[0], c[1]], idx - 2);        // end the phrase on a chord tone
        else if (strong) idx = nearestTone(c, idx + Math.floor(rand() * 5) - 2);
        else idx += rand() < .7 ? (rand() < .5 ? 1 : -1) : (rand() < .5 ? 2 : -2);
        idx = Math.max(0, Math.min(scaleNotes.length - 1, idx));
        ev.push({ step: r.step, midi: scaleNotes[idx], dur: r.dur });
      });
      return ev;
    }
    var phrase = [];
    for (var b0 = 0; b0 < 4 && b0 < bars; b0++) phrase.push(makeBar(b0, b0 === 3));
    for (var b = 0; b < bars; b++) {
      if (b < 4) out.push(phrase[b]);
      else if (b < 7 && phrase[b - 4]) out.push(phrase[b - 4].map(function (e) { return { step: e.step, midi: e.midi, dur: e.dur } }));
      else out.push(makeBar(b, true));
    }
    return out;
  }

  var RT = {};                       // per-track runtime data (generated once)
  function runtime(tr) { return RT[tr.id] || (RT[tr.id] = { lead: buildLead(tr), rand: rng(hash('rt' + tr.id)) }) }
  function byId(id) { for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === id) return TRACKS[i]; return null }

  /* Everything that sounds on one sixteenth-note step. Events: {inst, midi|midis, dur (in steps), vel} or {drum, vel}. */
  function composeStep(tr, bar, step) {
    var ev = [], rt = runtime(tr), c = chordAt(tr, bar, step), nextBar = (bar + 1) % tr.prog.length, S = tr.steps, half = S / 2;
    var beat = step % 4 === 0;
    var root = bassRoot(c), tones = tonesOf(c);

    // ----- bass -----
    switch (tr.bass) {
      case 'walk': {
        if (S === 16 && beat) {
          var k = step / 4, nc = tr.prog[bar % tr.prog.length], second = nc.length === 2;
          var cc = second && step >= half ? nc[1] : nc[0], r0 = bassRoot(cc);
          var nextC = second && step < half ? nc[1] : tr.prog[nextBar][0], nr = bassRoot(nextC);
          var third = r0 + (Q[cc[1]][1] || 4), fifth = r0 + 7, midi;
          if (second) midi = (k % 2 === 0) ? r0 : ((k === 1) ? third : (nr + (nr > r0 ? -1 : 1)));
          else midi = [r0, third, fifth, nr + (nr >= r0 ? -1 : 1)][k];
          if (k === 3 && !second) { var diff = nr - r0; midi = nr + (diff >= 0 ? -1 : 1) }
          while (midi > 46) midi -= 12;
          ev.push({ inst: 'bass', midi: midi, dur: 3.6, vel: k === 0 ? 1 : .85 });
        }
        break;
      }
      case 'half': if (step === 0) ev.push({ inst: 'bass', midi: root, dur: 10, vel: 1 }); if (step === 8) ev.push({ inst: 'bass', midi: root + 7, dur: 6, vel: .8 }); break;
      case 'bossa': if (step === 0) ev.push({ inst: 'bass', midi: root, dur: 5, vel: 1 }); if (step === 6) ev.push({ inst: 'bass', midi: root + 7 > 46 ? root - 5 : root + 7, dur: 2, vel: .8 });
        if (step === 8) ev.push({ inst: 'bass', midi: root, dur: 5, vel: .95 }); if (step === 14) ev.push({ inst: 'bass', midi: root + 7 > 46 ? root - 5 : root + 7, dur: 2, vel: .75 }); break;
      case 'pedal': if (step === 0 && bar % 2 === 0) ev.push({ inst: 'bass', midi: root < 36 ? root : root - 12, dur: 31, vel: 1, long: true }); break;
      case 'drive': if (step % 2 === 0) ev.push({ inst: 'sbass', midi: root, dur: 1.6, vel: step % 8 === 0 ? 1 : .7 }); if (step === 6 || step === 14) ev.push({ inst: 'sbass', midi: root + 12, dur: 1.2, vel: .6 }); break;
      case 'oompah': if (step === 0) ev.push({ inst: 'bass', midi: root, dur: 3, vel: 1 }); if (step === 8) ev.push({ inst: 'bass', midi: root + 7 > 46 ? root - 5 : root + 7, dur: 3, vel: .85 }); break;
      case 'waltz': if (step === 0) ev.push({ inst: 'bass', midi: root, dur: 8, vel: 1 }); break;
    }

    // ----- chords -----
    var vc = voicing(c, 54, 71), at = function (steps) { return steps.indexOf(step) >= 0 };
    switch (tr.comp) {
      case 'charleston': if (at([0])) ev.push({ inst: tr.compInst, midis: vc, dur: 5, vel: .8 }); if (at([6, 14])) ev.push({ inst: tr.compInst, midis: vc, dur: 3, vel: .55 }); break;
      case 'sustain': if (step === 0 || (tr.prog[bar % tr.prog.length].length === 2 && step === half)) ev.push({ inst: tr.compInst, midis: vc, dur: (tr.prog[bar % tr.prog.length].length === 2 ? half : S) - 1, vel: .75 }); break;
      case 'stab': if (at([6, 10, 14])) ev.push({ inst: 'brass', midis: vc, dur: 2, vel: step === 14 ? .6 : .85 }); break;
      case 'bossa': if (at([0, 3, 6, 10, 12])) ev.push({ inst: 'pluck', midis: vc.slice(0, 4), dur: 2.5, vel: step === 0 ? .85 : .6, strum: true }); break;
      case 'oompah': if (at([4, 12])) ev.push({ inst: 'piano', midis: voicing(c, 60, 75), dur: 3, vel: .7 }); break;
      case 'waltz': if (at([4, 8])) ev.push({ inst: 'piano', midis: voicing(c, 57, 70), dur: 3, vel: .6 }); break;
      case 'arp': { var arpn = voicing(c, 69, 90), seq = [0, 1, 2, 3, 2, 1]; var pitch = arpn[seq[(step + (bar % 2) * 2) % seq.length] % arpn.length] + (step % 8 >= 4 ? 0 : 12 * 0); ev.push({ inst: 'synth', midi: pitch, dur: 1.4, vel: step % 4 === 0 ? .8 : .5 }); break }
    }
    if (tr.pad && (step === 0 || (tr.prog[bar % tr.prog.length].length === 2 && step === half))) {
      var pd = tr.prog[bar % tr.prog.length].length === 2 ? half : S;
      var padv = tr.id === 7 ? voicing([c[0], 'sus'], 45, 62).concat([place((c[0] + 1) % 12, 57, 66)]) : voicing(c, 48, 64);   // the dark pad adds a semitone above the root
      ev.push({ inst: 'pad', midis: padv, dur: pd, vel: 1 });
    }

    // ----- melody -----
    var lead = rt.lead[bar % rt.lead.length] || [];
    lead.forEach(function (l) { if (l.step === step) ev.push({ inst: tr.lead, midi: l.midi, dur: l.dur, vel: .85 }) });

    // ----- drums -----
    function d(name, vel) { ev.push({ drum: name, vel: vel }) }
    switch (tr.drums) {
      case 'swing': if (at([0, 4, 6, 8, 12, 14])) d('ride', step % 4 === 0 ? .6 : .4); if (at([4, 12])) d('chick', .5); if (step === 0 || step === 8) d('kick', .25); if (at([6, 14]) && chance(tr, bar, step) < .3) d('snare', .2); break;
      case 'brush': if (step % 4 === 0) d('brush', .5); if (at([6, 14])) d('brush', .3); if (at([4, 12])) d('snare', .22); if (step === 0) d('kick', .2); break;
      case 'bigband': if (at([0, 4, 6, 8, 12, 14])) d('ride', step % 4 === 0 ? .6 : .4); if (at([4, 12])) { d('chick', .5); d('snare', .3) } if (at([0, 8])) d('kick', .45); break;
      case 'bossa': if (at([0, 8])) d('kick', .4); if (at([0, 3, 6, 10, 12])) d('rim', .5); if (step % 2 === 0) d('hat', step % 4 === 0 ? .35 : .22); break;
      case 'tense': if (step % 2 === 0) d('tick', step % 4 === 0 ? .9 : .45); if (step === 0 && bar % 2 === 0) { d('heart', .9) } if (step === 3 && bar % 2 === 0) d('heart2', .6); if (step === 0 && bar % 4 === 3) d('riser', 1); break;
      case 'drive': if (step % 4 === 0) d('kick', .95); if (at([4, 12])) { d('snare', .7); d('clap', .5) } d('hat', step % 4 === 2 ? .55 : .3); if (step % 4 === 2) d('ohat', .35); if (step === 0 && bar % 8 === 7) d('riser', 1); break;
      case 'ragtime': if (at([4, 12])) d('rim', .3); if (step % 2 === 0) d('shaker', .35); break;
      case 'none': if (S === 12 && step % 4 === 0) d('brush', .22); break;
    }
    return ev;
  }
  // a repeatable 'random' number for one spot in a track (so the same bar always sounds the same)
  function chance(tr, bar, step) { return rng(hash(tr.id + ':' + bar + ':' + step))() }
  function composeBar(tr, bar) { var out = []; for (var s = 0; s < tr.steps; s++) composeStep(tr, bar, s).forEach(function (e) { e.step = s; out.push(e) }); return out }

  /* ================= player: WebAudio ================= */
  var ctx = null, master, musicBus, sfxBus, noiseBuf, bus = {}, wet, fb;
  var cfg = { musicOn: true, sfxOn: true, music: .55, sfx: .9, track: 'auto' };
  try { var saved = JSON.parse(root.localStorage.getItem('bj-sound') || 'null'); if (saved) Object.keys(cfg).forEach(function (k) { if (saved[k] != null) cfg[k] = saved[k] }) } catch (e) {}
  function persist() { try { root.localStorage.setItem('bj-sound', JSON.stringify(cfg)) } catch (e) {} }
  var listeners = [], SFX_GAIN = 2.4;

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    init(new AC());
    return true;
  }
  function init(c) {
    ctx = c;
    // a hidden tab throttles timers, which would make the music stutter: pause the sound instead
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', function () { try { if (document.hidden) ctx.suspend(); else ctx.resume() } catch (e) {} });
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3.5; comp.attack.value = .004; comp.release.value = .25;
    master = ctx.createGain(); master.gain.value = .9; comp.connect(master); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = cfg.sfxOn ? cfg.sfx * SFX_GAIN : 0; sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = cfg.musicOn ? cfg.music * .5 : 0; musicBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var nd = noiseBuf.getChannelData(0), seed = rng(12345);
    for (var i = 0; i < nd.length; i++) nd[i] = seed() * 2 - 1;
    // a warm room: reverb made from decaying noise, plus a soft echo for the lead
    var ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 2.2), ctx.sampleRate), r2 = rng(777);
    for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var j = 0; j < d.length; j++) d[j] = (r2() * 2 - 1) * Math.pow(1 - j / d.length, 2.6) }
    var conv = ctx.createConvolver(); conv.buffer = ir; wet = ctx.createGain(); wet.gain.value = 1; conv.connect(wet); wet.connect(musicBus);
    var dl = ctx.createDelay(1); dl.delayTime.value = .375; fb = ctx.createGain(); fb.gain.value = .28; var dlOut = ctx.createGain(); dlOut.gain.value = .4;
    dl.connect(fb); fb.connect(dl); dl.connect(dlOut); dlOut.connect(musicBus);
    ['drums', 'bass', 'comp', 'lead', 'pad'].forEach(function (k) {
      var g = ctx.createGain(); g.connect(musicBus); bus[k] = { dry: g };
      if (k === 'comp' || k === 'lead' || k === 'pad') { var s = ctx.createGain(); s.gain.value = k === 'pad' ? .5 : .28; g.connect(s); s.connect(conv); bus[k].send = s }
      if (k === 'lead') { var e = ctx.createGain(); e.gain.value = .3; g.connect(e); e.connect(dl) }
    });
  }

  /* ---------- small helpers ---------- */
  function T() { return ctx.currentTime }
  function adsr(g, t, a, peak, d, sus, dur, rel) {
    var lvl = Math.max(.0001, peak * sus), hold = t + Math.max(a + d + .001, dur);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(lvl, t + a + d); g.gain.setValueAtTime(lvl, hold); g.gain.exponentialRampToValueAtTime(.0001, hold + rel);
    return hold + rel + .05;
  }
  function decay(g, t, peak, dec, dur, rel) {
    var te = Math.min(dur, dec), lvl = Math.max(.0001, peak * Math.pow(.0001 / peak, te / dec));
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + .004); g.gain.exponentialRampToValueAtTime(lvl, t + .004 + te);
    var end = t + .004 + te;
    if (dur < dec) { g.gain.exponentialRampToValueAtTime(.0001, end + rel); end += rel }
    return end + .05;
  }
  function osc(type, freq, t, stop, dest, detune) {
    var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (detune) o.detune.setValueAtTime(detune, t);
    o.connect(dest); o.start(t); o.stop(stop); return o;
  }
  function filt(type, freq, q, t) { var f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1; return f }
  function gain(v) { var g = ctx.createGain(); g.gain.value = v; return g }
  function noise(t, dur, type, freq, q, peak, dest, sweepTo, attack) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; var f = filt(type, freq, q, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    var g = ctx.createGain(); var a = attack || .004;
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, (t * 7.31) % 1.5); s.stop(t + a + dur + .05);
  }
  function lfo(rate, depth, target, t, stop) { var o = ctx.createOscillator(); o.frequency.value = rate; var g = ctx.createGain(); g.gain.value = depth; o.connect(g); g.connect(target); o.start(t); o.stop(stop); return g }

  /* ---------- instruments (each gets: start time, midi, length in seconds, velocity, output) ---------- */
  var V = {
    bass: function (t, m, dur, vel, out) {
      var f = hz(m), g = ctx.createGain(), lp = filt('lowpass', 520 + vel * 260, .7, t);
      var end = adsr(g, t, .008, .55 * vel, .22, .5, dur, .08);
      osc('triangle', f, t, end, lp); osc('sine', f, t, end, lp); lp.connect(g); g.connect(out);
      noise(t, .02, 'bandpass', 900, 1, .06 * vel, out);
    },
    sbass: function (t, m, dur, vel, out) {
      var f = hz(m), g = ctx.createGain(), lp = filt('lowpass', 900, 1.2, t); lp.frequency.exponentialRampToValueAtTime(260, t + .16);
      var end = decay(g, t, .38 * vel, .2, dur, .03); osc('sawtooth', f, t, end, lp); osc('square', f / 2, t, end, lp); lp.connect(g); g.connect(out);
    },
    rhodes: function (t, m, dur, vel, out) {
      var f = hz(m), g = ctx.createGain(), mod = ctx.createGain(); mod.gain.setValueAtTime(f * 1.6 * vel, t); mod.gain.exponentialRampToValueAtTime(f * .08, t + .5);
      var end = decay(g, t, .2 * vel, 2.2, dur, .3);
      var car = osc('sine', f, t, end, g), mo = ctx.createOscillator(); mo.frequency.value = f; mo.connect(mod); mod.connect(car.frequency); mo.start(t); mo.stop(end);
      osc('sine', f * 2, t, end, g); g.connect(out);
    },
    piano: function (t, m, dur, vel, out) {
      var f = hz(m), lp = filt('lowpass', 1500 + vel * 3500, .6, t), amps = [1, .55, .34, .2, .12, .07], endAll = t;
      amps.forEach(function (a, i) {
        var g = ctx.createGain(), dec = Math.max(.3, 2.2 - (m - 40) * .025 - i * .22), end = decay(g, t, .15 * vel * a, dec, dur, .14);
        osc(i === 0 ? 'triangle' : 'sine', f * (i + 1), t, end, g, i > 2 ? 2 : 0); g.connect(lp); endAll = Math.max(endAll, end);
      });
      lp.connect(out); noise(t, .02, 'bandpass', 2400, 1, .05 * vel, out);
    },
    trumpet: function (t, m, dur, vel, out) {
      var f = hz(m), g = ctx.createGain(), lp = filt('lowpass', 500, 1, t), pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1100; pk.gain.value = 7; pk.Q.value = 1.4;
      lp.frequency.linearRampToValueAtTime(1900, t + .12); lp.frequency.exponentialRampToValueAtTime(1300, t + .5);
      var end = adsr(g, t, .035, .2 * vel, .1, .75, dur, .14);
      var o1 = osc('sawtooth', f, t, end, lp), o2 = osc('sawtooth', f, t, end, lp, 7);
      var vib = ctx.createGain(); vib.gain.setValueAtTime(0, t); vib.gain.linearRampToValueAtTime(9, t + Math.min(.45, dur));
      var lf = ctx.createOscillator(); lf.frequency.value = 5.2; lf.connect(vib); vib.connect(o1.detune); vib.connect(o2.detune); lf.start(t); lf.stop(end);
      lp.connect(pk); pk.connect(g); g.connect(out);
    },
    vibes: function (t, m, dur, vel, out) {
      var f = hz(m), g = ctx.createGain(), trem = ctx.createGain(); trem.gain.value = .8; var end = decay(g, t, .2 * vel, 2.4, dur * 1.6, .5);
      lfo(4.8, .2, trem.gain, t, end);
      osc('sine', f, t, end, g); var g2 = ctx.createGain(); decay(g2, t, .05 * vel, .35, .35, .1); osc('sine', f * 3.97, t, t + .5, g2); g2.connect(trem); g.connect(trem); trem.connect(out);
    },
    brass: function (t, midis, dur, vel, out) {
      var g = ctx.createGain(), lp = filt('lowpass', 420, .8, t); lp.frequency.exponentialRampToValueAtTime(3200, t + .06); lp.frequency.exponentialRampToValueAtTime(1500, t + .3);
      var end = adsr(g, t, .02, .09 * vel, .12, .55, dur, .08);
      midis.forEach(function (m) { osc('sawtooth', hz(m), t, end, lp, -7); osc('sawtooth', hz(m), t, end, lp, 7) }); lp.connect(g); g.connect(out);
    },
    pad: function (t, midis, dur, vel, out) {
      var g = ctx.createGain(), lp = filt('lowpass', 1000, .5, t), end = adsr(g, t, Math.min(.9, dur * .3), .045 * vel, .5, 1, dur, 1.1);
      midis.forEach(function (m) { [-9, 0, 9].forEach(function (d) { osc('sawtooth', hz(m), t, end, lp, d) }) }); lp.connect(g); g.connect(out);
    },
    pluck: function (t, m, dur, vel, out) {
      var f = hz(m), g = ctx.createGain(), lp = filt('lowpass', 3400, .8, t); lp.frequency.exponentialRampToValueAtTime(450, t + .35);
      var end = decay(g, t, .2 * vel, .6, dur, .1); osc('triangle', f, t, end, lp); osc('sawtooth', f, t, end, lp, 3); lp.connect(g); g.connect(out);
    },
    synth: function (t, m, dur, vel, out) {
      var f = hz(m), g = ctx.createGain(), lp = filt('lowpass', 3200, 2, t); lp.frequency.exponentialRampToValueAtTime(700, t + .18);
      var end = decay(g, t, .1 * vel, .16, dur, .03); osc('sawtooth', f, t, end, lp); osc('square', f, t, end, lp, 6); lp.connect(g); g.connect(out);
    },
    ping: function (t, m, dur, vel, out) {
      var f = hz(m), g = ctx.createGain(), end = decay(g, t, .08 * vel, 2.2, 2.2, .1); osc('sine', f, t, end, g); osc('sine', f * 2.01, t, end, g); g.connect(out);
    }
  };
  // drums: (time, velocity, output)
  var DR = {
    kick: function (t, v, out) { var g = ctx.createGain(), o = ctx.createOscillator(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(44, t + .12); o.connect(g); g.connect(out);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.8 * v, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .24); o.start(t); o.stop(t + .3); noise(t, .01, 'bandpass', 3000, 1, .12 * v, out) },
    snare: function (t, v, out) { noise(t, .16, 'bandpass', 1900, .8, .42 * v, out); var g = ctx.createGain(); var end = decay(g, t, .22 * v, .1, .1, .02); osc('triangle', 190, t, end, g); g.connect(out) },
    brush: function (t, v, out) { noise(t, .14, 'bandpass', 5200, .5, .2 * v, out, 3400, .02) },
    hat: function (t, v, out) { noise(t, .035, 'highpass', 7500, .7, .26 * v, out) },
    ohat: function (t, v, out) { noise(t, .16, 'highpass', 7000, .7, .2 * v, out) },
    chick: function (t, v, out) { noise(t, .05, 'highpass', 5200, .7, .3 * v, out) },
    ride: function (t, v, out) { noise(t, .32, 'highpass', 6500, .6, .17 * v, out); [3200, 4300, 5600].forEach(function (f) { var g = ctx.createGain(); var end = decay(g, t, .02 * v, .25, .25, .05); osc('sine', f, t, end, g); g.connect(out) }) },
    rim: function (t, v, out) { var g = ctx.createGain(); var end = decay(g, t, .2 * v, .04, .04, .01); osc('sine', 1750, t, end, g); g.connect(out); noise(t, .03, 'bandpass', 3500, 1, .16 * v, out) },
    shaker: function (t, v, out) { noise(t, .06, 'bandpass', 7000, 1, .15 * v, out, null, .012) },
    tick: function (t, v, out) { var g = ctx.createGain(), o = ctx.createOscillator(); o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(1050, t + .03); o.connect(g); g.connect(out);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.3 * v, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + .06); o.start(t); o.stop(t + .08) },
    heart: function (t, v, out) { var g = ctx.createGain(), o = ctx.createOscillator(); o.frequency.value = 56; o.connect(g); g.connect(out); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.75 * v, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + .26); o.start(t); o.stop(t + .3) },
    heart2: function (t, v, out) { DR.heart(t + .02, v * .8, out) },
    clap: function (t, v, out) { [0, .012, .026].forEach(function (d) { noise(t + d, .07, 'bandpass', 1500, 1.2, .25 * v, out) }) },
    riser: function (t, v, out, secs) { noise(t, secs || 3.5, 'lowpass', 300, 1, .22 * v, out, 7000, secs ? secs * .9 : 3) }
  };

  /* ---------- the music player ---------- */
  var cur = null, timer = 0, lastId = 0;
  function loopLen(tr) { return 60 / tr.bpm / 4 * tr.steps }
  function stepTime(tr, bar, step) { var sd = 60 / tr.bpm / 4, t = (bar * tr.steps + step) * sd; if (tr.swing && tr.steps === 16 && step % 4 === 2) t += tr.swing * sd; return t }

  function playEvent(tr, e, t, sd, out) {
    var dur = Math.max(.05, (e.dur || 1) * sd);
    if (e.drum) { var vol = (tr.vol.drums || 1) * e.vel; if (DR[e.drum]) DR[e.drum](t, vol, out.drums, e.drum === 'riser' ? tr.steps * sd * (tr.id === 8 ? 8 : 4) : 0); return }
    var kind = e.inst, v = e.vel;
    if (kind === 'bass' || kind === 'sbass') { V[kind](t, e.midi, e.long ? dur : Math.min(dur, 1.5), v * (tr.vol.bass || 1) * .6, out.bass); return }
    if (kind === 'pad') { V.pad(t, e.midis, dur, v * (tr.vol.pad || 1), out.pad); return }
    if (e.midis) { e.midis.forEach(function (m, i) { var tt = t + (e.strum ? i * .012 : 0); var out2 = out.comp; if (kind === 'brass') V.brass(tt, [m], dur, v * (tr.vol.comp || 1) * 1.1, out2); else V[kind](tt, m, dur, v * (tr.vol.comp || 1) * (kind === 'pluck' ? 1.35 : 1.05), out2) }); return }
    if (e.midi != null) { var isLead = kind === tr.lead; V[kind](t, e.midi, dur, v * ((isLead ? tr.vol.lead : tr.vol.comp) || 1) * (isLead ? 1.5 : 1.3), isLead ? out.lead : out.comp) }
  }

  // every track gets its own set of faders in front of the shared part buses, so an old track can fade out while a new one fades in
  function startLoop(tr, at) {
    var parts = {}, t = at == null ? T() : at;
    ['drums', 'bass', 'comp', 'lead', 'pad'].forEach(function (k) {
      var pg = ctx.createGain(); pg.gain.setValueAtTime(.0001, t); pg.gain.linearRampToValueAtTime(1, t + 1.2); pg.connect(bus[k].dry); parts[k] = pg;
    });
    return { tr: tr, parts: parts, bar: 0, step: 0, t0: t + .1, stopped: false };
  }

  function schedule() {
    if (!cur || cur.stopped || !ctx) return;
    var tr = cur.tr, sd = 60 / tr.bpm / 4, until = T() + .35;
    for (var guard = 0; guard < 400; guard++) {
      var base = cur.t0 + stepTime(tr, cur.bar, cur.step);
      if (base > until) break;
      var evs = composeStep(tr, cur.bar, cur.step);
      for (var i = 0; i < evs.length; i++) playEvent(tr, evs[i], Math.max(base, T()), sd, cur.parts);
      cur.step++;
      if (cur.step >= tr.steps) { cur.step = 0; cur.bar++; if (cur.bar >= tr.prog.length) { cur.bar = 0; cur.t0 += loopLen(tr) * tr.prog.length } }
    }
  }

  function stopCur(fade) {
    if (!cur) return;
    var old = cur, f = fade == null ? 1.2 : fade; old.stopped = true; cur = null;
    Object.keys(old.parts).forEach(function (k) { try { var g = old.parts[k].gain; g.cancelScheduledValues(T()); g.setTargetAtTime(.0001, T(), f / 4) } catch (e) {} });
    setTimeout(function () { Object.keys(old.parts).forEach(function (k) { try { old.parts[k].disconnect() } catch (e) {} }) }, (f + 5) * 1000);
  }

  function playTrack(id) {
    var tr = byId(id); if (!tr) return false;
    if (!unlock()) return false;
    if (cur && cur.tr.id === id) return true;
    stopCur(1.2);
    var run = startLoop(tr); cur = run; lastId = id;
    clearInterval(timer); timer = setInterval(schedule, 60); schedule();
    listeners.forEach(function (f) { try { f(tr) } catch (e) {} });
    return true;
  }
  function stop(fade) { stopCur(fade); clearInterval(timer) }

  // mood groups: the game asks for a mood and we pick (and rotate) a track in that group
  var MOODS = { lobby: [1], calm: [2, 5, 6], action: [3, 6, 5], big: [4], tense: [7], final: [8], streak: [9], end: [10] };
  var rot = {};
  function mood(name) {
    if (cfg.track !== 'auto') return playTrack(+cfg.track);
    var list = MOODS[name] || MOODS.action; rot[name] = ((rot[name] == null ? -1 : rot[name]) + 1) % list.length;
    var id = list[rot[name]]; if (list.length > 1 && id === lastId) { rot[name] = (rot[name] + 1) % list.length; id = list[rot[name]] }
    return playTrack(id);
  }

  /* ---------- sound effects ---------- */
  function sfxOk() { return ctx && cfg.sfxOn }
  var S = {
    click: function () { var t = T(), g = ctx.createGain(), e = decay(g, t, .16, .04, .04, .01); osc('triangle', 880, t, e, g); g.connect(sfxBus) },
    deal: function () { var t = T(); noise(t, .1, 'bandpass', 1400, .9, .34, sfxBus, 3800); var g = ctx.createGain(), e = decay(g, t + .07, .12, .05, .05, .01); osc('sine', 190, t + .07, e, g); g.connect(sfxBus) },
    flip: function () { var t = T(); noise(t, .12, 'highpass', 1800, .7, .3, sfxBus, 7000); noise(t + .1, .03, 'bandpass', 3000, 1, .15, sfxBus) },
    shuffle: function () { var t = T(); for (var i = 0; i < 16; i++) noise(t + i * .05 + (i % 2) * .01, .05, 'bandpass', 1600 + (i * 211) % 1800, 1, .22, sfxBus) },
    chip: function (n) { n = n || 1; var t = T(); for (var i = 0; i < n; i++) { var tt = t + i * .06, f = 2500 + ((i * 397) % 900); var g = ctx.createGain(), e = decay(g, tt, .13, .07, .07, .01); osc('triangle', f, tt, e, g); osc('sine', f * 1.5, tt, e, g); g.connect(sfxBus); noise(tt, .025, 'bandpass', 6200, 1, .06, sfxBus) } },
    chips: function () { S.chip(6) },
    chipsPay: function () { var t = T(); for (var i = 0; i < 9; i++) { var tt = t + i * .045 + Math.random() * .02, f = 2300 + Math.random() * 1500; var g = ctx.createGain(), e = decay(g, tt, .11, .06, .06, .01); osc('triangle', f, tt, e, g); g.connect(sfxBus); noise(tt, .02, 'bandpass', 5800, 1, .05, sfxBus) } },
    chipsTake: function () { S.chipsPay() },
    tick: function () { DR.tick(T(), .7, sfxBus) },
    turn: function () { var t = T(); [880, 1318].forEach(function (f, i) { var g = ctx.createGain(), e = decay(g, t + i * .09, .13, .3, .3, .05); osc('sine', f, t + i * .09, e, g); g.connect(sfxBus) }) },
    fold: function () { var t = T(); noise(t, .18, 'lowpass', 1600, .8, .3, sfxBus, 300) },
    win: function () { var t = T(); [523, 659, 784, 1047].forEach(function (f, i) { var g = ctx.createGain(), e = decay(g, t + i * .09, .16, .45, .45, .08); osc('triangle', f, t + i * .09, e, g); osc('sine', f * 2, t + i * .09, e, g); g.connect(sfxBus) }) },
    blackjack: function () { var t = T(); [392, 523, 659, 784, 1047, 1319].forEach(function (f, i) { var g = ctx.createGain(), e = decay(g, t + i * .07, .16, .7, .7, .1); osc('sawtooth', f, t + i * .07, e, g); osc('triangle', f * 2, t + i * .07, e, g); g.connect(sfxBus) });
      [523, 659, 784, 1047].forEach(function (f) { var g = ctx.createGain(), e = decay(g, t + .5, .12, 1.4, 1.4, .1); osc('sine', f, t + .5, e, g); g.connect(sfxBus) }); S.chipsPay() },
    lose: function () { var t = T(); [330, 262, 196].forEach(function (f, i) { var g = ctx.createGain(), e = decay(g, t + i * .13, .14, .4, .4, .06); osc('triangle', f, t + i * .13, e, g); g.connect(sfxBus) }) },
    bust: function () { var t = T(), g = ctx.createGain(), o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(70, t + .5);
      var lp = filt('lowpass', 900, 1, t); o.connect(lp); lp.connect(g); g.connect(sfxBus); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.3, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .6); o.start(t); o.stop(t + .65); DR.kick(t, .9, sfxBus) },
    push: function () { var t = T(); [440, 440].forEach(function (f, i) { var g = ctx.createGain(), e = decay(g, t + i * .12, .12, .2, .2, .04); osc('sine', f, t + i * .12, e, g); g.connect(sfxBus) }) },
    surrender: function () { var t = T(); [392, 349, 311].forEach(function (f, i) { var g = ctx.createGain(), e = decay(g, t + i * .14, .1, .3, .3, .05); osc('triangle', f, t + i * .14, e, g); g.connect(sfxBus) }) },
    dealerBlackjack: function () { var t = T(); [196, 185, 175].forEach(function (f, i) { var g = ctx.createGain(), e = decay(g, t + i * .15, .18, .6, .6, .08); osc('sawtooth', f, t + i * .15, e, g); g.connect(sfxBus) }); DR.kick(t, 1, sfxBus) },
    join: function () { var t = T(); [660, 880].forEach(function (f, i) { var g = ctx.createGain(), e = decay(g, t + i * .08, .1, .2, .2, .04); osc('sine', f, t + i * .08, e, g); g.connect(sfxBus) }) }
  };
  var sfx = {};
  Object.keys(S).forEach(function (k) { sfx[k] = function (a) { if (!sfxOk()) return; try { S[k](a) } catch (e) { if (root.console) console.warn('sfx', k, e) } } });

  /* ---------- settings ---------- */
  function applyVolumes() {
    if (!ctx) return;
    try { sfxBus.gain.setTargetAtTime(cfg.sfxOn ? cfg.sfx * SFX_GAIN : 0, T(), .05); musicBus.gain.setTargetAtTime(cfg.musicOn ? cfg.music * .5 : 0, T(), .08) } catch (e) {}
  }
  var API = {
    TRACKS: TRACKS.map(function (t) { return { id: t.id, name: t.name, mood: t.mood, bpm: t.bpm } }),
    unlock: unlock, playTrack: playTrack, mood: mood, stop: stop, sfx: sfx,
    current: function () { return cur ? cur.tr.id : 0 },
    settings: function () { return Object.assign({}, cfg) },
    set: function (k, v) { cfg[k] = v; persist(); applyVolumes(); if (k === 'musicOn' && v && !cur && ctx && lastId) playTrack(lastId) },
    muted: function () { return !cfg.musicOn && !cfg.sfxOn },
    toggleMute: function () { var m = !(cfg.musicOn || cfg.sfxOn); cfg.musicOn = m; cfg.sfxOn = m; persist(); applyVolumes(); if (m && ctx && !cur && lastId) playTrack(lastId); return !m },
    onTrack: function (f) { listeners.push(f) },
    ready: function () { return !!ctx },
    // for tests and tools
    _compose: { TRACKS: TRACKS, composeBar: composeBar, composeStep: composeStep, buildLead: buildLead, stepTime: stepTime, byId: byId, hz: hz },
    // schedule `seconds` of a track into a given (offline or fake) context without timers: used by tests and loudness checks
    _renderOffline: function (id, seconds, c, opts) {
      init(c); if (opts) Object.keys(opts).forEach(function (k) { cfg[k] = opts[k] });
      var tr = byId(id), run = startLoop(tr, 0), sd = 60 / tr.bpm / 4, count = 0, notes = [];
      var bar = 0, step = 0, t0 = .1;
      for (var guard = 0; guard < 100000; guard++) {
        var base = t0 + stepTime(tr, bar, step); if (base > seconds) break;
        var evs = composeStep(tr, bar, step);
        for (var i = 0; i < evs.length; i++) { playEvent(tr, evs[i], base, sd, run.parts); count++; notes.push(evs[i]) }
        if (++step >= tr.steps) { step = 0; if (++bar >= tr.prog.length) { bar = 0; t0 += loopLen(tr) * tr.prog.length } }
      }
      return { events: count, notes: notes };
    },
    _sfxNames: Object.keys(S)
  };
  root.BJAudio = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
