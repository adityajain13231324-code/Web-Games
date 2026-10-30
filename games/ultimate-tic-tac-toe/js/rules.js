/* Ultimate Tic Tac Toe: the rules. Pure functions, no DOM, no timers, no randomness.
   Works as a browser script (window.UTTT.rules), in a Web Worker and in Node (require).

   A cell is addressed by (b, c): b = small board 0-8, c = cell 0-8 inside it, both row-major.
   Players are 1 (X, moves first) and 2 (O). A small board is 0 (open), 1, 2 (owned) or 3 (drawn). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.UTTT = root.UTTT || {}).rules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const X = 1, O = 2, DRAW = 3;
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const other = (p) => 3 - p;

  function newGame() {
    return { cells: new Array(81).fill(0), boards: new Array(9).fill(0), next: -1, turn: X, winner: 0, line: null, moves: [] };
  }

  function clone(s) {
    return { cells: s.cells.slice(), boards: s.boards.slice(), next: s.next, turn: s.turn, winner: s.winner, line: s.line, moves: s.moves.slice() };
  }

  /* The three cells of a small board that make a line for player p, or null. */
  function boardLine(cells, b) {
    const o = b * 9;
    for (let i = 0; i < 8; i++) {
      const L = LINES[i], v = cells[o + L[0]];
      if (v && v === cells[o + L[1]] && v === cells[o + L[2]]) return L;
    }
    return null;
  }

  /* 0 = still open, 1/2 = won, 3 = full without a line (drawn). */
  function boardResult(cells, b) {
    const L = boardLine(cells, b);
    if (L) return cells[b * 9 + L[0]];
    const o = b * 9;
    for (let i = 0; i < 9; i++) if (!cells[o + i]) return 0;
    return DRAW;
  }

  /* Three owned small boards in a row. Drawn boards (3) belong to nobody, so they never count. */
  function macroLine(boards) {
    for (let i = 0; i < 8; i++) {
      const L = LINES[i], v = boards[L[0]];
      if ((v === X || v === O) && v === boards[L[1]] && v === boards[L[2]]) return L;
    }
    return null;
  }

  /* Small boards the current player may play in. Empty when the game is over.
     A target board that is won or drawn gives a free move: every open board. */
  function legalBoards(s) {
    if (s.winner) return [];
    if (s.next >= 0 && s.boards[s.next] === 0) return [s.next];
    return ALL.filter((b) => s.boards[b] === 0);
  }

  function legalMoves(s) {
    const out = [];
    for (const b of legalBoards(s)) for (let c = 0; c < 9; c++) if (!s.cells[b * 9 + c]) out.push({ b, c });
    return out;
  }

  /* Why a move is not allowed, or { ok: true }. Order matters for the message the player sees:
     a closed board first, then "wrong board", then "taken". */
  function check(s, b, c) {
    if (s.winner) return { ok: false, code: 'over', reason: 'The game is over', boards: [] };
    const legal = legalBoards(s);
    if (s.boards[b] === X || s.boards[b] === O) return { ok: false, code: 'won', reason: 'That board is already won', boards: legal };
    if (s.boards[b] === DRAW) return { ok: false, code: 'drawn', reason: 'That board is full', boards: legal };
    if (!legal.includes(b)) return { ok: false, code: 'wrongBoard', reason: 'You must play in the glowing board', boards: legal };
    if (s.cells[b * 9 + c]) return { ok: false, code: 'taken', reason: 'Cell already taken', boards: legal };
    return { ok: true };
  }

  /* Apply a move in place; returns an undo record. The caller must have checked legality. */
  function makeMove(s, b, c) {
    const p = s.turn;
    const u = { b, c, p, next: s.next, board: s.boards[b], winner: s.winner, line: s.line };
    s.cells[b * 9 + c] = p;
    s.moves.push({ p, b, c });
    if (!s.boards[b]) {
      s.boards[b] = boardResult(s.cells, b);
      if (s.boards[b]) {
        const L = macroLine(s.boards);
        if (L) { s.winner = s.boards[L[0]]; s.line = L; }
        else if (s.boards.every((v) => v !== 0)) s.winner = DRAW;
      }
    }
    s.next = s.boards[c] === 0 ? c : -1;
    s.turn = other(p);
    return u;
  }

  function unmakeMove(s, u) {
    s.moves.pop();
    s.cells[u.b * 9 + u.c] = 0;
    s.boards[u.b] = u.board;
    s.next = u.next;
    s.winner = u.winner;
    s.line = u.line;
    s.turn = u.p;
  }

  /* Pure version for the UI: returns the new state plus what happened. */
  function play(s, b, c) {
    const r = check(s, b, c);
    if (!r.ok) throw new Error(r.reason);
    const n = clone(s);
    const before = n.boards[b];
    makeMove(n, b, c);
    const events = { boardWon: null, boardDrawn: false, gameWon: null, gameDrawn: false };
    if (!before && n.boards[b] === DRAW) events.boardDrawn = true;
    else if (!before && n.boards[b]) events.boardWon = { b, p: n.boards[b], line: boardLine(n.cells, b) };
    if (n.winner === DRAW) events.gameDrawn = true;
    else if (n.winner) events.gameWon = { p: n.winner, line: n.line };
    return { state: n, events };
  }

  /* A skipped turn (timer ran out): the opponent gets a free move. Recorded as b = -1. */
  function pass(s) {
    const n = clone(s);
    n.moves.push({ p: n.turn, b: -1, c: -1 });
    n.next = -1;
    n.turn = other(n.turn);
    return n;
  }

  /* Rebuild a state from a move list (passes included). Throws on an illegal move. */
  function fromMoves(moves) {
    let s = newGame();
    for (const m of moves) {
      if (m.b < 0) { s = pass(s); continue; }
      if (m.p !== s.turn) throw new Error('Move out of turn');
      s = play(s, m.b, m.c).state;
    }
    return s;
  }

  /* Numbers of owned small boards, for scoring and the UI. */
  function counts(s) {
    const n = { 1: 0, 2: 0, 3: 0 };
    for (const v of s.boards) if (v) n[v]++;
    return n;
  }

  return { X, O, DRAW, LINES, newGame, clone, boardLine, boardResult, macroLine, legalBoards, legalMoves, check, makeMove, unmakeMove, play, pass, fromMoves, counts, other };
});
