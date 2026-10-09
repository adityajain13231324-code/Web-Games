// Rules-engine and bot tests for Blackjack 21. Run from the repo root:  node tests/test-rules.js
var BJ = require('../js/rules.js');
var Bots = require('../js/bots.js');
var pass = 0, fail = 0;
// most mechanics tests use simultaneous betting (matchBets off); the matching-bets rules have their own section below
(function () { var make = BJ.newGame; BJ.newGame = function (p, o) { o = o || {}; if (o.matchBets == null) o.matchBets = false; return make(p, o) } })();
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }
function throws(fn) { try { fn(); return false } catch (e) { return true } }
function players(n, bot) { var a = []; for (var i = 0; i < n; i++) a.push({ id: 'p' + i, name: 'P' + i, bot: !!bot }); return a }
function find(ev, t) { return ev.filter(function (e) { return e.t === t }) }
// cards from short text like "AS 10H 9C" (rank + suit letter)
function cards(txt) { var n = 0; return txt.split(' ').map(function (x) { return { id: 'r' + (n++) + x, r: x.slice(0, -1), s: x.slice(-1) } }) }
// put these cards on top of the shoe, in the order they will be dealt
function rig(s, txt) { s.shoe = s.shoe.concat(cards(txt).reverse()) }
// deal order: every seat card 1, dealer up, every seat card 2, dealer hole, then draws
function game(n, opts) { var s = BJ.newGame(players(n), opts || { seed: 7 }); BJ.startRound(s); return s }
function betAll(s, amt) { s.players.forEach(function (p, i) { if (!p.out) BJ.bet(s, i, amt) }) }

/* ---------- cards and hands ---------- */
ok(BJ.handValue(cards('AS KH')).total === 21 && BJ.isBlackjack(cards('AS KH')), 'A+K is blackjack');
ok(BJ.handValue(cards('AS AH 9C')).total === 21 && BJ.handValue(cards('AS AH 9C')).soft, 'A+A+9 = soft 21');
ok(BJ.handValue(cards('AS AH KC')).total === 12, 'A+A+K = 12');
ok(BJ.handValue(cards('KS QH 5C')).total === 25, 'bust total');
ok(!BJ.isBlackjack(cards('5S 6H KC')) && !BJ.isBlackjack(cards('7S 7H 7C')), 'three-card 21 is not a blackjack');
ok(BJ.canPair(cards('KS')[0], cards('QH')[0]) && !BJ.canPair(cards('AS')[0], cards('KH')[0]) && !BJ.canPair(cards('8S')[0], cards('9H')[0]), 'pair rules');
ok(JSON.stringify(BJ.chipsFor(1365)) === JSON.stringify({ 5: 1, 10: 1, 50: 1, 100: 3, 1000: 1 }), 'chip breakdown');
ok(BJ.hiLo(cards('5S')[0]) === 1 && BJ.hiLo(cards('8S')[0]) === 0 && BJ.hiLo(cards('KS')[0]) === -1 && BJ.hiLo(cards('AS')[0]) === -1, 'Hi-Lo values');

/* ---------- shoe ---------- */
(function () {
  var s = BJ.newGame(players(2), { seed: 1 });
  ok(s.shoe.length === 312, '6 decks = 312 cards');
  var ids = {}; s.shoe.forEach(function (c) { ids[c.id] = 1 });
  ok(Object.keys(ids).length === 312, 'every card in the shoe is unique');
  var kings = s.shoe.filter(function (c) { return c.r === 'K' }).length;
  ok(kings === 24, '24 kings in 6 decks');
  ok(BJ.newGame(players(1), { decks: 1 }).shoe.length === 52, 'one 52-card deck');
  var a = BJ.newGame(players(2), { seed: 99 }), b = BJ.newGame(players(2), { seed: 99 });
  ok(a.shoe.map(function (c) { return c.id }).join() === b.shoe.map(function (c) { return c.id }).join(), 'same seed, same shoe');
  ok(throws(function () { BJ.newGame(players(7)) }) && throws(function () { BJ.newGame([]) }), 'seat limits 1-6');
  ok(BJ.newGame(players(6)).players.length === 6, '6 players allowed');
})();

/* ---------- betting ---------- */
(function () {
  var s = game(2);
  BJ.bet(s, 0, 100);
  ok(s.players[0].chips === 900 && s.players[0].bet === 100, 'bet takes chips right away');
  BJ.bet(s, 0, 50);
  ok(s.players[0].chips === 950, 'changing a bet refunds the old one');
  ok(throws(function () { BJ.bet(s, 0, 5) }) && throws(function () { BJ.bet(s, 0, 15) }) && throws(function () { BJ.bet(s, 0, 1100) }) && throws(function () { BJ.bet(s, 0, 2000) }), 'bad bets rejected');
  ok(!BJ.allReady(s), 'not everyone is ready');
  BJ.bet(s, 1, 0);
  ok(BJ.allReady(s), 'sitting out counts as ready');
  var ev = BJ.closeBets(s);
  ok(find(ev, 'betsClosed')[0].seats.join() === '0', 'only the bettor is dealt in');
  ok(s.players[1].hands.length === 0 && s.players[1].chips === 1000, 'sit-out player untouched');
  ok(throws(function () { BJ.bet(s, 0, 10) }), 'no betting after the deal');
})();

/* ---------- deal order and the hidden card ---------- */
(function () {
  var s = game(2); betAll(s, 10);
  rig(s, '5S 6S 7S 8S 9S 2H');         // p0, p1, up, p0, p1, hole ... (we only check order)
  var ev = BJ.closeBets(s), deals = find(ev, 'deal');
  ok(deals.map(function (e) { return e.seat }).join() === '0,1,-1,0,1,-1', 'deal order: seats, up, seats, hole');
  ok(deals[5].hidden === true && !deals[5].card, 'hole card is not in the event');
  var v = BJ.view(s, 0);
  ok(v.dealer.cards[1].hidden === true && v.dealer.total === null, 'view hides the hole card and total');
  ok(!('shoe' in v) && v.shoeLeft === s.shoe.length, 'view never contains the shoe');
  ok(JSON.stringify(BJ.view(s, 1)).indexOf(s.dealer.cards[1].id) < 0, 'hole card id never leaks');
})();

/* ---------- payouts ---------- */
(function () {   // blackjack pays 3:2
  var s = game(1); BJ.bet(s, 0, 100);
  rig(s, 'AS 9C KH 7D'); BJ.closeBets(s);
  ok(s.phase === 'roundEnd' && s.players[0].chips === 900 + 100 + 150, 'blackjack pays 3:2 (chips ' + s.players[0].chips + ')');
  ok(s.players[0].hands[0].result === 'blackjack', 'result is blackjack');
})();
(function () {   // dealer blackjack beats a normal 20, and a player blackjack pushes it
  var s = game(2); betAll(s, 100);
  // order: p0 K, p1 A, up A, p0 10, p1 K, hole Q  -> p0 20, p1 blackjack, dealer A+Q blackjack
  rig(s, 'KS AS AH 10H KH QD');
  var ev = BJ.closeBets(s);
  ok(s.phase === 'insurance', 'insurance offered against an Ace');
  BJ.act(s, 0, 'noinsurance'); BJ.act(s, 1, 'noinsurance');
  ok(s.phase === 'roundEnd', 'dealer blackjack ends the round');
  ok(s.players[0].chips === 900 && s.players[1].chips === 1000, 'normal 20 loses, blackjack pushes');
})();
(function () {   // insurance pays 2:1 when the dealer has blackjack
  var s = game(1); BJ.bet(s, 0, 100);
  rig(s, '10S AH 9C KD'); BJ.closeBets(s);
  BJ.act(s, 0, 'insurance');
  ok(s.phase === 'roundEnd' && s.players[0].chips === 1000, 'insurance pays 2:1: lose the 100 bet, win 100 on the 50 insurance (chips ' + s.players[0].chips + ')');
})();
(function () {   // insurance is lost when the dealer has no blackjack
  var s = game(1); BJ.bet(s, 0, 100);
  rig(s, '10S AH 9C 6D'); BJ.closeBets(s);            // player 19, dealer A+6 (no blackjack)
  BJ.act(s, 0, 'insurance');
  ok(s.phase === 'turn' && s.players[0].chips === 850, 'insurance costs half the bet; play continues without a dealer blackjack');
  BJ.act(s, 0, 'stand');
  ok(s.players[0].chips === 850 + 200 && s.players[0].hands[0].result === 'win', 'hand wins, the 50 insurance is gone (chips ' + s.players[0].chips + ')');
})();
(function () {   // player bust loses and the dealer does not draw
  var s = game(1); BJ.bet(s, 0, 50);
  rig(s, '10S 9H 6C 7D KH'); BJ.closeBets(s);
  BJ.act(s, 0, 'hit');
  ok(s.phase === 'roundEnd' && s.players[0].chips === 950 && s.players[0].hands[0].result === 'bust', 'bust loses');
  ok(s.dealer.cards.length === 2, 'dealer does not draw against a bust');
})();
(function () {   // dealer busts, player wins even money
  var s = game(1); BJ.bet(s, 0, 50);
  rig(s, '10S 10H 6C 6D 10C'); BJ.closeBets(s);  // player 16, dealer 16
  BJ.act(s, 0, 'stand');
  ok(s.dealer.cards.length === 3 && s.players[0].chips === 1050 && s.players[0].hands[0].result === 'win', 'dealer busts, player wins 1:1');
})();
(function () {   // push
  var s = game(1); BJ.bet(s, 0, 50);
  rig(s, '10S 10H 8C 8D'); BJ.closeBets(s);
  BJ.act(s, 0, 'stand');
  ok(s.players[0].chips === 1000 && s.players[0].hands[0].result === 'push', 'push returns the bet');
})();
(function () {   // dealer stands on soft 17 (S17) but hits it with hitSoft17
  [false, true].forEach(function (h17) {
    var s = BJ.newGame(players(1), { seed: 3, hitSoft17: h17 }); BJ.startRound(s); BJ.bet(s, 0, 50);
    rig(s, '10S 6H 10C AD 5C'); BJ.closeBets(s);     // dealer A+6 = soft 17
    BJ.act(s, 0, 'stand');
    ok(h17 ? s.dealer.cards.length >= 3 : s.dealer.cards.length === 2, 'soft 17 rule hitSoft17=' + h17);
  });
})();

/* ---------- double and split ---------- */
(function () {
  var s = game(1); BJ.bet(s, 0, 100);
  rig(s, '5S 10H 6C 7D 10C'); BJ.closeBets(s);        // player 11, dealer 17
  ok(BJ.legal(s, 0).indexOf('double') >= 0, 'double offered on two cards');
  BJ.act(s, 0, 'double');
  var h = s.players[0].hands[0];
  ok(h.bet === 200 && h.cards.length === 3 && h.done, 'double: twice the bet, exactly one card');
  ok(s.players[0].chips === 1000 - 200 + 400 && h.result === 'win', 'double wins 2x the stake (chips ' + s.players[0].chips + ')');
  var t = game(1); BJ.bet(t, 0, 500); t.players[0].chips = 100;
  rig(t, '5S 10H 6C 7D 10C'); BJ.closeBets(t);
  ok(BJ.legal(t, 0).indexOf('double') < 0, 'no double without the chips');
})();
(function () {
  var s = game(1); BJ.bet(s, 0, 100);
  rig(s, '8S 10H 8C 7D 3H 10S'); BJ.closeBets(s);      // player 8,8 vs dealer 10/7 ; split cards: 3H, 10S
  ok(BJ.legal(s, 0).indexOf('split') >= 0, 'pair can split');
  BJ.act(s, 0, 'split');
  var p = s.players[0];
  ok(p.hands.length === 2 && p.chips === 800, 'split makes a second hand with a second bet');
  ok(p.hands[0].cards.length === 2 && p.hands[1].cards.length === 2, 'each split hand gets a card');
  ok(s.turn.hand === 0, 'play continues on the first hand');
  BJ.act(s, 0, 'stand');
  ok(s.turn && s.turn.hand === 1, 'then the second hand');
  BJ.act(s, 0, 'stand');
  ok(s.phase === 'roundEnd', 'round settles after both hands');
})();
(function () {   // split aces: one card each, 21 is not a blackjack, no re-split
  var s = game(1); BJ.bet(s, 0, 100);
  rig(s, 'AS 9H AC 7D KH 10S'); BJ.closeBets(s);
  BJ.act(s, 0, 'split');
  var p = s.players[0];
  ok(s.phase === 'roundEnd' && p.hands.every(function (h) { return h.cards.length === 2 && h.done }), 'split aces get one card each and finish');
  ok(p.hands[0].result === 'win' && p.hands[0].payout === 200, '21 after splitting aces pays 1:1, not 3:2');
})();
(function () {   // max 4 hands
  var s = game(1); BJ.bet(s, 0, 10);
  rig(s, '8S 6H 8C 7D 8H 8D 8S 8C'); BJ.closeBets(s);
  BJ.act(s, 0, 'split'); BJ.act(s, 0, 'split'); BJ.act(s, 0, 'split');
  ok(s.players[0].hands.length === 4 && BJ.legal(s, 0).indexOf('split') < 0, 'no more than 4 hands');
})();

/* ---------- matching bets: the highest bet sets the table bet ---------- */
(function () {
  function mk(n, chips) { var s = BJ.newGame(players(n), { seed: 11, matchBets: true }); (chips || []).forEach(function (c, i) { if (c != null) s.players[i].chips = c }); BJ.startRound(s); return s }
  var s = mk(3, [1000, 1000, 300]);
  ok(s.bettor === 0 && s.opener === 0, 'seat 0 opens the first round');
  ok(throws(function () { BJ.bet(s, 1, 100) }), 'only the seat on turn can bet');
  ok(throws(function () { BJ.closeBets(s) }), 'cannot deal before betting is finished');
  BJ.bet(s, 0, 500);
  ok(s.high === 500 && s.bettor === 1, 'the opener sets the table bet');
  ok(throws(function () { BJ.bet(s, 1, 200) }), 'cannot bet less than the table bet while you can cover it');
  ok(throws(function () { BJ.bet(s, 1, 400) }), '... or anything in between');
  BJ.bet(s, 1, 500);
  var o = BJ.betOptions(s, 2);
  ok(s.bettor === 2 && !o.canCall && o.allIn === 300 && o.canFold, 'a 300 stack facing 500 can only go all in or fold');
  ok(throws(function () { BJ.bet(s, 2, 500) }) && throws(function () { BJ.bet(s, 2, 200) }), 'short stack: cannot call 500 or bet a partial amount');
  BJ.bet(s, 2, 300);
  ok(BJ.allReady(s) && s.bettor === -1 && s.players[2].chips === 0 && s.players[2].bet === 300, 'all in with everything');
  BJ.closeBets(s);
  ok(s.players.every(function (p) { return p.inRound }), 'everyone who matched or went all in is dealt in');
  ok(s.players[2].hands[0].bet === 300, 'the all-in player plays for 300');

  var f = mk(3);
  BJ.bet(f, 0, 500); BJ.bet(f, 1, 0); BJ.bet(f, 2, 500);
  BJ.closeBets(f);
  ok(f.players[1].folded && !f.players[1].inRound && f.players[1].chips === 1000, 'a player who folds out sits the round out with no loss');

  var r = mk(3);
  BJ.bet(r, 0, 100); BJ.bet(r, 1, 300);                       // seat 1 raises
  ok(r.high === 300 && r.bettor === 2 && r.raises === 1, 'a raise raises the table bet');
  BJ.bet(r, 2, 300);
  ok(r.bettor === 0, 'a raise sends the earlier bettor round again');
  ok(throws(function () { BJ.bet(r, 0, 200) }), 'the earlier bettor must now match the new bet');
  BJ.bet(r, 0, 300);
  ok(BJ.allReady(r) && r.players.every(function (p) { return p.bet === 300 }), 'everybody ends up on the same bet');

  var cap = mk(3); BJ.bet(cap, 0, 100); BJ.bet(cap, 1, 200); BJ.bet(cap, 2, 300);
  ok(throws(function () { BJ.bet(cap, 0, 400) }) && BJ.betOptions(cap, 0).canRaise === false, 'no third raise after maxRaises');
  ok(throws(function () { BJ.bet(cap, 0, 5) }) && throws(function () { BJ.bet(cap, 0, 1100) }), 'bad amounts rejected');

  var all = mk(3);
  BJ.bet(all, 0, 0); BJ.bet(all, 1, 0); BJ.bet(all, 2, 0);
  ok(BJ.allReady(all), 'everyone can fold');
  var ev = BJ.closeBets(all);
  ok(find(ev, 'noBets').length === 1 && all.phase === 'roundEnd', 'nobody in: no deal');

  var op = mk(3); [0, 0, 0].forEach(function (_, i) { BJ.bet(op, op.bettor, 0) }); BJ.closeBets(op); BJ.nextRound(op);
  ok(op.opener === 1 && op.bettor === 1, 'the opener rotates each round');
  var v = BJ.view(op, 1);
  ok(v.betOpts && v.betOpts.mayOpen && v.bettor === 1, 'view gives the bettor their options');
  ok(!BJ.view(op, 0).betOpts, 'and nobody else');

  var one = BJ.newGame(players(1), { seed: 2, matchBets: true }); BJ.startRound(one);
  BJ.bet(one, 0, 200); ok(BJ.allReady(one), 'a lone player just bets');
})();

/* ---------- surrender ---------- */
(function () {
  var s = game(1); BJ.bet(s, 0, 100);
  rig(s, '10S 10H 6C 7D'); BJ.closeBets(s);                    // player 16 vs dealer 10/7
  ok(BJ.legal(s, 0).indexOf('surrender') >= 0, 'surrender offered on the first two cards');
  BJ.act(s, 0, 'surrender');
  ok(s.phase === 'roundEnd' && s.players[0].chips === 950 && s.players[0].hands[0].result === 'surrender', 'surrender gives back half the bet (chips ' + s.players[0].chips + ')');
  ok(s.dealer.cards.length === 2, 'dealer does not draw against only a surrendered hand');
  var t = game(1); BJ.bet(t, 0, 100);
  rig(t, '5S 10H 4C 7D 2H'); BJ.closeBets(t);
  BJ.act(t, 0, 'hit');
  ok(BJ.legal(t, 0).indexOf('surrender') < 0, 'no surrender after hitting');
  var u = BJ.newGame(players(1), { seed: 9, surrender: false }); BJ.startRound(u); BJ.bet(u, 0, 100);
  rig(u, '10S 10H 6C 7D'); BJ.closeBets(u);
  ok(BJ.legal(u, 0).indexOf('surrender') < 0, 'surrender can be switched off');
  var w = game(1); BJ.bet(w, 0, 100);
  rig(w, '8S 10H 8C 7D 3H 2D'); BJ.closeBets(w); BJ.act(w, 0, 'split');
  ok(BJ.legal(w, 0).indexOf('surrender') < 0, 'no surrender after a split');
})();

/* ---------- turns and timeouts ---------- */
(function () {
  var s = game(3); betAll(s, 10);
  rig(s, '5S 5H 5C 6D 2S 3H 4C 9D'); BJ.closeBets(s);
  ok(s.turn.seat === 0 && throws(function () { BJ.act(s, 1, 'hit') }), 'only the seat on turn can act');
  BJ.autoAct(s, 0);
  ok(s.turn.seat === 1, 'timeout stands and passes the turn');
  ok(throws(function () { BJ.act(s, 1, 'noinsurance') }), 'insurance action illegal in a turn');
})();

/* ---------- reshuffle, rebuy, game end ---------- */
(function () {
  var s = BJ.newGame(players(1), { seed: 5, decks: 1, rounds: 3 });
  BJ.startRound(s);
  for (var r = 0; r < 3 && s.phase !== 'over'; r++) {
    if (s.phase === 'bet') BJ.bet(s, 0, 10);
    BJ.closeBets(s);
    var guard = 0; while (s.phase === 'turn' && guard++ < 20) BJ.act(s, 0, 'stand');
    while (s.phase === 'insurance') BJ.act(s, 0, 'noinsurance');
    while (s.phase === 'turn' && guard++ < 40) BJ.act(s, 0, 'stand');
    BJ.nextRound(s);
  }
  ok(s.phase === 'over' && s.standings && s.winner === 0, 'game ends after the last round');
})();
(function () {
  var s = BJ.newGame(players(2), { seed: 2, rebuys: 1, rebuyAmount: 500 });
  BJ.startRound(s); s.players[0].chips = 0;
  var v = BJ.view(s, 0);
  ok(v.needsRebuy === true, 'broke player is offered a rebuy');
  BJ.rebuy(s, 0);
  ok(s.players[0].chips === 500 && throws(function () { BJ.rebuy(s, 0) }), 'rebuy gives chips, only once');
  s.players[0].chips = 0; s.phase = 'roundEnd'; BJ.nextRound(s);
  ok(s.players[0].out === true, 'broke with no rebuys left = out');
})();
(function () {
  var s = BJ.newGame(players(1), { seed: 4, decks: 1, cutPct: 0.5 });
  BJ.startRound(s); s.shoe.length = 20; s.phase = 'roundEnd';
  var ev = BJ.nextRound(s);
  ok(find(ev, 'shuffle').length === 1 && s.shoe.length === 52, 'cut card triggers a reshuffle');
})();

/* ---------- fuzz: random legal play never breaks an invariant ---------- */
(function () {
  var games = 600, bad = 0, why = '';
  for (var g = 0; g < games; g++) {
    var n = 1 + (g % 6), rand = BJ.rng(g + 1000);
    var s = BJ.newGame(players(n, true), { seed: g + 1, rounds: 8, decks: [1, 2, 6][g % 3], rebuys: g % 2 });
    var rebuys = 0, steps = 0;
    BJ.startRound(s);
    while (s.phase !== 'over' && steps++ < 5000) {
      if (s.phase === 'bet') {
        s.players.forEach(function (p, i) {
          if (p.out) return;
          var d = Bots.decide(BJ.view(s, i), BJ, Bots.CAST[i].key, 'normal', rand);
          if (d.type === 'rebuy') { BJ.rebuy(s, i); rebuys++; d = Bots.decide(BJ.view(s, i), BJ, Bots.CAST[i].key, 'normal', rand) }
          BJ.bet(s, i, d.type === 'bet' ? d.amount : 0);
        });
        BJ.closeBets(s);
      } else if (s.phase === 'insurance' || s.phase === 'turn') {
        var seat = s.phase === 'turn' ? s.turn.seat : s.pending[0];
        var dec = Bots.decide(BJ.view(s, seat), BJ, Bots.CAST[seat].key, 'normal', rand);
        if (s.phase === 'turn') {
          // all dealt cards unique
          var ids = {}, dup = false;
          s.players.forEach(function (p) { p.hands.forEach(function (h) { h.cards.forEach(function (c) { if (ids[c.id]) dup = true; ids[c.id] = 1 }) }) });
          s.dealer.cards.forEach(function (c) { if (ids[c.id]) dup = true; ids[c.id] = 1 });
          if (dup) { bad++; why = 'duplicate card in play' }
        }
        BJ.act(s, seat, dec.type);
      } else if (s.phase === 'roundEnd') {
        s.players.forEach(function (p) { if (p.chips < 0) { bad++; why = 'negative chips' } });
        BJ.nextRound(s);
      } else { bad++; why = 'stuck in ' + s.phase; break }
    }
    if (s.phase !== 'over') { bad++; why = 'game did not finish' }
    // chips are conserved apart from rebuys and what the dealer takes/pays: stacks never go negative
    s.players.forEach(function (p) { if (p.chips < 0 || p.chips % 5 !== 0) { bad++; why = 'bad chips ' + p.chips } });
  }
  ok(bad === 0, games + ' random bot games finish with valid chips and no duplicate cards ' + why);
})();

/* ---------- fuzz: whole games with matching bets and bots in every seat ---------- */
(function () {
  var games = 400, bad = 0, why = '', folds = 0, allins = 0, raises = 0;
  for (var g = 0; g < games; g++) {
    var n = 2 + (g % 5), rand = BJ.rng(g + 5000);
    var s = BJ.newGame(players(n, true), { seed: g + 77, matchBets: true, rounds: 8, decks: [2, 6][g % 2], rebuys: g % 2, maxBet: [500, 1000][g % 2] });
    var steps = 0;
    BJ.startRound(s);
    while (s.phase !== 'over' && steps++ < 6000) {
      if (s.phase === 'bet') {
        var guard = 0;
        while (s.bettor >= 0 && guard++ < 60) {
          var seat = s.bettor, v = BJ.view(s, seat);
          if (v.needsRebuy) BJ.rebuy(s, seat);
          var d = Bots.decide(BJ.view(s, seat), BJ, Bots.CAST[seat].key, ['easy', 'normal', 'hard'][g % 3], rand);
          var evs = BJ.bet(s, seat, d.amount);
          evs.forEach(function (e) { if (e.t === 'bet') { if (e.kind === 'fold') folds++; if (e.kind === 'allin') allins++; if (e.kind === 'raise') raises++ } });
        }
        if (s.bettor >= 0) { bad++; why = 'betting did not finish' }
        // everyone still in bet the table bet, except short stacks who went all in with less
        s.players.forEach(function (p) {
          if (p.out || p.folded) return;
          if (p.bet !== s.high && !(p.bet < s.high && p.chips < 10)) { bad++; why = 'unmatched bet ' + p.bet + ' vs ' + s.high }
        });
        BJ.closeBets(s);
      } else if (s.phase === 'insurance' || s.phase === 'turn') {
        var st = s.phase === 'turn' ? s.turn.seat : s.pending[0];
        BJ.act(s, st, Bots.decide(BJ.view(s, st), BJ, Bots.CAST[st].key, 'normal', rand).type);
      } else if (s.phase === 'roundEnd') { BJ.nextRound(s) }
      else { bad++; why = 'stuck in ' + s.phase; break }
    }
    if (s.phase !== 'over') { bad++; why = 'game did not finish' }
    s.players.forEach(function (p) { if (p.chips < 0 || p.chips % 5 !== 0) { bad++; why = 'bad chips ' + p.chips } });
  }
  ok(bad === 0, games + ' matching-bet bot games finish with every bet matched ' + why);
  ok(folds > 100 && allins >= 3 && raises > 20, 'bots fold, go all in and raise (folds ' + folds + ', all-ins ' + allins + ', raises ' + raises + ')');
})();

/* ---------- strategy sanity: perfect basic strategy at flat bets should land near the textbook edge ---------- */
(function () {
  var s = BJ.newGame(players(1), { seed: 20260, start: 1e9, maxBet: 10, rounds: 1e9, rebuys: 0 });
  var wagered = 0, start = s.players[0].chips, hands = 0, rand = BJ.rng(5);
  BJ.startRound(s);
  var target = 150000;
  while (hands < target) {
    if (s.phase === 'bet') { BJ.bet(s, 0, 10); BJ.closeBets(s) }
    else if (s.phase === 'insurance') BJ.act(s, 0, 'noinsurance');
    else if (s.phase === 'turn') BJ.act(s, 0, Bots.decide(BJ.view(s, 0), BJ, 'steady', 'hard', rand).type);
    else if (s.phase === 'roundEnd') { hands++; BJ.nextRound(s) }
  }
  // wagered includes doubles/splits, so measure against hands * 10
  var edge = (s.players[0].chips - start) / (hands * 10);
  ok(edge > -0.025 && edge < 0.015, 'basic strategy (with late surrender) edge is about -0.4%: measured ' + (edge * 100).toFixed(2) + '% over ' + hands + ' hands');
})();

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
