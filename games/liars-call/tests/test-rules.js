// Rules-engine tests for Liar's Call. Run from the game folder:  node tests/test-rules.js
// (Rebuilt for the repo; the original test files from the first build were not kept.)
var LC = require('../js/rules.js');
var pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }
function players(n) { var a = []; for (var i = 0; i < n; i++) a.push({ id: 'p' + i, name: 'P' + i }); return a }
function rig(s, seat, ranks) { s.players[seat].hand = ranks.map(function (r, i) { return { id: 's' + seat + '_' + i, r: r } }) }
function find(ev, t) { return ev.find(function (e) { return e.t === t }) }

/* Deck size grows at 5-6 players: 20 cards (6/6/6 + 2 Jokers) or 30 cards (9/9/9 + 3 Jokers). */
[2, 3, 4, 5, 6].forEach(function (n) {
  var d = LC.deckFor(n), c = {};
  d.forEach(function (x) { c[x.r] = (c[x.r] || 0) + 1 });
  var big = n >= 5;
  ok(d.length === (big ? 30 : 20), n + 'p deck size');
  ok(c.K === (big ? 9 : 6) && c.Q === c.K && c.A === c.K, n + 'p rank counts');
  ok(c.J === (big ? 3 : 2), n + 'p jokers');
  ok(LC.truthsIn(n) === (big ? 12 : 8), n + 'p truths per round');
});

/* Everyone gets 5 cards, no duplicates, table card is never a Joker, spicy pull is 1..5. */
[2, 3, 4, 5, 6].forEach(function (n) {
  var s = LC.newGame(players(n), { seed: 42 + n }); LC.startRound(s, 0);
  ok(s.players.every(function (p) { return p.hand.length === 5 }), n + 'p everyone gets 5');
  var ids = {}; s.players.forEach(function (p) { p.hand.forEach(function (c) { ids[c.id] = 1 }) });
  ok(Object.keys(ids).length === n * 5, n + 'p no duplicate cards');
  ok(['K', 'Q', 'A'].indexOf(s.table) >= 0, 'table card never Joker');
  // 2 of 6 golgappas are spicy, so the fatal pull is the earlier of two distinct positions: 1..5
  ok(s.players.every(function (p) { return p.live >= 1 && p.live <= 5 }), 'fatal pull between 1 and 5');
});

/* Distribution check for "2 spicy out of 6": P(fatal on pull k) = 5/15, 4/15, 3/15, 2/15, 1/15. */
(function () {
  var c = [0, 0, 0, 0, 0, 0], N = 30000;
  for (var g = 0; g < N; g++) c[LC.newGame(players(2), { seed: g + 1 }).players[0].live]++;
  var expect = [0, 5, 4, 3, 2, 1].map(function (x) { return x / 15 });
  var good = true;
  for (var k = 1; k <= 5; k++) if (Math.abs(c[k] / N - expect[k]) > 0.02) good = false;
  ok(good, 'two-spicy odds distribution ' + JSON.stringify(c));
})();

/* First turn must be a play; invalid plays are refused. */
(function () {
  var s = LC.newGame(players(3), { seed: 1 }); LC.startRound(s, 1);
  ok(s.turn === 1, 'starter gets first turn');
  var o = LC.options(s);
  ok(!o.canCall && o.canPlay, 'first turn cannot call');
  ok(LC.act(s, 1, { type: 'call' }).err === 'nothing_to_call', 'call refused on empty table');
  ok(LC.act(s, 0, { type: 'play', cards: [s.players[0].hand[0].id] }).err === 'not_your_turn', 'out of turn refused');
  var h = s.players[1].hand;
  ok(LC.act(s, 1, { type: 'play', cards: [] }).err === 'bad_count', '0 cards refused');
  ok(LC.act(s, 1, { type: 'play', cards: h.slice(0, 4).map(function (c) { return c.id }) }).err === 'bad_count', '4 cards refused');
  ok(LC.act(s, 1, { type: 'play', cards: [h[0].id, h[0].id] }).err === 'dup_card', 'duplicate refused');
  var r = LC.act(s, 1, { type: 'play', cards: [h[0].id, h[1].id] });
  ok(r.ok && s.players[1].hand.length === 3 && s.turn === 2, 'play 2 moves the turn on');
})();

/* Caught lie: the liar eats and starts the next round. */
(function () {
  var s = LC.newGame(players(3), { seed: 7 }); LC.startRound(s, 0);
  s.table = 'K'; rig(s, 0, ['Q', 'A', 'K', 'K', 'K']); s.players[0].live = 5;
  LC.act(s, 0, { type: 'play', cards: ['s0_0'] });
  var rev = find(LC.act(s, 1, { type: 'call' }).ev, 'reveal');
  ok(rev.lie === true && rev.loser === 0, 'lie: liar loses');
  ok(s.players[0].pulls === 1 && s.players[0].alive, 'liar ate once and survived');
  ok(s.phase === 'roundEnd' && s.nextStarter === 0, 'caught liar starts next round');
  LC.nextRound(s);
  ok(s.round === 2 && s.turn === 0 && s.players.every(function (p) { return p.hand.length === 5 }), 'fresh deal');
})();

/* Truth called: the caller eats; the next player after the caller starts. Jokers are wild. */
(function () {
  var s = LC.newGame(players(4), { seed: 9 }); LC.startRound(s, 0);
  s.table = 'A'; rig(s, 0, ['A', 'J', 'K', 'K', 'K']); s.players[1].live = 5;
  LC.act(s, 0, { type: 'play', cards: ['s0_0', 's0_1'] });
  var rev = find(LC.act(s, 1, { type: 'call' }).ev, 'reveal');
  ok(rev.lie === false && rev.loser === 1, 'truth: caller loses');
  ok(s.nextStarter === 2, 'next player after caller starts');
})();

/* Only the latest play can be called; the last holder of cards must call. */
(function () {
  var s = LC.newGame(players(3), { seed: 11 }); LC.startRound(s, 0);
  s.table = 'K';
  rig(s, 0, ['K', 'K', 'K']); rig(s, 1, ['Q', 'Q', 'Q', 'Q', 'Q']); rig(s, 2, ['K', 'K', 'K', 'K', 'K']);
  s.players.forEach(function (p) { p.live = 5 });
  LC.act(s, 0, { type: 'play', cards: ['s0_0', 's0_1', 's0_2'] });
  LC.act(s, 1, { type: 'play', cards: ['s1_0', 's1_1', 's1_2'] });
  LC.act(s, 2, { type: 'play', cards: ['s2_0', 's2_1', 's2_2'] });
  ok(s.turn === 1, 'empty-handed seat 0 is skipped');
  LC.act(s, 1, { type: 'play', cards: ['s1_3', 's1_4'] });
  var o = LC.options(s);
  ok(o.mustCall && !o.canPlay, 'only holder left must call');
  ok(LC.timeoutAction(s).type === 'call', 'timeout of forced holder = call');
  var rev = find(LC.act(s, 2, { type: 'call' }).ev, 'reveal');
  ok(rev.lie && rev.loser === 1, 'player who emptied their hand can still be called');
})();

/* Out exactly on the fatal pull; 6 players drop to the 20-card deck at 4 alive; game over at 1. */
(function () {
  var s = LC.newGame(players(3), { seed: 13 }); s.players[0].live = 2;
  for (var k = 0; k < 2; k++) {
    LC.startRound(s, 0); s.table = 'K'; rig(s, 0, ['Q', 'Q', 'Q', 'Q', 'Q']);
    LC.act(s, 0, { type: 'play', cards: ['s0_0'] });
    ok(find(LC.act(s, 1, { type: 'call' }).ev, 'pull').dead === (k === 1), 'pull ' + (k + 1));
  }
  ok(!s.players[0].alive, 'seat 0 eliminated');
  var s6 = LC.newGame(players(6), { seed: 21 }); LC.startRound(s6, 0);
  ok(s6.deckSize === 30, '6p uses 30-card deck');
  s6.players[4].alive = false; s6.players[5].alive = false; s6.phase = 'roundEnd'; s6.nextStarter = 0; LC.nextRound(s6);
  ok(s6.deckSize === 20, '4 alive uses 20-card deck');
  var s2 = LC.newGame(players(2), { seed: 17 }); LC.startRound(s2, 0);
  s2.players[1].live = 1; s2.table = 'A'; rig(s2, 0, ['A', 'A', 'A', 'A', 'A']);
  LC.act(s2, 0, { type: 'play', cards: ['s0_0'] }); LC.act(s2, 1, { type: 'call' });
  ok(s2.phase === 'over' && s2.winner === 0, '2p: loser out, other wins');
})();

/* A player's view never leaks other hands or the secret spicy position. */
(function () {
  var s = LC.newGame(players(4), { seed: 23 }); LC.startRound(s, 0);
  var v = LC.view(s, 2);
  ok(v.players[2].hand.length === 5, 'own hand visible');
  ok(v.players.every(function (p, i) { return i === 2 || p.hand === null }), 'other hands hidden');
  ok(v.players.every(function (p) { return p.live === null }), 'spicy positions hidden');
})();

/* 10,000 random games: every game ends, nobody gets stuck, card counts always add up. */
(function () {
  var bad = 0;
  for (var g = 0; g < 10000; g++) {
    var n = 2 + (g % 5), s = LC.newGame(players(n), { seed: g + 1 }), R = LC.rng(g * 7 + 3), steps = 0;
    LC.startRound(s, Math.floor(R() * n));
    while (s.phase !== 'over' && steps++ < 5000) {
      if (s.phase === 'roundEnd') { LC.nextRound(s); continue }
      var alive = s.players.filter(function (p) { return p.alive }), held = 0, piled = 0;
      alive.forEach(function (p) { held += p.hand.length });
      s.pile.forEach(function (x) { piled += x.cards.length });
      if (held + piled !== alive.length * 5) bad++;
      var o = LC.options(s), a;
      if (o.mustCall || (o.canCall && R() < 0.25)) a = { type: 'call' };
      else { var h = LC.shuffle(s.players[s.turn].hand.slice(), R); a = { type: 'play', cards: h.slice(0, 1 + Math.floor(R() * o.maxPlay)).map(function (c) { return c.id }) } }
      if (!LC.act(s, s.turn, a).ok) { bad++; break }
    }
    if (s.phase !== 'over') bad++;
  }
  ok(bad === 0, 'random games invariants (bad=' + bad + ')');
})();

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
