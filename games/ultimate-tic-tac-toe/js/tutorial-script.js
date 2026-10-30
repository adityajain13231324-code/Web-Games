/* The tutorial's lesson script: pure data plus a state builder, so tests can check that every scripted move is legal.

   Each step starts from `setup` (drawn instantly), then plays `moves` one by one.
   `text` and `focus` are arrays indexed by how many scripted moves have been played so far (a string repeats).
   focus: 'board' | 'legal' | { board: b } | { boards: [...] } | { cell: [b, c] } */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules.js'));
  else (root.UTTT = root.UTTT || {}).tutorialScript = factory(root.UTTT.rules);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  /* X takes cells 1, 2, 0 of the top-left board and wins it; the last cell (0) points at that same, now won, board. */
  const WIN_TOP_LEFT = [[0, 1], [1, 0], [0, 2], [2, 0]];

  /* A position drawn directly: X owns the top-left and top-middle boards and has two cells in the top-right one. */
  const NEAR_WIN = {
    x: ['0.0', '0.1', '0.2', '1.3', '1.4', '1.5', '2.0', '2.1'],
    o: ['0.4', '0.7', '1.0', '1.8', '2.4', '2.8', '3.4', '5.4'],
    turn: 1, next: 2,
  };

  const STEPS = [
    {
      title: 'Welcome!', setup: [], moves: [], focus: 'board',
      text: 'This is one big board made of 9 small boards. Each small board is its own tic-tac-toe game.',
    },
    {
      title: 'Place your mark', setup: [], moves: [[4, 0]], focus: ['board', { cell: [4, 0] }],
      text: ['X goes first and can play anywhere. Watch this move…', 'X took the top-left cell of the middle board.'],
    },
    {
      title: 'You pick their board', setup: [[4, 0]], moves: [[0, 4]], focus: [{ board: 0 }, { board: 4 }],
      text: ['X played the top-left cell, so O must play in the top-left board. See it glow?', 'O played the centre cell, so X is sent to the centre board. The cell you pick chooses where your opponent plays!'],
    },
    {
      title: 'Win a small board', setup: WIN_TOP_LEFT, moves: [[0, 0]], focus: [{ board: 0 }, { board: 0 }],
      text: ['X has two in a row in the top-left board. One more…', 'Three in a row wins that small board. It now belongs to X!'],
    },
    {
      title: 'Free move!', setup: WIN_TOP_LEFT.concat([[0, 0]]), moves: [[4, 4]], focus: ['legal', { cell: [4, 4] }],
      text: ['X’s last cell pointed at a board that is already won. So O gets a free move: any glowing board!', 'O used the free move to take the centre. And the game goes on.'],
    },
    {
      title: 'Win the game', setup: NEAR_WIN, moves: [[2, 2]], focus: [{ boards: [0, 1, 2] }, { boards: [0, 1, 2] }],
      text: ['X owns two boards in the top row, and can win the third right now…', 'Three small boards in a row wins the whole game! A full board with no winner counts for nobody.'],
    },
    {
      title: 'You’re ready!', setup: [], moves: [], focus: 'board',
      text: 'Tips: use Hint if you’re stuck, Undo to take a move back, and try the themes in Settings. Have fun!',
    },
  ];

  const at = (v, i) => (Array.isArray(v) ? v[Math.min(i, v.length - 1)] : v);

  /* Build a state from a list of [b, c] moves (X first) or from a drawn position. */
  function build(setup) {
    if (Array.isArray(setup)) {
      let s = R.newGame();
      for (const [b, c] of setup) s = R.play(s, b, c).state;
      return s;
    }
    const s = R.newGame();
    setup.x.forEach((k) => { const [b, c] = k.split('.'); s.cells[b * 9 + +c] = R.X; });
    setup.o.forEach((k) => { const [b, c] = k.split('.'); s.cells[b * 9 + +c] = R.O; });
    for (let b = 0; b < 9; b++) s.boards[b] = R.boardResult(s.cells, b);
    s.turn = setup.turn; s.next = setup.next;
    return s;
  }

  return { STEPS, build, at };
});
