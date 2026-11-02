/* Self-check for the computer player. Run: node tests/test-ai.js */
const R = require('../js/rules.js');
const AI = require('../js/ai.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error('FAIL ' + name + '\n  ' + e.message); }
}
function ok(v, msg) { if (!v) throw new Error(msg || 'assertion failed'); }
function seeded(seed) { return () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }
const playAll = (pairs) => pairs.reduce((s, [b, c]) => R.play(s, b, c).state, R.newGame());

test('every level returns a legal move', () => {
  const s = playAll([[4, 2], [2, 4], [4, 0]]);
  for (const level of ['easy', 'medium', 'hard']) {
    const m = AI.choose(s, level, { timeMs: 100, maxDepth: 3, rnd: seeded(1) });
    ok(R.check(s, m.b, m.c).ok, level + ' played illegal ' + JSON.stringify(m));
  }
});

test('medium and hard take a winning small board and the winning game move', () => {
  // X owns boards 0 and 1 and has two cells in board 2, to move there: (2,2) wins the game.
  const s = R.newGame();
  s.boards[0] = R.X; s.boards[1] = R.X; s.cells[18] = R.X; s.cells[19] = R.X; s.turn = R.X; s.next = 2;
  for (const level of ['medium', 'hard']) {
    const m = AI.choose(s, level, { timeMs: 200, maxDepth: 3 });
    ok(m.b === 2 && m.c === 2, level + ' missed the game win: ' + JSON.stringify(m));
  }
});

test('medium and hard block a small-board win when forced into that board', () => {
  // O has two in a row in board 4 (cells 0,1); X must play in board 4 and should take cell 2.
  const s = R.newGame();
  s.cells[36] = R.O; s.cells[37] = R.O; s.turn = R.X; s.next = 4;
  for (const level of ['medium', 'hard']) {
    const m = AI.choose(s, level, { timeMs: 200, maxDepth: 4 });
    ok(m.b === 4 && m.c === 2, level + ' did not block: ' + JSON.stringify(m));
  }
});

test('hard search respects its time budget', () => {
  const s = playAll([[4, 4], [4, 0], [0, 4], [4, 8]]);
  const t = Date.now();
  AI.choose(s, 'hard', { timeMs: 150 });
  ok(Date.now() - t < 600, 'took ' + (Date.now() - t) + 'ms');
});

function match(levelX, levelO, seed, opts) {
  const rnd = seeded(seed);
  let s = R.newGame();
  while (!s.winner) {
    const level = s.turn === R.X ? levelX : levelO;
    const m = AI.choose(s, level, Object.assign({ rnd }, opts));
    s = R.play(s, m.b, m.c).state;
  }
  return s.winner;
}

test('medium beats easy most of the time', () => {
  let wins = 0, losses = 0;
  for (let g = 0; g < 20; g++) {
    const w = g % 2 ? match('easy', 'medium', g + 1) : match('medium', 'easy', g + 1);
    if (w === (g % 2 ? R.O : R.X)) wins++; else if (w !== R.DRAW) losses++;
  }
  ok(wins >= 15 && losses <= 3, `medium won ${wins}, lost ${losses}`);
});

test('hard beats easy and medium', () => {
  const o = { timeMs: Infinity, maxDepth: 3 };
  let easyWins = 0, mediumWins = 0;
  for (let g = 0; g < 6; g++) {
    const hx = g % 2 === 0;
    if (match(hx ? 'hard' : 'easy', hx ? 'easy' : 'hard', g + 7, o) === (hx ? R.X : R.O)) easyWins++;
    if (match(hx ? 'hard' : 'medium', hx ? 'medium' : 'hard', g + 7, o) === (hx ? R.X : R.O)) mediumWins++;
  }
  ok(easyWins >= 5, 'hard beat easy ' + easyWins + '/6');
  ok(mediumWins >= 4, 'hard beat medium ' + mediumWins + '/6');
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
