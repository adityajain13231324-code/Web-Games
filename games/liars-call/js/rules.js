/* Liar's Call: rules engine.
   Pure game logic, no DOM, no timers. The host owns the state and calls act();
   every call returns a list of events the UI (and the network) can replay.
   Works in the browser (window.LC) and in Node (require). */
(function (root) {
  'use strict';

  var RANKS = ['K', 'Q', 'A'];
  var HAND = 5, MAX_PLAY = 3, CHAMBERS = 6, SPICY = 2;

  /* ---------- seeded randomness (same seed = same game, for tests and replays) ---------- */
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rand) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ---------- deck ---------- */
  // 2-4 players alive: 6 K, 6 Q, 6 A, 2 Jokers (20).  5-6 alive: 9 / 9 / 9 / 3 (30).
  function deckFor(alive) {
    var big = alive >= 5, per = big ? 9 : 6, jokers = big ? 3 : 2, d = [], n = 0;
    RANKS.forEach(function (r) { for (var i = 0; i < per; i++) d.push({ id: 'c' + (n++), r: r }); });
    for (var j = 0; j < jokers; j++) d.push({ id: 'c' + (n++), r: 'J' });
    return d;
  }
  function truthsIn(alive) { return alive >= 5 ? 12 : 8 }
  function isTrue(card, table) { return card.r === table || card.r === 'J' }

  /* ---------- game setup ---------- */
  // players: [{id, name, bot?}]  (2-6, in seat order)
  function newGame(players, opts) {
    opts = opts || {};
    if (!players || players.length < 2 || players.length > 6) throw new Error('need 2-6 players');
    var seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 2147483647);
    var rand = rng(seed);
    var s = {
      v: 1, seed: seed, rngState: 0,
      players: players.map(function (p) {
        return {
          id: p.id, name: p.name || p.id, bot: !!p.bot, alive: true, hand: [],
          // 2 of the 6 are spicy; you're out at whichever one you reach first (secret)
          live: (function () { var a = 1 + Math.floor(rand() * CHAMBERS), b; do { b = 1 + Math.floor(rand() * CHAMBERS) } while (b === a); return Math.min(a, b) })(),
          pulls: 0,                                   // pulls survived so far
          stats: { played: 0, lies: 0, caught: 0, calls: 0, goodCalls: 0 }
        };
      }),
      round: 0, table: null, deckSize: 0, turn: -1,
      pile: [],            // every play this round: {by, cards}
      last: null,          // the latest play, the only one that can be called
      phase: 'idle',       // idle -> turn -> (resolve) -> roundEnd -> turn ... -> over
      winner: null, history: []
    };
    s._rand = rand;
    return s;
  }

  function aliveIdx(s) {
    var out = [];
    s.players.forEach(function (p, i) { if (p.alive) out.push(i) });
    return out;
  }
  // next alive seat after i (not i itself unless it is the only one)
  function nextAlive(s, i) {
    var n = s.players.length;
    for (var k = 1; k <= n; k++) { var j = (i + k) % n; if (s.players[j].alive) return j }
    return -1;
  }
  // next alive seat after i that still has cards
  function nextWithCards(s, i) {
    var n = s.players.length;
    for (var k = 1; k <= n; k++) {
      var j = (i + k) % n, p = s.players[j];
      if (p.alive && p.hand.length) return j;
    }
    return -1;
  }
  function holders(s) {
    return s.players.filter(function (p) { return p.alive && p.hand.length }).length;
  }

  /* ---------- rounds ---------- */
  function startRound(s, starter) {
    var ev = [];
    var alive = aliveIdx(s);
    if (alive.length < 2) return ev;
    if (starter == null || !s.players[starter] || !s.players[starter].alive) starter = alive[0];
    var deck = shuffle(deckFor(alive.length), s._rand);
    s.deckSize = deck.length;
    s.round++;
    s.table = RANKS[Math.floor(s._rand() * 3)];
    s.pile = []; s.last = null;
    s.players.forEach(function (p) { p.hand = p.alive ? deck.splice(0, HAND) : [] });
    s.turn = starter;
    s.phase = 'turn';
    ev.push({ t: 'round', round: s.round, table: s.table, deck: s.deckSize, truths: truthsIn(alive.length), starter: starter });
    ev.push({ t: 'turn', seat: s.turn, mustCall: false, canCall: false });
    return ev;
  }

  // what the player whose turn it is may do
  function options(s) {
    if (s.phase !== 'turn') return null;
    var p = s.players[s.turn];
    var canCall = !!s.last && s.last.by !== s.turn;
    // only one player still holds cards -> they must call the previous play
    var mustCall = canCall && holders(s) === 1;
    return {
      seat: s.turn,
      canPlay: !mustCall && p.hand.length > 0,
      maxPlay: Math.min(MAX_PLAY, p.hand.length),
      canCall: canCall,
      mustCall: mustCall
    };
  }

  function advance(s, from, ev) {
    s.turn = nextWithCards(s, from);
    var o = options(s);
    ev.push({ t: 'turn', seat: s.turn, mustCall: o.mustCall, canCall: o.canCall });
  }

  /* ---------- actions ---------- */
  // action: {type:'play', cards:[cardId,...]} | {type:'call'}
  // returns {ok:true, ev:[...]} or {ok:false, err:'...'}
  function act(s, seat, action) {
    if (s.phase !== 'turn') return { ok: false, err: 'not_playing' };
    if (seat !== s.turn) return { ok: false, err: 'not_your_turn' };
    var o = options(s), p = s.players[seat], ev = [];
    if (!action || (action.type !== 'play' && action.type !== 'call')) return { ok: false, err: 'bad_action' };

    if (action.type === 'play') {
      if (!o.canPlay) return { ok: false, err: o.mustCall ? 'must_call' : 'cannot_play' };
      var ids = action.cards || [];
      if (ids.length < 1 || ids.length > o.maxPlay) return { ok: false, err: 'bad_count' };
      var seen = {}, cards = [];
      for (var i = 0; i < ids.length; i++) {
        if (seen[ids[i]]) return { ok: false, err: 'dup_card' };
        seen[ids[i]] = 1;
        var k = p.hand.findIndex(function (c) { return c.id === ids[i] });
        if (k < 0) return { ok: false, err: 'not_in_hand' };
        cards.push(p.hand[k]);
      }
      p.hand = p.hand.filter(function (c) { return !seen[c.id] });
      s.last = { by: seat, cards: cards };
      s.pile.push(s.last);
      p.stats.played += cards.length;
      if (!cards.every(function (c) { return isTrue(c, s.table) })) p.stats.lies++;
      ev.push({ t: 'play', seat: seat, count: cards.length, left: p.hand.length });
      advance(s, seat, ev);
      return { ok: true, ev: ev };
    }

    // call LIAR on the latest play
    if (!o.canCall) return { ok: false, err: 'nothing_to_call' };
    var last = s.last, accused = last.by;
    var lie = !last.cards.every(function (c) { return isTrue(c, s.table) });
    var loser = lie ? accused : seat;
    p.stats.calls++;
    if (lie) { p.stats.goodCalls++; s.players[accused].stats.caught++ }
    ev.push({ t: 'call', seat: seat, accused: accused });
    ev.push({ t: 'reveal', cards: last.cards.map(function (c) { return c.r }), lie: lie, loser: loser });
    return resolvePull(s, loser, { caller: seat, accused: accused, lie: lie }, ev);
  }

  function resolvePull(s, loser, info, ev) {
    var L = s.players[loser];
    L.pulls++;
    var dead = L.pulls >= L.live;
    if (dead) { L.alive = false; L.hand = [] }
    ev.push({ t: 'pull', seat: loser, n: L.pulls, dead: dead });
    s.history.push({ round: s.round, table: s.table, caller: info.caller, accused: info.accused, lie: info.lie, loser: loser, dead: dead });

    var alive = aliveIdx(s);
    if (alive.length <= 1) {
      s.phase = 'over'; s.winner = alive.length ? alive[0] : null; s.turn = -1;
      ev.push({ t: 'over', winner: s.winner });
      return { ok: true, ev: ev };
    }
    // next round: the caught liar starts; otherwise the next player in turn order after the caller.
    var starter;
    if (info.lie) starter = s.players[info.accused].alive ? info.accused : nextAlive(s, info.accused);
    else starter = nextAlive(s, info.caller);
    s.phase = 'roundEnd'; s.turn = -1; s.nextStarter = starter;
    ev.push({ t: 'roundEnd', next: starter });
    return { ok: true, ev: ev };
  }

  // the UI calls this after the reveal / pull animations finish
  function nextRound(s) {
    if (s.phase !== 'roundEnd') return [];
    return startRound(s, s.nextStarter);
  }

  // what happens when the turn timer runs out: play 1 random card, or call if forced
  function timeoutAction(s) {
    var o = options(s);
    if (!o) return null;
    if (!o.canPlay) return { type: 'call' };
    var h = s.players[s.turn].hand;
    return { type: 'play', cards: [h[Math.floor(s._rand() * h.length)].id] };
  }

  // a player who leaves mid-game: eliminated on the spot (online code may hand the seat to a bot instead)
  function forfeit(s, seat) {
    var p = s.players[seat], ev = [];
    if (!p || !p.alive || s.phase === 'over') return ev;
    p.alive = false; p.hand = [];
    ev.push({ t: 'forfeit', seat: seat });
    var alive = aliveIdx(s);
    if (alive.length <= 1) {
      s.phase = 'over'; s.winner = alive.length ? alive[0] : null; s.turn = -1;
      ev.push({ t: 'over', winner: s.winner });
      return ev;
    }
    // their cards are gone, so the round restarts cleanly
    if (s.phase === 'turn') {
      s.phase = 'roundEnd';
      s.nextStarter = s.turn === seat ? nextAlive(s, seat) : (s.turn >= 0 ? s.turn : alive[0]);
      ev.push({ t: 'roundEnd', next: s.nextStarter, redeal: true });
    } else if (s.phase === 'roundEnd' && !s.players[s.nextStarter].alive) {
      s.nextStarter = nextAlive(s, s.nextStarter);
    }
    return ev;
  }

  // what one player is allowed to see (hands of others hidden, live chambers hidden)
  function view(s, seat) {
    return {
      round: s.round, table: s.table, deckSize: s.deckSize, phase: s.phase, turn: s.turn,
      winner: s.winner, nextStarter: s.nextStarter,
      truths: truthsIn(aliveIdx(s).length),
      last: s.last ? { by: s.last.by, count: s.last.cards.length } : null,
      pile: s.pile.map(function (x) { return { by: x.by, count: x.cards.length } }),
      players: s.players.map(function (p, i) {
        return {
          id: p.id, name: p.name, bot: p.bot, alive: p.alive, pulls: p.pulls, cards: p.hand.length,
          hand: i === seat ? p.hand.slice() : null,
          live: s.phase === 'over' || !p.alive ? p.live : null
        };
      }),
      // my own plays this round (I know what I put down)
      myPlays: s.pile.filter(function (x) { return x.by === seat }).map(function (x) { return x.cards.slice() }),
      me: seat, options: s.turn === seat ? options(s) : null,
      history: s.history.slice()
    };
  }

  var LC = {
    RANKS: RANKS, HAND: HAND, MAX_PLAY: MAX_PLAY, CHAMBERS: CHAMBERS, SPICY: SPICY,
    rng: rng, shuffle: shuffle, deckFor: deckFor, truthsIn: truthsIn, isTrue: isTrue,
    newGame: newGame, startRound: startRound, nextRound: nextRound, options: options,
    act: act, timeoutAction: timeoutAction, forfeit: forfeit, view: view,
    nextAlive: nextAlive, nextWithCards: nextWithCards, aliveIdx: aliveIdx
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LC;
  else root.LC = LC;
})(this);
