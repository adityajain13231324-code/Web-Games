/* Ultimate Tic Tac Toe: the analysis engine. Pure (no DOM), runs in a Web Worker or in Node.

   Negamax alpha-beta with iterative deepening, a transposition table (Zobrist hashing), move ordering
   and several principal variations (MultiPV). Scores are for the player to move: positive is good for them.
   A score above MATE means a forced win (WIN - score = plies to it); below -MATE a forced loss.
   Both the hard computer player (ai.js) and the analysis board (analysis.js) use it. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules.js'));
  else (root.UTTT = root.UTTT || {}).engine = factory(root.UTTT.rules);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  const { LINES, DRAW } = R;
  const POS = [3, 2, 3, 2, 4, 2, 3, 2, 3];          // centre > corner > edge, for cells and for boards
  const LINES_OF = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => LINES.filter((L) => L.includes(i)));
  const WIN = 100000, MATE = WIN - 1000, INF = 1e9;
  const TT_MAX = 400000;

  /* Would player p complete a line in small board b by taking cell c? */
  function completes(cells, b, c, p) {
    const o = b * 9;
    return LINES_OF[c].some((L) => L.every((i) => i === c || cells[o + i] === p));
  }

  /* Static score for the player to move. Small boards weigh by position; open boards by their lines. */
  function evaluate(s) {
    const me = s.turn, opp = R.other(me), B = s.boards, C = s.cells;
    let score = 0;
    for (let b = 0; b < 9; b++) {
      const v = B[b];
      if (v === me) score += 100 + POS[b] * 12;
      else if (v === opp) score -= 100 + POS[b] * 12;
      else if (v === 0) {
        const o = b * 9;
        let local = 0;
        for (let l = 0; l < 8; l++) {
          const L = LINES[l];
          let m = 0, t = 0;
          for (let k = 0; k < 3; k++) { const x = C[o + L[k]]; if (x === me) m++; else if (x === opp) t++; }
          if (!t && m) local += m === 2 ? 7 : 1;
          else if (!m && t) local -= t === 2 ? 7 : 1;
        }
        const ctr = C[o + 4];
        local += ctr === me ? 3 : ctr === opp ? -3 : 0;
        score += local * (POS[b] / 3);
      }
    }
    for (let l = 0; l < 8; l++) {
      const L = LINES[l];
      let m = 0, t = 0, d = 0;
      for (let k = 0; k < 3; k++) { const x = B[L[k]]; if (x === me) m++; else if (x === opp) t++; else if (x === DRAW) d++; }
      if (d) continue;
      if (!t && m) score += m === 2 ? 90 : 12;
      else if (!m && t) score -= t === 2 ? 90 : 12;
    }
    if (s.next === -1) score += 18;                  // the side to move has a free choice
    return score;
  }

  /* Chance (0 to 1) that player X wins, from a score in X's favour. A logistic curve: about +140
     (one small board up) is roughly 65%, and forced results are exactly 0 or 1. */
  function winProb(scoreX) {
    if (scoreX >= MATE) return 1;
    if (scoreX <= -MATE) return 0;
    return 1 / (1 + Math.exp(-scoreX / 230));
  }

  /* ───── hashing ───── */
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) | 0;
    };
  }
  const rand = rng(0x5eed1e5);
  const ZA = new Int32Array(243), ZB = new Int32Array(243), NA = new Int32Array(10), NB = new Int32Array(10), TA = new Int32Array(3), TB = new Int32Array(3);
  for (let i = 0; i < 243; i++) { ZA[i] = rand(); ZB[i] = rand(); }
  for (let i = 0; i < 10; i++) { NA[i] = rand(); NB[i] = rand(); }
  for (let i = 0; i < 3; i++) { TA[i] = rand(); TB[i] = rand(); }
  const keyOf = (a, b) => (a >>> 0) * 2097152 + (b & 0x1fffff);   // 53 bits: a safe integer

  function hashCells(s) {
    let a = 0, b = 0;
    for (let i = 0; i < 81; i++) if (s.cells[i]) { a ^= ZA[i * 3 + s.cells[i]]; b ^= ZB[i * 3 + s.cells[i]]; }
    return [a, b];
  }

  const EXACT = 0, LOWER = 1, UPPER = 2;
  const TIMEOUT = {};

  /* Moves as ints (b * 9 + c): the TT move first, then board-winning moves, then central ones. */
  function ordered(s, ttMove) {
    const me = s.turn, opp = R.other(me), idx = [], key = [];
    const open = s.next >= 0 && s.boards[s.next] === 0 ? [s.next] : [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((b) => s.boards[b] === 0);
    for (const b of open) {
      for (let c = 0; c < 9; c++) {
        if (s.cells[b * 9 + c]) continue;
        const i = b * 9 + c;
        let k = POS[c] + (completes(s.cells, b, c, me) ? 50 : 0) + (completes(s.cells, b, c, opp) ? 20 : 0) + (s.boards[c] !== 0 ? -8 : 0);
        if (i === ttMove) k += 1000;
        let j = idx.length;
        idx.push(i); key.push(k);
        while (j > 0 && key[j - 1] < k) { idx[j] = idx[j - 1]; key[j] = key[j - 1]; j--; idx[j] = i; key[j] = k; }
      }
    }
    return idx;
  }

  const toTT = (sc, ply) => (sc > MATE ? sc + ply : sc < -MATE ? sc - ply : sc);
  const fromTT = (sc, ply) => (sc > MATE ? sc - ply : sc < -MATE ? sc + ply : sc);

  function createSearcher() {
    const tt = new Map();
    let s = null, h1 = 0, h2 = 0, nodes = 0, deadline = 0;

    function make(i) {
      const p = s.turn;
      h1 ^= ZA[i * 3 + p]; h2 ^= ZB[i * 3 + p];
      return R.makeMove(s, (i / 9) | 0, i % 9);
    }
    function unmake(u) {
      const i = u.b * 9 + u.c;
      h1 ^= ZA[i * 3 + u.p]; h2 ^= ZB[i * 3 + u.p];
      R.unmakeMove(s, u);
    }

    function negamax(depth, alpha, beta, ply) {
      if (s.winner) return s.winner === DRAW ? 0 : (s.winner === s.turn ? WIN - ply : -WIN + ply);
      if (depth <= 0) return evaluate(s);
      if ((++nodes & 2047) === 0 && Date.now() > deadline) throw TIMEOUT;
      const key = keyOf(h1 ^ NA[s.next + 1] ^ TA[s.turn], h2 ^ NB[s.next + 1] ^ TB[s.turn]);
      const e = tt.get(key);
      let ttMove = -1;
      if (e) {
        ttMove = e.move;
        if (e.depth >= depth) {
          const sc = fromTT(e.score, ply);
          if (e.flag === EXACT) return sc;
          if (e.flag === LOWER && sc > alpha) alpha = sc;
          else if (e.flag === UPPER && sc < beta) beta = sc;
          if (alpha >= beta) return sc;
        }
      }
      const alpha0 = alpha;
      let best = -INF, bestMove = -1;
      for (const i of ordered(s, ttMove)) {
        const u = make(i);
        const v = -negamax(depth - 1, -beta, -alpha, ply + 1);
        unmake(u);
        if (v > best) { best = v; bestMove = i; }
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      if (!e || e.depth <= depth) tt.set(key, { depth, score: toTT(best, ply), flag: best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT, move: bestMove });
      return best;
    }

    /* The line the engine expects, read back from the transposition table. */
    function principalVariation(state, first, maxLen) {
      const pv = [first];
      let cur = R.clone(state);
      cur = R.play(cur, (first / 9) | 0, first % 9).state;
      while (pv.length < maxLen && !cur.winner) {
        const [a, b] = hashCells(cur);
        const e = tt.get(keyOf(a ^ NA[cur.next + 1] ^ TA[cur.turn], b ^ NB[cur.next + 1] ^ TB[cur.turn]));
        if (!e || e.move < 0 || !R.check(cur, (e.move / 9) | 0, e.move % 9).ok) break;
        pv.push(e.move);
        cur = R.play(cur, (e.move / 9) | 0, e.move % 9).state;
      }
      return pv.map((i) => ({ b: (i / 9) | 0, c: i % 9 }));
    }

    /* Analyse a position. opts: { timeMs, maxDepth, multiPV }. onInfo(result) fires after every finished depth.
       Returns the last finished depth: { depth, nodes, ms, turn, lines: [{ b, c, score, pv }] } (best line first)
       or { terminal: true, score } when the game is already over. */
    function analyze(state, opts, onInfo) {
      opts = opts || {};
      if (state.winner) return { terminal: true, depth: 0, nodes: 0, ms: 0, turn: state.turn, lines: [], score: state.winner === DRAW ? 0 : (state.winner === state.turn ? WIN : -WIN) };
      if (tt.size > TT_MAX) tt.clear();
      s = R.clone(state);
      [h1, h2] = hashCells(s);
      nodes = 0;
      const t0 = Date.now(), K = opts.multiPV || 1, maxDepth = opts.maxDepth || 14;
      deadline = t0 + (opts.timeMs == null ? 1000 : opts.timeMs);
      let order = ordered(s, -1), result = null;

      for (let depth = 1; depth <= maxDepth; depth++) {
        const lines = [];
        try {
          for (const i of order) {
            const alpha = lines.length >= K ? lines[K - 1].score : -INF;
            const u = make(i);
            const v = -negamax(depth - 1, -INF, -alpha, 1);
            unmake(u);
            if (lines.length < K || v > alpha) {
              lines.push({ i, score: v });
              lines.sort((x, y) => y.score - x.score);
              if (lines.length > K) lines.pop();
            }
          }
        } catch (err) {
          if (err !== TIMEOUT) throw err;
          break;                                     // keep the last finished depth
        }
        for (const l of lines) { const m = (l.i / 9) | 0; l.b = m; l.c = l.i % 9; }
        result = {
          depth, nodes, ms: Date.now() - t0, turn: state.turn,
          lines: lines.map((l) => ({ b: l.b, c: l.c, score: l.score, pv: principalVariation(state, l.i, Math.min(depth, 8)) })),
        };
        if (onInfo) onInfo(result);
        order = lines.map((l) => l.i).concat(order.filter((i) => !lines.some((l) => l.i === i)));
        if (order.length === 1 || (lines[0].score > MATE && lines[0].score >= WIN - depth) || lines[0].score < -MATE) break; // decided
      }
      return result;
    }

    return { analyze, clear: () => tt.clear(), get size() { return tt.size; } };
  }

  const shared = createSearcher();

  /* The move a computer player should make: { b, c, score, depth }. */
  function bestMove(state, opts) {
    const r = shared.analyze(state, { timeMs: opts.timeMs, maxDepth: opts.maxDepth || 9, multiPV: 1 });
    const l = r.lines[0];
    return { b: l.b, c: l.c, score: l.score, depth: r.depth };
  }

  return { createSearcher, bestMove, evaluate, winProb, completes, POS, WIN, MATE };
});
