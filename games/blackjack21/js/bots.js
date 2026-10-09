/* Blackjack 21: bots.
   A bot only sees what a player in its seat sees (the view from BJ.view): its own hand, the dealer's
   up card, everyone's chips and the cards that have been dealt (the running count).
   decide(view, personaKey, level, rand) returns {type, amount?} for the phase the view is in. */
(function (root) {
  'use strict';

  /* The table regulars. Names and looks are original. `style` picks how they bet and how they play. */
  var CAST = [
    { key: 'lou', name: 'Lucky Lou', style: 'gambler', blurb: 'Loud shirt, louder bets. Chases every loss.', lines: {
      hello: ['Feeling lucky tonight!', 'Deal me in, baby!'], win: ['Ha! Told you!', 'Ka-ching!', 'Lucky Lou strikes again!'], lose: ["Next one's mine!", 'Double or nothing?'], bust: ['Ouch. One card too many.', 'Bah, that card hates me.'],
      bj: ['Twenty-one, baby!', 'Blackjack! Read it and weep!'], big: ['Go big or go home.', 'Let it ride!'], fold: ['Not this time.', 'Too rich even for me.'], double: ['Double it!', 'Hit me with one more!'], split: ['Two hands, double the fun!'],
      allin: ['All in!', 'Everything on the felt!'], raise: ["Let's make it interesting.", 'Raise it up!'], surrender: ["Fine, fine. I'm out."] } },
    { key: 'rouge', name: 'Madame Rouge', style: 'steady', blurb: 'Plays by the book and never blinks.', lines: {
      hello: ['Good evening.', 'Shall we?'], win: ['As expected.', 'Elementary.'], lose: ['A minor setback.', 'The house wins a hand.'], bust: ['How unfortunate.'], bj: ['Naturally.', 'A pleasure.'],
      big: ['A tidy sum.'], fold: ["I'll sit this one out."], double: ['Calculated.'], split: ['Divide and conquer.'], allin: ['Everything, then.'], raise: ['Care to raise the stakes?'], surrender: ['I know when to leave.'] } },
    { key: 'pip', name: 'Professor Pip', style: 'counter', blurb: 'Counts every card. Bets big when the shoe is hot.', lines: {
      hello: ['The shoe is warming up.', 'Observe the count.'], win: ['The numbers never lie.', 'As the mathematics predicted.'], lose: ['Variance, nothing more.', 'A statistical blip.'], bust: ['Statistically unlikely...'], bj: ['Probability smiles upon me.'],
      big: ['The count is rich.'], fold: ['The odds say no.'], double: ['Mathematically correct.'], split: ['By the book.'], allin: ['The expected value says yes.'], raise: ['The count favours me.'], surrender: ['Negative expectation. I fold the hand.'] } },
    { key: 'tony', name: 'Big Tony', style: 'gambler', blurb: 'High roller. Doubles on a hunch.', lines: {
      hello: ["Deal 'em up.", 'Make it quick.'], win: ['Easy money.', "That's how it's done."], lose: ['You got lucky.', 'Beginner luck.'], bust: ['Bah!', 'Unbelievable.'], bj: ["That's the real thing."],
      big: ['Big bets only.'], fold: ["I'm out."], double: ['Double down!'], split: ["Split 'em!"], allin: ['All in. Every chip.'], raise: ['Raise. Keep up.'], surrender: ["Not my night."] } },
    { key: 'penny', name: 'Penny', style: 'timid', blurb: 'Small bets, stands early, hates busting.', lines: {
      hello: ['Oh, I hope this goes well.', 'Is this seat taken?'], win: ['Oh! I won?', 'Yay!'], lose: ['I knew it...', 'Oh well.'], bust: ['Oh no, too many!', 'Eek!'], bj: ['Is that a blackjack?!'],
      big: ['That is a lot of chips...'], fold: ["That's too much for me."], double: ['Should I? Okay!'], split: ['Splitting! Is that right?'], allin: ['Eek, all in!'], raise: ['Um... raise?'], surrender: ["I give up, sorry."] } },
    { key: 'sam', name: 'Silent Sam', style: 'steady', blurb: 'Says nothing. Wins quietly.', lines: {
      hello: ['...'], win: ['Hm.'], lose: ['Hm.'], bust: ['...'], bj: ['Mm.'], big: ['...'], fold: ['Pass.'], double: ['Double.'], split: ['Split.'], allin: ['All.'], raise: ['Raise.'], surrender: ['Out.'] } },
    { key: 'dot', name: 'Duchess Dot', style: 'counter', blurb: 'Old money, sharp memory.', lines: {
      hello: ['Shall we begin, darlings?', 'Lovely evening for it.'], win: ['Lovely.', 'Delightful.'], lose: ['Dear me.', 'How very rude.'], bust: ['Oh, bother.'], bj: ['Twenty-one. How delightful.'],
      big: ["Let's raise the tone."], fold: ['Too rich for my blood.'], double: ['Double, dear.'], split: ['Two for the price of one.'], allin: ['Why not, darling.'], raise: ['Up we go.'], surrender: ['I yield, with grace.'] } },
    { key: 'ace', name: 'Ace McGraw', style: 'timid', blurb: 'Lucky charm in his pocket, nerves of jelly.', lines: {
      hello: ["Lucky charm, don't fail me.", 'Okay, okay, deep breath.'], win: ['The charm works!', 'Whoa, I won!'], lose: ['Not again...', 'The charm is broken.'], bust: ['My lucky charm!', 'Why me?'], bj: ['No way!'],
      big: ['Gulp.'], fold: ['Too risky. I fold.'], double: ['Double... gulp.'], split: ['Split... gulp.'], allin: ['Oh boy, all in.'], raise: ['Raise? Me? Okay...'], surrender: ['I surrender!'] } }
  ];
  // a random line for a topic (hello, win, lose, bust, bj, big, fold, double, split, allin, raise, surrender)
  function line(key, topic, rand) {
    for (var i = 0; i < CAST.length; i++) if (CAST[i].key === key) { var l = CAST[i].lines[topic]; return l && l.length ? l[Math.floor((rand || Math.random)() * l.length)] : '' }
    return '';
  }
  // mistake chance by level: the bot picks a random hit/stand instead of the right play
  var NOISE = { easy: 0.16, normal: 0.05, hard: 0 };

  function styleOf(key) {
    for (var i = 0; i < CAST.length; i++) if (CAST[i].key === key) return CAST[i].style;
    return key;     // a style name can be passed directly
  }

  /* ---------- basic strategy (dealer stands on all 17s, double after split, peek) ---------- */
  // up = dealer up-card value (2..11, Ace = 11). Returns 'H','S','D' (double, else hit) or 'Ds' (double, else stand) or 'P'.
  function pairPlay(rank, up) {
    switch (rank) {
      case 'A': case '8': return 'P';
      case '10': case 'J': case 'Q': case 'K': return 'S';
      case '9': return (up >= 2 && up <= 6) || up === 8 || up === 9 ? 'P' : 'S';
      case '7': return up <= 7 ? 'P' : 'H';
      case '6': return up <= 6 ? 'P' : 'H';
      case '5': return hardPlay(10, up);
      case '4': return up === 5 || up === 6 ? 'P' : 'H';
      default: return up <= 7 ? 'P' : 'H';           // 2s and 3s
    }
  }
  function softPlay(total, up) {
    if (total <= 14) return up === 5 || up === 6 ? 'D' : 'H';
    if (total <= 16) return up >= 4 && up <= 6 ? 'D' : 'H';
    if (total === 17) return up >= 3 && up <= 6 ? 'D' : 'H';
    if (total === 18) return up >= 3 && up <= 6 ? 'Ds' : up === 2 || up === 7 || up === 8 ? 'S' : 'H';
    return 'S';
  }
  function hardPlay(total, up) {
    if (total <= 8) return 'H';
    if (total === 9) return up >= 3 && up <= 6 ? 'D' : 'H';
    if (total === 10) return up <= 9 ? 'D' : 'H';
    if (total === 11) return up <= 10 ? 'D' : 'H';
    if (total === 12) return up >= 4 && up <= 6 ? 'S' : 'H';
    if (total <= 16) return up <= 6 ? 'S' : 'H';
    return 'S';
  }
  function upValue(c) { return c.r === 'A' ? 11 : (c.r === 'K' || c.r === 'Q' || c.r === 'J') ? 10 : +c.r }

  // the textbook move for this hand, mapped to a legal action
  function basic(v, BJ) {
    var me = v.players[v.me], h = me.hands[v.turn.hand], legal = v.legal, up = upValue(v.dealer.cards[0]);
    var move;
    if (h.cards.length === 2 && BJ.canPair(h.cards[0], h.cards[1]) && legal.indexOf('split') >= 0) move = pairPlay(h.cards[0].r, up);
    else if (h.soft) move = softPlay(h.total, up);
    else move = hardPlay(h.total, up);
    // late surrender: hard 16 against 9, 10 or Ace, hard 15 against 10 (never a pair of 8s, which is split)
    if (legal.indexOf('surrender') >= 0 && !h.soft && !(move === 'P' && legal.indexOf('split') >= 0)) {
      if ((h.total === 16 && up >= 9) || (h.total === 15 && up === 10)) return 'surrender';
    }
    if (move === 'P') { if (legal.indexOf('split') >= 0) return 'split'; move = h.soft ? softPlay(h.total, up) : hardPlay(h.total, up) }
    if (move === 'D') return legal.indexOf('double') >= 0 ? 'double' : 'hit';
    if (move === 'Ds') return legal.indexOf('double') >= 0 ? 'double' : 'stand';
    return move === 'S' ? 'stand' : 'hit';
  }

  /* ---------- betting ---------- */
  function roundBet(x, min, max) {
    x = Math.floor(x / 10) * 10;
    return Math.max(min, Math.min(max, x));
  }
  function trueCount(v) { return v.count / Math.max(0.5, v.decksLeft) }

  function chooseBet(v, style, rand) {
    var me = v.players[v.me], o = v.opts, min = o.minBet, max = v.maxBet || o.maxBet, stack = me.chips + me.bet, amt;
    if (style === 'timid') amt = me.streak >= 2 ? min * 2 : min;
    else if (style === 'steady') amt = stack * 0.05;
    else if (style === 'counter') {
      var tc = trueCount(v), units = tc <= 1 ? 1 : Math.min(8, Math.floor(tc));
      amt = Math.max(min, stack * 0.02) * units;
    } else {                                              // gambler: chases losses, sometimes goes big
      amt = stack * 0.06;
      if (me.streak < 0) amt *= 1 + Math.min(3, -me.streak) * 0.5;
      if (rand() < 0.15) amt = stack * 0.25;
    }
    return roundBet(amt, min, max);
  }

  // How big a share of its stack a bot will risk to match somebody else's bet, by style.
  var TOLERANCE = { timid: .12, steady: .3, counter: .35, gambler: .7 };
  var ALLIN_CHANCE = { timid: .25, steady: .5, counter: .5, gambler: .9 };

  // Betting round with matching bets: the bot sees the table bet and decides to open, call, raise, go all in or fold.
  function seqBet(v, style, level, rand) {
    var o = v.betOpts, me = v.players[v.me], stack = me.chips + me.bet, noise = NOISE[level] != null ? NOISE[level] : NOISE.normal;
    if (!o) return null;
    var vv = Object.assign({}, v, { maxBet: o.max });
    if (o.high === 0) return o.mayOpen ? { type: 'bet', amount: chooseBet(vv, style, rand) } : { type: 'bet', amount: 0 };
    var tol = TOLERANCE[style] != null ? TOLERANCE[style] : .3;
    if (style === 'counter') tol += Math.max(0, trueCount(v) - 1) * .08;
    tol *= 1 + (rand() - .5) * (level === 'easy' ? 1.2 : level === 'normal' ? .4 : .1);
    if (o.canCall) {
      if (o.high / stack > tol) return { type: 'bet', amount: 0 };                       // too rich for this bot: it folds
      if (o.canRaise && (style === 'gambler' || style === 'counter') && rand() < .1 + noise) {
        var up = roundBet(Math.min(o.max, o.high * (1.5 + rand())), o.min, o.max);
        if (up > o.high && up / stack <= tol + .15) return { type: 'bet', amount: up };
      }
      return { type: 'bet', amount: o.high };
    }
    if (o.allIn && rand() < (ALLIN_CHANCE[style] != null ? ALLIN_CHANCE[style] : .5)) return { type: 'bet', amount: o.allIn };   // short stack: all in or out
    return { type: 'bet', amount: 0 };
  }

  /* ---------- the decision ---------- */
  function decide(v, BJ, persona, level, rand) {
    rand = rand || Math.random;
    var style = styleOf(persona), noise = NOISE[level] != null ? NOISE[level] : NOISE.normal;

    if (v.phase === 'bet') {
      if (v.needsRebuy) return { type: 'rebuy' };
      if (v.opts.matchBets) return v.bettor === v.me ? seqBet(v, style, level, rand) : null;
      if (v.maxBet < v.opts.minBet) return { type: 'bet', amount: 0 };
      return { type: 'bet', amount: chooseBet(v, style, rand) };
    }
    if (v.phase === 'insurance') {
      var take = style === 'counter' && trueCount(v) >= 3;
      return { type: take ? 'insurance' : 'noinsurance' };
    }
    if (v.phase !== 'turn' || !v.legal || !v.legal.length) return null;

    var l = v.legal, act = basic(v, BJ);
    if (rand() < noise) act = rand() < 0.5 && l.indexOf('hit') >= 0 ? 'hit' : 'stand';
    var h = v.players[v.me].hands[v.turn.hand], up = upValue(v.dealer.cards[0]);
    if (style === 'timid' && !h.soft && h.total >= 15 && h.total <= 16 && up >= 7 && rand() < 0.5) act = 'stand';       // too scared to hit
    if (style === 'timid' && act === 'split' && h.cards[0].r !== 'A' && h.cards[0].r !== '8') act = 'hit';
    if (style === 'gambler') {
      if (act === 'hit' && !h.soft && h.total >= 12 && h.total <= 16 && up <= 6 && rand() < 0.12) act = 'hit';        // feeling lucky
      if ((h.total === 10 || h.total === 11) && !h.soft && l.indexOf('double') >= 0) act = 'double';
    }
    if (style === 'gambler' && act === 'surrender') act = 'hit';                                                    // never gives up
    if (l.indexOf(act) < 0) act = l.indexOf('stand') >= 0 ? 'stand' : l[0];
    return { type: act };
  }

  var API = { CAST: CAST, line: line, decide: decide, basic: basic, styleOf: styleOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.BJBots = API;
})(typeof window !== 'undefined' ? window : globalThis);
