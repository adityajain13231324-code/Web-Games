/* Self-check for the rules. Run: node tests/test-rules.js */
const R = require('../js/rules.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error('FAIL ' + name + '\n  ' + e.message); }
}
function ok(v, msg) { if (!v) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || 'not equal') + ': got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b));
}
const mv = (p, b, c) => ({ p, b, c });
/* Play a list of [b, c] pairs, X first. */
function playAll(pairs) {
  let s = R.newGame();
  for (const [b, c] of pairs) s = R.play(s, b, c).state;
  return s;
}

test('new game: X moves first, any board is legal', () => {
  const s = R.newGame();
  eq(s.turn, R.X); eq(R.legalBoards(s), [0, 1, 2, 3, 4, 5, 6, 7, 8]); eq(R.legalMoves(s).length, 81);
});

test('the cell played decides the next board', () => {
  const s = playAll([[4, 2]]);
  eq(s.next, 2); eq(R.legalBoards(s), [2]); eq(s.turn, R.O);
  eq(R.legalMoves(s).length, 9);
});

test('playing in the wrong board is rejected with a reason', () => {
  const s = playAll([[4, 2]]);
  const r = R.check(s, 5, 0);
  eq(r.ok, false); eq(r.code, 'wrongBoard'); eq(r.boards, [2]);
});

test('taken cell is rejected', () => {
  const s = playAll([[4, 2], [2, 4]]);
  eq(s.next, 4);
  eq(R.check(s, 4, 2).code, 'taken');
});

/* X wins board 0 (cells 1, 2, 0) while O is sent to boards 1 and 2 and back; the winning move is cell 0. */
const WIN_BOARD0 = [[0, 1], [1, 0], [0, 2], [2, 0], [0, 0]];

test('X wins a small board with three in a row and the board is owned', () => {
  const r = R.play(playAll(WIN_BOARD0.slice(0, 4)), 0, 0);
  eq(r.state.boards[0], R.X); eq(r.events.boardWon, { b: 0, p: R.X, line: [0, 1, 2] });
  eq(r.state.winner, 0);
});

test('free move: target board already won gives any open board', () => {
  // The winning move was cell 0, which points at board 0: the board it just won.
  const s = playAll(WIN_BOARD0);
  eq(s.boards[0], R.X);
  eq(s.next, -1, 'sent to a won board means free move');
  eq(R.legalBoards(s), [1, 2, 3, 4, 5, 6, 7, 8]);
  eq(R.check(s, 0, 3).code, 'won');
  eq(R.check(s, 5, 3).ok, true);
});

test('free move: target board full (drawn) gives any open board', () => {
  const s = R.newGame();
  // board 3 filled with a drawn pattern: X O X / X O O / O X X
  const pattern = [1, 2, 1, 1, 2, 2, 2, 1, 1];
  pattern.forEach((v, i) => { s.cells[27 + i] = v; });
  s.boards[3] = R.boardResult(s.cells, 3);
  eq(s.boards[3], R.DRAW);
  s.next = 3;
  eq(R.legalBoards(s), [0, 1, 2, 4, 5, 6, 7, 8]);
  eq(R.check(s, 3, 0).code, 'drawn');
});

test('three owned boards in a row win the game', () => {
  const s = R.newGame();
  s.boards[0] = R.X; s.boards[1] = R.X;
  // X needs board 2: fill it so one more X move wins it
  s.cells[18] = R.X; s.cells[19] = R.X; // board 2, cells 0,1
  s.turn = R.X; s.next = 2;
  const r = R.play(s, 2, 2);
  eq(r.state.boards[2], R.X); eq(r.state.winner, R.X); eq(r.state.line, [0, 1, 2]);
  eq(r.events.gameWon.p, R.X); eq(r.events.boardWon.b, 2);
  eq(R.legalBoards(r.state), []);
  eq(R.check(r.state, 5, 5).code, 'over');
});

test('drawn boards count for neither player', () => {
  eq(R.macroLine([1, 3, 1, 0, 0, 0, 0, 0, 0]), null);
  eq(R.macroLine([3, 3, 3, 0, 0, 0, 0, 0, 0]), null);
  eq(R.macroLine([2, 2, 2, 0, 0, 0, 0, 0, 0]), [0, 1, 2]);
  eq(R.macroLine([1, 0, 0, 0, 1, 0, 0, 0, 1]), [0, 4, 8]);
});

test('game is a draw when every board is decided and nobody has a line', () => {
  const s = R.newGame();
  // X O X / O X O / O X O in boards, no line (check: rows, cols, diagonals)
  s.boards = [1, 2, 1, 2, 1, 2, 2, 1, 2];
  eq(R.macroLine(s.boards), [0, 4, 8].every((i) => s.boards[i] === 1) ? [0, 4, 8] : null);
  // use a layout with no line at all
  s.boards = [1, 2, 1, 1, 2, 2, 2, 1, 3];
  eq(R.macroLine(s.boards), null);
  // last board gets decided by a move: board 8 has 8 cells, one left, drawn pattern
  const pattern = [1, 2, 1, 1, 2, 2, 2, 1, 0];
  pattern.forEach((v, i) => { s.cells[72 + i] = v; });
  s.boards[8] = 0; s.next = 8; s.turn = R.X; // X plays the last cell: 1,2,1,1,2,2,2,1,1 -> no line
  const r = R.play(s, 8, 8);
  eq(r.state.boards[8], R.DRAW); eq(r.state.winner, R.DRAW); eq(r.events.gameDrawn, true);
});

/* A real 58-move game, found by random play, that nobody wins: every board decided, no three owned boards in a row. */
const DRAWN_GAME = [[6,1],[1,5],[5,2],[2,6],[6,8],[8,3],[3,6],[6,7],[7,2],[2,8],[8,4],[4,8],[8,6],[6,2],[2,2],[2,7],[7,0],[0,2],[4,0],[0,5],[5,1],[1,7],[7,7],[7,8],[8,2],[4,3],[3,0],[0,0],[0,7],[7,3],[3,4],[4,7],[7,5],[5,3],[3,8],[0,3],[5,0],[0,8],[1,6],[6,5],[1,8],[1,2],[6,3],[7,4],[4,5],[7,1],[1,1],[1,0],[6,6],[6,4],[4,6],[6,0],[4,4],[4,2],[1,3],[7,6],[4,1],[1,4]];
test('a complete drawn game: drawn boards count for nobody and the game ends level', () => {
  const s = playAll(DRAWN_GAME);
  eq(s.winner, R.DRAW); eq(s.line, null); eq(R.macroLine(s.boards), null);
  ok(s.boards.every((v) => v !== 0), 'every board is decided');
  ok(s.boards.includes(R.DRAW), 'at least one board is drawn');
  eq(R.legalMoves(s), []); eq(R.check(s, 0, 0).code, 'over');
  const last = DRAWN_GAME[DRAWN_GAME.length - 1];
  eq(R.play(playAll(DRAWN_GAME.slice(0, -1)), last[0], last[1]).events.gameDrawn, true);
});

test('pass gives the opponent a free move and is recorded', () => {
  const s = R.pass(playAll([[4, 2]]));
  eq(s.turn, R.X); eq(s.next, -1); eq(s.moves[1].b, -1);
  eq(R.fromMoves(s.moves).turn, R.X);
});

test('makeMove / unmakeMove restore the state exactly', () => {
  const s = playAll(WIN_BOARD0.slice(0, 4));
  const before = JSON.stringify(s);
  const u = R.makeMove(s, 0, 0); // X wins board 0
  eq(s.boards[0], R.X);
  R.unmakeMove(s, u);
  eq(JSON.stringify(s), before);
});

test('fromMoves replays a game and rejects illegal moves', () => {
  const s = playAll([[4, 2], [2, 4], [4, 0]]);
  eq(JSON.stringify(R.fromMoves(s.moves)), JSON.stringify(s));
  let threw = false;
  try { R.fromMoves([mv(1, 4, 2), mv(2, 0, 0)]); } catch (e) { threw = true; }
  eq(threw, true);
});

test('random games: always terminate, consistent results, every legal move is playable', () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const results = { 1: 0, 2: 0, 3: 0 };
  for (let g = 0; g < 3000; g++) {
    let s = R.newGame(), guard = 0;
    while (!s.winner) {
      const moves = R.legalMoves(s);
      if (!moves.length) throw new Error('no legal moves but game not over');
      const m = moves[Math.floor(rnd() * moves.length)];
      eq(R.check(s, m.b, m.c).ok, true);
      s = R.play(s, m.b, m.c).state;
      if (++guard > 81) throw new Error('game too long');
    }
    results[s.winner]++;
    if (s.winner === R.DRAW) { if (R.macroLine(s.boards) || s.boards.some((v) => v === 0)) throw new Error('bad draw'); }
    else { const L = R.macroLine(s.boards); eq(s.boards[L[0]], s.winner); }
    for (let b = 0; b < 9; b++) eq(s.boards[b], R.boardResult(s.cells, b));
  }
  if (!results[1] || !results[2]) throw new Error('expected wins for both players');
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
