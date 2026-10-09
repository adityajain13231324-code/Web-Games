// Audio tests for Blackjack 21. Run from the repo root:  node tests/test-audio.js
// The music is composed by pure functions, and played through a strict fake WebAudio context that throws on the same
// mistakes the real API throws on (NaN or negative times, exponential ramps to 0), so scheduling bugs show up here.
var A = require('../js/audio.js');
var pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }

function Param(name) { this.name = name; this.value = 0; this.calls = 0 }
['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues'].forEach(function (m) {
  Param.prototype[m] = function (v, t) {
    this.calls++;
    if (m === 'cancelScheduledValues') { if (!isFinite(v)) throw new Error(this.name + ' ' + m + ' bad time'); return this }
    if (!isFinite(v) || !isFinite(t)) throw new Error(this.name + '.' + m + ' non-finite (' + v + ', ' + t + ')');
    if (t < 0) throw new Error(this.name + '.' + m + ' negative time ' + t);
    if (m === 'exponentialRampToValueAtTime' && v <= 0) throw new Error(this.name + ' exponential ramp to ' + v);
    return this;
  };
});
function Node(kind) { this.kind = kind; this.connected = 0; this.started = 0; this.stopped = 0 }
Node.prototype.connect = function (n) { if (!n) throw new Error('connect to nothing'); this.connected++; return n };
Node.prototype.disconnect = function () {};
Node.prototype.start = function (t) { if (!isFinite(t) || t < 0) throw new Error('bad start ' + t); this.started = t };
Node.prototype.stop = function (t) { if (!isFinite(t) || t < this.started) throw new Error('stop before start: ' + t + ' < ' + this.started); this.stopped = t };
function FakeCtx() {
  this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = new Node('dest'); this.nodes = 0; this.peakOsc = 0; this.oscs = 0;
  var self = this;
  function make(kind, params) { return function () { var n = new Node(kind); self.nodes++; (params || []).forEach(function (p) { n[p] = new Param(kind + '.' + p) }); if (kind === 'osc') self.oscs++; return n } }
  this.createGain = make('gain', ['gain']);
  this.createOscillator = make('osc', ['frequency', 'detune']);
  this.createBiquadFilter = make('filter', ['frequency', 'Q', 'gain']);
  this.createBufferSource = make('src', ['playbackRate']);
  this.createDynamicsCompressor = make('comp', ['threshold', 'ratio', 'attack', 'release']);
  this.createConvolver = make('conv');
  this.createDelay = make('delay', ['delayTime']);
  this.createBuffer = function (ch, len, rate) { var d = []; for (var i = 0; i < ch; i++) d.push(new Float32Array(len)); return { getChannelData: function (i) { return d[i] } } };
  this.resume = function () {};
}

var C = A._compose;

/* ---- the composer ---- */
ok(C.TRACKS.length === 10, 'there are 10 tracks');
ok(new Set(C.TRACKS.map(function (t) { return t.name })).size === 10, 'all ten tracks have different names');
ok(new Set(C.TRACKS.map(function (t) { return t.bpm + t.key })).size >= 9, 'the tracks differ in tempo and key');
C.TRACKS.forEach(function (tr) {
  var notes = 0, drums = 0, insts = {}, bad = 0;
  for (var b = 0; b < tr.prog.length; b++) {
    var evs = C.composeBar(tr, b);
    evs.forEach(function (e) {
      if (e.drum) { drums++; return }
      notes++; insts[e.inst] = 1;
      (e.midis || [e.midi]).forEach(function (m) { if (!(m >= 24 && m <= 100) || !isFinite(m)) bad++ });
      if (!(e.dur > 0) || !(e.vel > 0)) bad++;
      if (e.step < 0 || e.step >= tr.steps) bad++;
    });
  }
  ok(bad === 0, tr.name + ': every note is in range with a positive length');
  ok(notes + drums > 30, tr.name + ': plays music (' + notes + ' notes, ' + drums + ' drum hits per loop)');
  ok(insts.bass || insts.sbass, tr.name + ': has a bass line');
  if (tr.drums !== 'none' || tr.id === 10) ok(drums > 0, tr.name + ': has drums');
  var again = C.composeBar(tr, 3), first = JSON.stringify(again);
  ok(first === JSON.stringify(C.composeBar(tr, 3)), tr.name + ': composing is repeatable');
  // melody: stays in the key
  var lead = C.buildLead(tr), off = 0, count = 0, root = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 }[tr.key];
  lead.forEach(function (bar) { bar.forEach(function (n) { count++; if (tr.scale.indexOf((((n.midi - root) % 12) + 12) % 12) < 0) off++ }) });
  ok(off === 0, tr.name + ': melody stays in its key (' + count + ' notes)');
  if (tr.lead !== 'none') ok(count >= 3, tr.name + ': has a melody');
  ok(tr.swing >= 0 && tr.swing <= .7 && (tr.steps === 16 || tr.steps === 12), tr.name + ': sensible rhythm settings');
});
ok(C.stepTime(C.byId(1), 0, 0) === 0 && C.stepTime(C.byId(1), 0, 2) > 2 * 60 / 96 / 4, 'swing delays the off-beat eighth');
ok(Math.abs(C.hz(69) - 440) < 1e-9, 'A4 is 440 Hz');

/* ---- the player, against the strict fake context ---- */
C.TRACKS.forEach(function (tr) {
  var ctx = new FakeCtx(), res, err = null;
  try { res = A._renderOffline(tr.id, 40, ctx) } catch (e) { err = e }
  ok(!err, tr.name + ': schedules 40 s of music without an audio error ' + (err ? err.message : ''));
  if (!err) ok(res.events > 40 && ctx.oscs > 40, tr.name + ': builds a real graph (' + res.events + ' events, ' + ctx.oscs + ' oscillators)');
});
(function () {
  var ctx = new FakeCtx(), err = null;
  try { A._renderOffline(1, 1, ctx); A._sfxNames.forEach(function () {}); A.set('sfx', .9) } catch (e) { err = e }
  ok(!err, 'sound effects can be set up');
})();

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
