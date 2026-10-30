/* Ultimate Tic Tac Toe: the computer player.
   easy   = random legal move
   medium = one-move lookahead with win / block / safety heuristics
   hard   = the alpha-beta analysis engine (engine.js) with a time budget
   Pure: no DOM. Runs in a Web Worker (ai-worker.js) or on the main thread as a fallback. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules.js'), require('./engine.js'));
  else (root.UTTT = root.UTTT || {}).ai = factory(root.UTTT.rules, root.UTTT.engine);
})(typeof self !== 'undefined' ? self : this, function (R, E) {
  'use strict';

  const { LINES, DRAW } = R;
  const { POS, completes } = E;

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
  /* The analysis engine with a time budget. The very first move is random so games differ. */
  function hard(s, opts, rnd) {
    if (!s.cells.some(Boolean)) { const m = easy(s, rnd); return { b: m.b, c: m.c, score: 0, depth: 0 }; }
    return E.bestMove(s, { timeMs: opts.timeMs == null ? 900 : opts.timeMs, maxDepth: opts.maxDepth || 9 });
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
