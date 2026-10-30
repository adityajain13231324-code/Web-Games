/* Self-check for the analysis engine. Run: node tests/test-engine.js */
const R = require('../js/rules.js');
const E = require('../js/engine.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error('FAIL ' + name + '\n  ' + e.message); }
}
function ok(v, msg) { if (!v) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || 'not equal'}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); }
function seeded(seed) { return () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }

/* Positions reached by random play, to test on. */
function positions(n, plies, seed) {
  const rnd = seeded(seed), out = [];
  while (out.length < n) {
    let s = R.newGame();
    for (let i = 0; i < plies && !s.winner; i++) { const l = R.legalMoves(s); const m = l[Math.floor(rnd() * l.length)]; s = R.play(s, m.b, m.c).state; }
    if (!s.winner) out.push(s);
  }
  return out;
}

/* Reference: plain minimax to a fixed depth, no table, no ordering, no windows. */
function reference(s, depth, ply) {
  if (s.winner) return s.winner === R.DRAW ? 0 : (s.winner === s.turn ? E.WIN - ply : -E.WIN + ply);
  if (depth === 0) return E.evaluate(s);
  let best = -Infinity;
  for (const m of R.legalMoves(s)) {
    const u = R.makeMove(s, m.b, m.c);
    best = Math.max(best, -reference(s, depth - 1, ply + 1));
    R.unmakeMove(s, u);
  }
  return best;
}

test('alpha-beta with the transposition table gives exactly the plain minimax score', () => {
  for (const s of positions(6, 22, 3)) {
    const searcher = E.createSearcher();
    for (const depth of [2, 3, 4]) {
      const r = searcher.analyze(s, { timeMs: 1e9, maxDepth: depth });
      eq(r.depth, depth);
      eq(r.lines[0].score, reference(s, depth, 0), `depth ${depth} score`);
    }
  }
});

test('the best move really has the best score', () => {
  const [s] = positions(1, 18, 9);
  const r = E.createSearcher().analyze(s, { timeMs: 1e9, maxDepth: 4, multiPV: 1 });
  const u = R.makeMove(s, r.lines[0].b, r.lines[0].c);
  const back = -reference(s, 3, 1);
  R.unmakeMove(s, u);
  eq(back, r.lines[0].score);
});

test('a forced win in one move is found and reported as a mate', () => {
  const s = R.newGame();
  s.boards[0] = R.X; s.boards[1] = R.X; s.cells[18] = R.X; s.cells[19] = R.X; s.turn = R.X; s.next = 2;
  const r = E.createSearcher().analyze(s, { timeMs: 500, maxDepth: 6 });
  eq([r.lines[0].b, r.lines[0].c], [2, 2]);
  ok(r.lines[0].score > E.MATE, 'mate score');
  eq(E.WIN - r.lines[0].score, 1, 'one ply to the win');
});

test('a lost position is reported as a forced loss', () => {
  // After X wins in one move the game is over: from O's side that is a finished, lost game.
  const s = R.newGame();
  s.boards[0] = R.X; s.boards[1] = R.X; s.cells[18] = R.X; s.cells[19] = R.X; s.turn = R.X; s.next = 2;
  const after = R.play(s, 2, 2).state;
  const r = E.createSearcher().analyze(after, { timeMs: 100 });
  ok(r.terminal && r.score < -E.MATE);
});

test('MultiPV: distinct legal moves, best first, the best line matches a single-line search', () => {
  const [s] = positions(1, 20, 5);
  const one = E.createSearcher().analyze(s, { timeMs: 1e9, maxDepth: 5, multiPV: 1 });
  const three = E.createSearcher().analyze(s, { timeMs: 1e9, maxDepth: 5, multiPV: 3 });
  eq(three.lines.length, 3);
  eq(three.lines[0].score, one.lines[0].score);
  ok(three.lines[0].score >= three.lines[1].score && three.lines[1].score >= three.lines[2].score, 'sorted');
  eq(new Set(three.lines.map((l) => l.b * 9 + l.c)).size, 3, 'distinct');
  three.lines.forEach((l) => ok(R.check(s, l.b, l.c).ok, 'legal'));
});

test('principal variations are legal move sequences that start with the line\'s move', () => {
  const [s] = positions(1, 16, 2);
  const r = E.createSearcher().analyze(s, { timeMs: 300, maxDepth: 8, multiPV: 2 });
  for (const l of r.lines) {
    eq([l.pv[0].b, l.pv[0].c], [l.b, l.c]);
    let cur = s;
    for (const m of l.pv) { ok(R.check(cur, m.b, m.c).ok, 'illegal pv move'); cur = R.play(cur, m.b, m.c).state; }
  }
});

test('info is reported after each finished depth, and the time budget is respected', () => {
  const [s] = positions(1, 10, 1);
  const depths = [], t = Date.now();
  E.createSearcher().analyze(s, { timeMs: 200, maxDepth: 30 }, (i) => depths.push(i.depth));
  ok(Date.now() - t < 700, 'took ' + (Date.now() - t) + ' ms');
  ok(depths.length >= 4 && depths.every((d, i) => d === i + 1), 'depths ' + depths.join(','));
});

test('winProb is a symmetric, increasing chance between 0 and 1', () => {
  eq(E.winProb(0), 0.5);
  ok(Math.abs(E.winProb(120) + E.winProb(-120) - 1) < 1e-9);
  ok(E.winProb(50) < E.winProb(100) && E.winProb(100) < E.winProb(300));
  eq(E.winProb(E.WIN - 3), 1); eq(E.winProb(-E.WIN + 3), 0);
  ok(E.winProb(140) > 0.6 && E.winProb(140) < 0.7);
});

test('a deeper search beats a shallow one', () => {
  let wins = 0, games = 6;
  for (let g = 0; g < games; g++) {
    const deepIsX = g % 2 === 0, rnd = seeded(40 + g);
    const deep = E.createSearcher(), shallow = E.createSearcher();
    let s = R.newGame();
    while (!s.winner) {
      const deepMoves = (s.turn === R.X) === deepIsX;
      let m;
      if (!s.cells.some(Boolean)) { const l = R.legalMoves(s); m = l[Math.floor(rnd() * l.length)]; }
      else m = (deepMoves ? deep : shallow).analyze(s, { timeMs: 1e9, maxDepth: deepMoves ? 6 : 1 }).lines[0];
      s = R.play(s, m.b, m.c).state;
    }
    if (s.winner === (deepIsX ? R.X : R.O)) wins++;
  }
  ok(wins >= 5, `deep search won ${wins}/${games}`);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
