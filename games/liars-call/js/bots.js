/* Liar's Call: bots.
   A bot only looks at what a human in its seat could know: its own hand, its own plays,
   the table card, card counts, golgappas eaten and past reveals. */
(function (root) {
  'use strict';

  var PERSONAS = {
    careful:  { bluff: 0.06, call: 0.54, maxTruth: 2, maxBluff: 1, pad: 0.0 },
    reckless: { bluff: 0.24, call: 0.46, maxTruth: 3, maxBluff: 1, pad: 0.0 },
    sneaky:   { bluff: 0.16, call: 0.48, maxTruth: 2, maxBluff: 1, pad: 0.03 }
  };
  var NOISE = { easy: 0.22, normal: 0.10, hard: 0.04 };

  // ways to choose k from n
  function C(n, k) {
    if (k < 0 || k > n) return 0;
    var r = 1;
    for (var i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return r;
  }
  // P(X >= need) for X ~ Hypergeometric(pool, good, draws)
  function atLeast(pool, good, draws, need) {
    if (need <= 0) return 1;
    var tot = C(pool, draws), p = 0;
    if (!tot) return 0;
    for (var x = need; x <= Math.min(good, draws); x++) p += C(good, x) * C(pool - good, draws - x) / tot;
    return p;
  }

  function danger(pulls) { return Math.min(1, 2 / Math.max(1, 6 - pulls)) }

  // how likely is the latest play a lie, from this seat's point of view
  function lieOdds(v, LC) {
    var me = v.me, table = v.table, last = v.last;
    var hand = v.players[me].hand;
    var mineTrue = hand.filter(function (c) { return LC.isTrue(c, table) }).length;
    v.myPlays.forEach(function (cards) { cards.forEach(function (c) { if (LC.isTrue(c, table)) mineTrue++ }) });
    var unseenTrue = v.truths - mineTrue;                // truths that are not mine
    var pool = v.deckSize - LC.HAND;                     // cards I never saw
    var k = last.count, X = last.by;
    if (k > unseenTrue) return 1;                       // impossible claim
    var prevX = 0, others = 0;
    v.pile.forEach(function (p, i) {
      if (i === v.pile.length - 1) return;
      if (p.by === X) prevX += p.count; else if (p.by !== me) others += p.count;
    });
    var canTrue = 0.5 * atLeast(pool, unseenTrue, LC.HAND, k + prevX) + 0.5 * atLeast(pool, unseenTrue, LC.HAND, k);
    if (others + prevX + k > unseenTrue) canTrue *= 0.55;  // the table has claimed more truths than exist
    return 1 - canTrue * 0.85;
  }

  // how often has this player been caught lying vs called truthfully
  function reputation(v, seat) {
    var lies = 0, n = 0;
    v.history.forEach(function (h) { if (h.accused === seat) { n++; if (h.lie) lies++ } });
    return { n: n, rate: (lies + 1) / (n + 2) };
  }

  function decide(v, LC, personaName, level, rand) {
    rand = rand || Math.random;
    var P = PERSONAS[personaName] || PERSONAS.careful, noise = NOISE[level] != null ? NOISE[level] : NOISE.normal;
    var o = v.options, me = v.me, table = v.table, hand = v.players[me].hand.slice();
    var truths = hand.filter(function (c) { return LC.isTrue(c, table) });
    var fakes = hand.filter(function (c) { return !LC.isTrue(c, table) });
    var mine = v.players[me];

    /* ---- call? ---- */
    if (o.mustCall) return { action: { type: 'call' }, lying: false, why: 'forced' };
    if (o.canCall) {
      var target = v.last.by, tp = v.players[target];
      var pLie = lieOdds(v, LC);
      if (personaName === 'sneaky') { var rep = reputation(v, target); if (rep.n >= 2) pLie = 0.85 * pLie + 0.15 * rep.rate }
      var th = P.call + 0.3 * danger(mine.pulls) - 0.22 * danger(tp.pulls);
      if (!truths.length) th -= 0.12;                    // I'd have to bluff anyway
      if (tp.cards === 0) th -= 0.04;                    // they just dumped their last cards
      var score = pLie + (rand() * 2 - 1) * noise;
      if (pLie >= 1 || score > th) return { action: { type: 'call' }, lying: false, why: 'pLie ' + pLie.toFixed(2) };
    }

    /* ---- play ---- */
    var max = o.maxPlay, pick = [], lying = false;
    var next = nextHolder(v), nextDanger = next >= 0 ? danger(v.players[next].pulls) : 0;
    var bluffChance = P.bluff + 0.15 * nextDanger;        // a scared next player rarely calls
    if (hand.length <= max && fakes.length) bluffChance *= 0.5; // emptying my hand draws a call
    if (truths.length && (rand() >= bluffChance || !fakes.length)) {
      var n = Math.min(truths.length, max, 1 + Math.floor(rand() * P.maxTruth));
      pick = truths.slice(0, n);
      if (fakes.length && pick.length < max && rand() < P.pad) { pick.push(fakes[0]); lying = true }
    } else {
      var m = Math.min(fakes.length, max, 1 + Math.floor(rand() * P.maxBluff));
      pick = LC.shuffle(fakes.slice(), rand).slice(0, m);
      lying = true;
    }
    return { action: { type: 'play', cards: pick.map(function (c) { return c.id }) }, lying: lying };
  }

  function nextHolder(v) {
    var n = v.players.length;
    for (var k = 1; k <= n; k++) {
      var j = (v.me + k) % n, p = v.players[j];
      if (p.alive && p.cards > 0 && j !== v.me) return j;
    }
    return -1;
  }

  // does the bot give itself away this time?
  function showsTell(lying, rand) { rand = rand || Math.random; return lying ? rand() < 0.6 : rand() < 0.14 }

  var BOTS = { PERSONAS: PERSONAS, decide: decide, lieOdds: lieOdds, showsTell: showsTell, atLeast: atLeast };
  if (typeof module !== 'undefined' && module.exports) module.exports = BOTS;
  else root.LCBots = BOTS;
})(this);
