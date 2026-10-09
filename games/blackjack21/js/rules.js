/* Blackjack 21: rules engine.
   Pure game logic, no DOM, no timers. The host owns the state and calls the functions below;
   every call returns a list of events the UI (and the network) can replay. Events never contain
   the dealer's hidden card, so they are safe to broadcast. Use view(s, seat) to send a state.
   Works in the browser (window.BJ) and in Node (require). */
(function (root) {
  'use strict';

  var SUITS = ['S', 'H', 'D', 'C'];
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var CHIPS = [10, 50, 100, 500, 1000];       // chips you bet with; every bet is a multiple of 10, so 3:2 and insurance are whole numbers
  var STACK_CHIPS = [5, 10, 50, 100, 500, 1000];   // a 5 chip appears in stacks (3:2 on a 10 bet pays 15)
  var MAX_SEATS = 6;

  var DEFAULTS = {
    decks: 6,            // standard 52-card decks in the shoe
    start: 1000,         // starting chips
    minBet: 10,
    maxBet: 1000,
    rounds: 15,          // game length; the richest player after the last round wins
    cutPct: 0.75,        // reshuffle once this share of the shoe has been dealt
    rebuys: 1,           // how many times a broke player can take rebuyAmount more chips
    rebuyAmount: 500,
    hitSoft17: false,    // false = dealer stands on every 17 (S17)
    surrender: true,     // late surrender: give up your first two cards for half your bet (after the dealer's blackjack check)
    maxHands: 4,         // split up to 4 hands
    matchBets: true,     // betting goes round the table; the highest bet sets the table bet and everyone must match it, go all in, or fold
    maxRaises: 2         // raises allowed per betting round (the opening bet is not a raise)
  };

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

  /* ---------- cards and hands ---------- */
  function buildShoe(decks) {
    var d = [];
    for (var k = 0; k < decks; k++) SUITS.forEach(function (s) { RANKS.forEach(function (r) { d.push({ id: 'd' + k + r + s, r: r, s: s }) }) });
    return d;
  }
  function cardValue(c) { return c.r === 'A' ? 11 : (c.r === 'K' || c.r === 'Q' || c.r === 'J') ? 10 : +c.r }
  // Hi-Lo card counting value: 2-6 = +1, 7-9 = 0, 10-A = -1
  function hiLo(c) { var v = c.r === 'A' ? 1 : cardValue(c); return v >= 2 && v <= 6 ? 1 : v >= 10 || c.r === 'A' ? -1 : 0 }
  function handValue(cards) {
    var total = 0, aces = 0;
    cards.forEach(function (c) { total += cardValue(c); if (c.r === 'A') aces++ });
    while (total > 21 && aces > 0) { total -= 10; aces-- }
    return { total: total, soft: aces > 0 };
  }
  function isBlackjack(cards) { return cards.length === 2 && handValue(cards).total === 21 }
  // the two cards can be split if they are worth the same (so K+Q can, as in most casinos)
  function canPair(a, b) { return cardValue(a) === cardValue(b) && (a.r === b.r || (a.r !== 'A' && b.r !== 'A')) }

  // Greedy chip breakdown for drawing a stack: 1350 -> {1000:1, 100:3, 50:1}
  function chipsFor(amount) {
    var out = {};
    for (var i = STACK_CHIPS.length - 1; i >= 0; i--) { var n = Math.floor(amount / STACK_CHIPS[i]); if (n) { out[STACK_CHIPS[i]] = n; amount -= n * STACK_CHIPS[i] } }
    return out;
  }

  /* ---------- game setup ---------- */
  // players: [{id, name, bot?}] in seat order (1-7)
  function newGame(players, opts) {
    opts = opts || {};
    if (!players || players.length < 1 || players.length > MAX_SEATS) throw new Error('need 1-' + MAX_SEATS + ' players');
    var o = {};
    Object.keys(DEFAULTS).forEach(function (k) { o[k] = opts[k] != null ? opts[k] : DEFAULTS[k] });
    var seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 2147483647);
    var s = {
      v: 1, seed: seed, opts: o,
      players: players.map(function (p) {
        return {
          id: p.id, name: p.name || p.id, bot: !!p.bot,
          chips: o.start, bet: 0, ready: false, folded: false, inRound: false, out: false,
          hands: [], insurance: 0, rebuysUsed: 0, lastNet: 0, streak: 0, net: 0,
          stats: { rounds: 0, hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, busts: 0, biggestWin: 0, peak: o.start }
        };
      }),
      dealer: { cards: [], hidden: false },
      opener: -1, bettor: -1, bq: [], border: [], high: 0, raises: 0,
      shoe: [], cutAt: 0, count: 0, round: 0,
      phase: 'idle',         // idle -> bet -> (insurance) -> turn -> roundEnd -> bet ... -> over
      turn: null,            // {seat, hand} while phase is 'turn'
      pending: [],           // seats that still have to answer the insurance offer
      winner: null, standings: null
    };
    s._rand = rng(seed);
    s._ev = [];
    newShoe(s);
    return s;
  }

  function newShoe(s, exclude) {
    var d = buildShoe(s.opts.decks);
    if (exclude) d = d.filter(function (c) { return !exclude[c.id] });
    s.shoe = shuffle(d, s._rand);
    s.cutAt = Math.floor(buildShoe(s.opts.decks).length * (1 - s.opts.cutPct));
    s.count = 0;
  }
  function inPlay(s) {
    var ids = {};
    s.dealer.cards.forEach(function (c) { ids[c.id] = 1 });
    s.players.forEach(function (p) { p.hands.forEach(function (h) { h.cards.forEach(function (c) { ids[c.id] = 1 }) }) });
    return ids;
  }
  function draw(s) {
    if (!s.shoe.length) { newShoe(s, inPlay(s)); s._ev.push({ t: 'shuffle' }) }
    return s.shoe.pop();
  }
  function emit(s, e) { s._ev.push(e); return e }
  function begin(s) { s._ev = []; return s._ev }

  /* ---------- round flow ---------- */
  function liveSeats(s) { var o = []; s.players.forEach(function (p, i) { if (!p.out) o.push(i) }); return o }

  function startRound(s) {
    if (s.phase === 'over') throw new Error('game is over');
    var ev = begin(s);
    s.round++;
    s.dealer = { cards: [], hidden: false };
    s.turn = null; s.pending = [];
    s.players.forEach(function (p) {
      p.bet = 0; p.ready = false; p.folded = false; p.inRound = false; p.hands = []; p.insurance = 0;
      // broke and nothing left to rebuy: out of the game
      if (!p.out && p.chips < s.opts.minBet && p.rebuysUsed >= s.opts.rebuys) { p.out = true; emit(s, { t: 'out', seat: s.players.indexOf(p) }) }
    });
    if (s.shoe.length <= s.cutAt) { newShoe(s); emit(s, { t: 'shuffle' }) }
    s.phase = 'bet';
    s.high = 0; s.raises = 0; s.bettor = -1; s.bq = []; s.border = [];
    if (s.opts.matchBets) {
      // the opener rotates round the table; betting goes clockwise from the opener
      var act = liveSeats(s), n = s.players.length, first = -1;
      for (var k = 1; k <= n && act.length; k++) { var j = (s.opener + k + n) % n; if (act.indexOf(j) >= 0) { first = j; break } }
      if (first >= 0) {
        s.opener = first;
        var at = act.indexOf(first);
        s.border = act.slice(at).concat(act.slice(0, at));
        s.bq = s.border.slice(); s.bettor = s.bq[0];
      }
    }
    emit(s, { t: 'round', n: s.round, of: s.opts.rounds, opener: s.bettor });
    return ev;
  }

  function maxFor(s, p) { return Math.min(s.opts.maxBet, Math.floor((p.chips + p.bet) / 10) * 10) }

  // What a seat may do when it is its turn to bet (matching-bets mode).
  function betOptions(s, seat) {
    var p = s.players[seat], H = s.high, cap = maxFor(s, p), min = s.opts.minBet;
    return {
      high: H, min: min, max: cap, raises: s.raises,
      mayOpen: H === 0 && cap >= min,
      canCall: H > 0 && cap >= H,
      allIn: H > 0 && cap < H && cap >= min ? cap : 0,       // a short stack may only go all in with everything it has
      canRaise: H > 0 && s.raises < s.opts.maxRaises && cap > H,
      canFold: true
    };
  }

  // Set a seat's bet to `amount` chips in total (0 = fold / sit this round out). Chips leave the stack right away.
  // With matchBets the seats bet one at a time: the opener bets freely, everyone after must call the highest bet,
  // go all in with what they have if they cannot cover it, raise, or fold. A raise sends the others round again.
  function bet(s, seat, amount) {
    var ev = begin(s), p = s.players[seat];
    if (s.phase !== 'bet') throw new Error('not betting time');
    if (!p || p.out) throw new Error('seat is out');
    if (!s.opts.matchBets) {
      if (amount !== 0 && (amount % 10 !== 0 || amount < s.opts.minBet || amount > maxFor(s, p))) throw new Error('bad bet ' + amount);
      p.chips += p.bet - amount; p.bet = amount; p.ready = true;
      emit(s, { t: 'bet', seat: seat, amount: amount, kind: amount ? 'bet' : 'fold' });
      return ev;
    }
    if (seat !== s.bettor) throw new Error('not your turn to bet');
    var o = betOptions(s, seat), H = s.high, kind;
    if (amount === 0) kind = 'fold';
    else {
      if (amount % 10 !== 0 || amount < o.min) throw new Error('bad bet ' + amount);
      if (H === 0) { if (amount > o.max) throw new Error('over your limit'); kind = 'open' }
      else if (amount === H) { if (!o.canCall) throw new Error('cannot cover ' + H); kind = 'call' }
      else if (amount < H) { if (amount !== o.allIn) throw new Error('you must match ' + H + ' or go all in'); kind = 'allin' }
      else { if (!o.canRaise || amount > o.max) throw new Error('cannot raise to ' + amount); kind = 'raise' }
    }
    p.chips += p.bet - amount; p.bet = amount; p.ready = true; p.folded = amount === 0;
    if (amount > H) {
      if (H > 0) s.raises++;
      s.high = amount;
      // everyone still in who is below the new bet (and can add chips) acts again, starting after the raiser
      var at = s.border.indexOf(seat), order = s.border.slice(at + 1).concat(s.border.slice(0, at));
      s.bq = order.filter(function (i) {
        var q = s.players[i];
        return !q.out && !q.folded && (!q.ready || (q.bet < s.high && q.chips >= 10));
      });
    } else s.bq.shift();
    s.bettor = s.bq.length ? s.bq[0] : -1;
    emit(s, { t: 'bet', seat: seat, amount: amount, kind: kind, high: s.high, next: s.bettor });
    if (s.bettor < 0) emit(s, { t: 'betsDone', high: s.high });
    return ev;
  }

  // a timeout while betting: fold (or sit out)
  function autoBet(s, seat) { return s.opts.matchBets ? bet(s, seat, 0) : bet(s, seat, 0) }

  function needsRebuy(s, p) { return !p.out && p.chips + p.bet < s.opts.minBet && p.rebuysUsed < s.opts.rebuys }
  function rebuy(s, seat) {
    var ev = begin(s), p = s.players[seat];
    if (s.phase !== 'bet' || !needsRebuy(s, p)) throw new Error('cannot rebuy');
    p.rebuysUsed++; p.chips += s.opts.rebuyAmount;
    emit(s, { t: 'rebuy', seat: seat, amount: s.opts.rebuyAmount });
    return ev;
  }

  function allReady(s) { return s.opts.matchBets ? s.bettor < 0 : s.players.every(function (p) { return p.out || p.ready }) }

  // Betting is over: whoever has no bet sits out. Deals the round.
  function closeBets(s) {
    var ev = begin(s);
    if (s.phase !== 'bet') throw new Error('not betting time');
    if (s.opts.matchBets && s.bettor >= 0) throw new Error('betting is not finished');
    var seats = [];
    s.players.forEach(function (p, i) { if (!p.out && p.bet >= s.opts.minBet) { p.inRound = true; seats.push(i) } });
    emit(s, { t: 'betsClosed', seats: seats });
    if (!seats.length) { s.phase = 'roundEnd'; emit(s, { t: 'noBets' }); return ev }
    seats.forEach(function (i) { var p = s.players[i]; p.hands = [{ cards: [], bet: p.bet, done: false, doubled: false, split: false, natural: false, surrendered: false, result: null, payout: 0 }]; p.stats.rounds++ });
    function deal(seat, hand) { var c = draw(s); s.players[seat].hands[hand].cards.push(c); s.count += hiLo(c); emit(s, { t: 'deal', seat: seat, hand: hand, card: c }) }
    seats.forEach(function (i) { deal(i, 0) });
    var up = draw(s); s.dealer.cards.push(up); s.count += hiLo(up); emit(s, { t: 'deal', seat: -1, card: up });
    seats.forEach(function (i) { deal(i, 0) });
    var hole = draw(s); s.dealer.cards.push(hole); s.dealer.hidden = true; emit(s, { t: 'deal', seat: -1, hidden: true });
    seats.forEach(function (i) {
      var h = s.players[i].hands[0];
      if (isBlackjack(h.cards)) { h.natural = true; h.done = true }
    });
    if (up.r === 'A') {
      s.pending = seats.filter(function (i) { var p = s.players[i]; return p.chips >= p.bet / 2 });
      if (s.pending.length) { s.phase = 'insurance'; emit(s, { t: 'insuranceOffer', seats: s.pending.slice() }); return ev }
    }
    peekOrPlay(s);
    return ev;
  }

  function dealerBlackjack(s) { return isBlackjack(s.dealer.cards) }

  // dealer checks the hole card when showing an Ace or a ten
  function peekOrPlay(s) {
    var up = s.dealer.cards[0];
    if (up.r === 'A' || cardValue(up) === 10) {
      emit(s, { t: 'peek', up: up.r });
      if (dealerBlackjack(s)) { reveal(s); settle(s); return }
    }
    // insurance bets lose when the dealer has no blackjack
    s.players.forEach(function (p, i) { if (p.insurance) { emit(s, { t: 'insuranceLost', seat: i, amount: p.insurance }); p.net -= p.insurance } });
    startTurns(s);
  }

  function reveal(s) {
    if (!s.dealer.hidden) return;
    s.dealer.hidden = false;
    var c = s.dealer.cards[1]; s.count += hiLo(c);
    emit(s, { t: 'reveal', card: c });
  }

  function startTurns(s) {
    s.phase = 'turn'; s.pending = [];
    nextTurn(s, -1, 0, true);
  }

  // find the next hand that needs a decision, starting after (seat, hand)
  function nextTurn(s, seat, hand, fromStart) {
    var i = seat, h = hand;
    if (!fromStart) h++;
    else { i = seat + 1; h = 0 }
    for (; i < s.players.length; i++, h = 0) {
      var p = s.players[i];
      if (!p.inRound) continue;
      for (; h < p.hands.length; h++) {
        if (!p.hands[h].done) { s.turn = { seat: i, hand: h }; emit(s, { t: 'turn', seat: i, hand: h }); return }
      }
    }
    s.turn = null;
    dealerPlay(s);
  }

  function dealerPlay(s) {
    s.phase = 'dealer';
    reveal(s);
    var live = false;
    s.players.forEach(function (p) { p.hands.forEach(function (h) { if (!h.natural && !h.surrendered && handValue(h.cards).total <= 21) live = true }) });
    if (live) {
      for (;;) {
        var v = handValue(s.dealer.cards);
        if (v.total > 17 || (v.total === 17 && !(v.soft && s.opts.hitSoft17))) break;
        var c = draw(s); s.dealer.cards.push(c); s.count += hiLo(c);
        emit(s, { t: 'deal', seat: -1, card: c });
      }
    }
    settle(s);
  }

  function settle(s) {
    var d = handValue(s.dealer.cards), dBJ = dealerBlackjack(s), dBust = d.total > 21;
    s.players.forEach(function (p, i) {
      if (!p.inRound) return;
      if (p.insurance && dBJ) { var win = p.insurance * 3; p.chips += win; p.net += p.insurance * 2; emit(s, { t: 'insuranceWon', seat: i, amount: win }) }
      p.hands.forEach(function (h, k) {
        var v = handValue(h.cards).total, res, pay;
        if (h.surrendered) { res = 'surrender'; pay = h.bet / 2 }
        else if (v > 21) { res = 'bust'; pay = 0 }
        else if (h.natural && !dBJ) { res = 'blackjack'; pay = h.bet + h.bet * 3 / 2 }
        else if (dBJ) { if (h.natural) { res = 'push'; pay = h.bet } else { res = 'lose'; pay = 0 } }
        else if (dBust || v > d.total) { res = 'win'; pay = h.bet * 2 }
        else if (v === d.total) { res = 'push'; pay = h.bet }
        else { res = 'lose'; pay = 0 }
        h.result = res; h.payout = pay; p.chips += pay;
        var net = pay - h.bet; p.net += net;
        var st = p.stats; st.hands++;
        if (res === 'win' || res === 'blackjack') st.wins++; else if (res === 'push') st.pushes++; else st.losses++;
        if (res === 'blackjack') st.blackjacks++;
        if (res === 'bust') st.busts++;
        if (net > st.biggestWin) st.biggestWin = net;
        emit(s, { t: 'settle', seat: i, hand: k, result: res, bet: h.bet, payout: pay, net: net });
      });
      p.bet = 0;
      p.lastNet = p.net; p.streak = p.net > 0 ? Math.max(1, p.streak + 1) : p.net < 0 ? Math.min(-1, p.streak - 1) : 0;
      if (p.chips > p.stats.peak) p.stats.peak = p.chips;
    });
    s.phase = 'roundEnd';
    emit(s, { t: 'roundEnd', n: s.round, dealer: d.total, dealerBust: dBust, dealerBJ: dBJ });
  }

  // after a round: next round or the end of the game
  function nextRound(s) {
    if (s.phase !== 'roundEnd') throw new Error('round not finished');
    s.players.forEach(function (p) { p.net = 0 });
    var alive = liveSeats(s).filter(function (i) { var p = s.players[i]; return p.chips >= s.opts.minBet || p.rebuysUsed < s.opts.rebuys });
    if (s.round >= s.opts.rounds || !alive.length) return finish(s);
    return startRound(s);
  }

  function finish(s) {
    var ev = begin(s);
    s.phase = 'over';
    var st = s.players.map(function (p, i) { return { seat: i, name: p.name, chips: p.chips } });
    st.sort(function (a, b) { return b.chips - a.chips });
    s.standings = st;
    s.winner = st[0].seat;
    emit(s, { t: 'over', winner: s.winner, standings: st });
    return ev;
  }

  /* ---------- player actions ---------- */
  function legal(s, seat) {
    var p = s.players[seat], out = [];
    if (!p) return out;
    if (s.phase === 'insurance') return s.pending.indexOf(seat) >= 0 ? ['insurance', 'noinsurance'] : [];
    if (s.phase !== 'turn' || !s.turn || s.turn.seat !== seat) return out;
    var h = p.hands[s.turn.hand];
    out.push('hit', 'stand');
    if (h.cards.length === 2) {
      if (p.chips >= h.bet) {
        out.push('double');
        if (p.hands.length < s.opts.maxHands && canPair(h.cards[0], h.cards[1])) out.push('split');
      }
      if (s.opts.surrender && !h.split && p.hands.length === 1) out.push('surrender');
    }
    return out;
  }

  function act(s, seat, type) {
    var ev = begin(s), p = s.players[seat];
    if (legal(s, seat).indexOf(type) < 0) throw new Error('illegal action ' + type + ' for seat ' + seat + ' in ' + s.phase);

    if (s.phase === 'insurance') {
      if (type === 'insurance') { p.insurance = p.bet / 2; p.chips -= p.insurance; emit(s, { t: 'insurance', seat: seat, amount: p.insurance }) }
      else emit(s, { t: 'noInsurance', seat: seat });
      s.pending.splice(s.pending.indexOf(seat), 1);
      if (!s.pending.length) peekOrPlay(s);
      return ev;
    }

    var hi = s.turn.hand, h = p.hands[hi];
    function give(hand, k) { var c = draw(s); hand.cards.push(c); s.count += hiLo(c); emit(s, { t: 'deal', seat: seat, hand: k, card: c }); return c }

    if (type === 'hit') {
      give(h, hi);
      var v = handValue(h.cards).total;
      if (v >= 21) h.done = true;
    } else if (type === 'stand') {
      h.done = true; emit(s, { t: 'stand', seat: seat, hand: hi });
    } else if (type === 'surrender') {
      h.surrendered = true; h.done = true; emit(s, { t: 'surrender', seat: seat, hand: hi });
    } else if (type === 'double') {
      p.chips -= h.bet; h.bet *= 2; h.doubled = true;
      emit(s, { t: 'double', seat: seat, hand: hi, bet: h.bet });
      give(h, hi); h.done = true;
    } else if (type === 'split') {
      var second = { cards: [h.cards.pop()], bet: h.bet, done: false, doubled: false, split: true, natural: false, surrendered: false, result: null, payout: 0 };
      p.chips -= h.bet; h.split = true;
      p.hands.splice(hi + 1, 0, second);
      emit(s, { t: 'split', seat: seat, hand: hi, bet: h.bet });
      var aces = h.cards[0].r === 'A';
      give(h, hi); give(second, hi + 1);
      [h, second].forEach(function (x) { if (aces || handValue(x.cards).total === 21) x.done = true });
    }
    if (h.done) emit(s, { t: 'handDone', seat: seat, hand: hi, total: handValue(h.cards).total });
    if (h.done || type === 'split') {
      // continue with this seat's next unfinished hand, else the next seat
      var cur = hi;
      if (type === 'split' && !h.done) return ev;       // stay on the first split hand
      nextTurn(s, seat, cur, false);
    }
    return ev;
  }

  // what a timeout does: stand (or decline insurance)
  function autoAct(s, seat) {
    var l = legal(s, seat);
    if (!l.length) return null;
    var t = l.indexOf('stand') >= 0 ? 'stand' : 'noinsurance';
    return act(s, seat, t);
  }

  /* ---------- what a seat is allowed to see ---------- */
  function view(s, seat) {
    var v = {
      v: s.v, opts: s.opts, round: s.round, phase: s.phase, me: seat,
      shoeLeft: s.shoe.length, shoeSize: s.opts.decks * 52, cutAt: s.cutAt, count: s.count,
      decksLeft: s.shoe.length / 52,
      turn: s.turn, pending: s.pending.slice(), winner: s.winner, standings: s.standings,
      bettor: s.bettor, high: s.high, raises: s.raises, opener: s.opener,
      dealer: {
        cards: s.dealer.cards.map(function (c, i) { return i === 1 && s.dealer.hidden ? { hidden: true } : c }),
        total: s.dealer.hidden ? null : s.dealer.cards.length ? handValue(s.dealer.cards).total : null
      },
      players: s.players.map(function (p) {
        return {
          id: p.id, name: p.name, bot: p.bot, chips: p.chips, bet: p.bet, ready: p.ready, folded: p.folded, inRound: p.inRound, out: p.out,
          insurance: p.insurance, lastNet: p.lastNet, streak: p.streak, rebuysUsed: p.rebuysUsed, stats: p.stats,
          hands: p.hands.map(function (h) {
            var hv = handValue(h.cards);
            return { cards: h.cards, bet: h.bet, done: h.done, doubled: h.doubled, natural: h.natural, total: hv.total, soft: hv.soft, result: h.result, payout: h.payout };
          })
        };
      })
    };
    if (seat != null && seat >= 0 && s.players[seat]) { v.legal = legal(s, seat); v.needsRebuy = s.phase === 'bet' && needsRebuy(s, s.players[seat]); v.maxBet = s.phase === 'bet' ? maxFor(s, s.players[seat]) : 0; if (s.phase === 'bet' && s.opts.matchBets && s.bettor === seat) { v.betOpts = betOptions(s, seat) } }
    return v;
  }

  var API = {
    SUITS: SUITS, RANKS: RANKS, CHIPS: CHIPS, STACK_CHIPS: STACK_CHIPS, MAX_SEATS: MAX_SEATS, DEFAULTS: DEFAULTS,
    rng: rng, shuffle: shuffle, buildShoe: buildShoe, cardValue: cardValue, hiLo: hiLo, handValue: handValue,
    isBlackjack: isBlackjack, canPair: canPair, chipsFor: chipsFor,
    newGame: newGame, startRound: startRound, bet: bet, autoBet: autoBet, betOptions: betOptions, rebuy: rebuy, allReady: allReady, closeBets: closeBets,
    legal: legal, act: act, autoAct: autoAct, nextRound: nextRound, view: view
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.BJ = API;
})(typeof window !== 'undefined' ? window : globalThis);
