/* Ultimate Tic Tac Toe: the computer player.
   easy   = random legal move
   medium = one-move lookahead with win / block / safety heuristics
   hard   = negamax with alpha-beta, iterative deepening and a time budget
   Pure: no DOM. Runs in a Web Worker (ai-worker.js) or on the main thread as a fallback. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules.js'));
  else (root.UTTT = root.UTTT || {}).ai = factory(root.UTTT.rules);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  const { LINES, DRAW } = R;
  const POS = [3, 2, 3, 2, 4, 2, 3, 2, 3];           // centre > corner > edge, for cells and for boards
  const LINES_OF = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => LINES.filter((L) => L.includes(i)));
  const WIN = 100000;

  /* Would player p complete a line in board b by taking cell c? */
  function completes(cells, b, c, p) {
    const o = b * 9;
    return LINES_OF[c].some((L) => L.every((i) => i === c || cells[o + i] === p));
  }

  /* ───── easy ───── */
  function easy(s, rnd) {
    const m = R.legalMoves(s);
    return m[Math.floor(rnd() * m.length)];
  }

  /* ───── medium ───── */
  function medium(s, rnd) {
    const me = s.turn, opp = R.other(me);
    let best = null, bestScore = -Infinity;
    for (const m of R.legalMoves(s)) {
      const wasBlock = completes(s.cells, m.b, m.c, opp);          // taking this cell stops the opponent's line
      const wasWin = completes(s.cells, m.b, m.c, me);
      const u = R.makeMove(s, m.b, m.c);
      let score = rnd() * 6 + POS[m.c] * 2 + POS[m.b];
      if (s.winner === me) { R.unmakeMove(s, u); return m; }
      if (s.winner === DRAW) score -= 5;
      if (wasWin) score += 60;                       // wins a small board
      else if (wasBlock) score += 35;                // stops the opponent winning this board
      if (s.boards[m.b] === DRAW) score -= 10;
      if (wasWin) {                                  // progress on the big board
        const L = LINES.filter((l) => l.includes(m.b) && l.every((i) => s.boards[i] === me || s.boards[i] === 0));
        score += L.reduce((a, l) => a + (l.filter((i) => s.boards[i] === me).length === 2 ? 40 : 8), 0);
      }
      // what can the opponent do next?
      if (s.next === -1) score -= 28;                // we hand over a free move
      let dangerBoard = false, dangerGame = false;
      for (const r of R.legalMoves(s)) {
        if (completes(s.cells, r.b, r.c, opp)) {
          dangerBoard = true;
          const v = R.makeMove(s, r.b, r.c);
          if (s.winner === opp) dangerGame = true;
          R.unmakeMove(s, v);
        }
      }
      if (dangerGame) score -= 400; else if (dangerBoard) score -= 45;
      R.unmakeMove(s, u);
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  /* ───── hard ───── */
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

  /* Cheap move ordering: moves that win a board first, then the central ones. */
  function ordered(s) {
    const me = s.turn, moves = R.legalMoves(s);
    for (const m of moves) {
      m.k = POS[m.c] + (completes(s.cells, m.b, m.c, me) ? 50 : 0) + (completes(s.cells, m.b, m.c, R.other(me)) ? 20 : 0)
        + (s.boards[m.c] !== 0 ? -8 : 0);           // sending the opponent to a closed board gives them a free move
    }
    return moves.sort((a, b) => b.k - a.k);
  }

  const TIMEOUT = {};

  function negamax(s, depth, alpha, beta, ply, ctx) {
    if (s.winner) return s.winner === DRAW ? 0 : (s.winner === s.turn ? WIN - ply : -WIN + ply);
    if (depth === 0) return evaluate(s);
    if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) throw TIMEOUT;
    let best = -Infinity;
    for (const m of ordered(s)) {
      const u = R.makeMove(s, m.b, m.c);
      let v;
      try { v = -negamax(s, depth - 1, -beta, -alpha, ply + 1, ctx); } finally { R.unmakeMove(s, u); }
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  /* Iterative deepening: keeps the best move of the last depth that finished in time. */
  function hard(s, opts, rnd) {
    const work = R.clone(s);
    if (!work.cells.some(Boolean)) { const m = easy(work, rnd); return { b: m.b, c: m.c, score: 0, depth: 0 }; }
    const ctx = { nodes: 0, deadline: Date.now() + (opts.timeMs == null ? 900 : opts.timeMs) };
    const maxDepth = opts.maxDepth || 9;
    let moves = ordered(work), result = { b: moves[0].b, c: moves[0].c, score: 0, depth: 0 };
    for (let depth = 1; depth <= maxDepth; depth++) {
      let bestScore = -Infinity, bestMove = null, alpha = -Infinity;
      try {
        for (const m of moves) {
          const u = R.makeMove(work, m.b, m.c);
          let v;
          try { v = -negamax(work, depth - 1, -Infinity, -alpha, 1, ctx); } finally { R.unmakeMove(work, u); }
          if (v > bestScore) { bestScore = v; bestMove = m; }
          if (v > alpha) alpha = v;
        }
      } catch (e) {
        if (e !== TIMEOUT) throw e;
        break;
      }
      result = { b: bestMove.b, c: bestMove.c, score: bestScore, depth };
      moves = [bestMove].concat(moves.filter((m) => m !== bestMove)); // search the best move first next time
      if (Math.abs(bestScore) > WIN - 100) break;    // forced result found
    }
    return result;
  }

  /* level: 'easy' | 'medium' | 'hard'. opts: { timeMs, maxDepth, rnd }. Returns { b, c }. */
  function choose(state, level, opts) {
    opts = opts || {};
    const rnd = opts.rnd || Math.random;
    const s = R.clone(state);
    if (level === 'easy') return easy(s, rnd);
    if (level === 'medium') return medium(s, rnd);
    return hard(s, opts, rnd);
  }

  return { choose };
});
