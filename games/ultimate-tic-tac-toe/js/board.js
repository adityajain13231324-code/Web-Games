/* The board view: builds the 9x9 DOM and animates it. It never decides anything about the rules;
   the game controller (or the tutorial) tells it what happened.
   Animation uses only transform and opacity (plus the stroke draw-on of the marks), and everything
   is skipped or shortened when animations are off. */
(function (root) {
  'use strict';
  const R = root.UTTT.rules;

  const POS = ['top left', 'top centre', 'top right', 'middle left', 'centre', 'middle right', 'bottom left', 'bottom centre', 'bottom right'];

  /* X and O as stroke paths (pathLength=1 so one dash value draws them on). */
  const SHAPES = {
    clean: {
      1: '<path d="M26 26L74 74" pathLength="1"/><path d="M74 26L26 74" pathLength="1"/>',
      2: '<circle cx="50" cy="50" r="25" pathLength="1" transform="rotate(-90 50 50)"/>',
    },
    sketch: {
      1: '<path d="M24 27C38 38 58 60 77 75" pathLength="1"/><path d="M76 23C61 41 42 60 26 77" pathLength="1"/>',
      2: '<path d="M52 23C75 21 79 47 75 60C71 79 40 81 27 64C17 50 27 25 49 24C56 23 61 25 63 28" pathLength="1"/>',
    },
    pixel: {
      1: '<path d="M20 20H32V32H44V44H56V56H68V68H80V80" pathLength="1"/><path d="M80 20H68V32H56V44H44V56H32V68H20V80" pathLength="1"/>',
      2: '<path d="M38 20H62V32H74V44H80V56H74V68H62V80H38V68H26V56H20V44H26V32H38Z" pathLength="1"/>',
    },
  };

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* A line through three cells (or three boards) of a 3x3 grid, drawn on a 3x3 viewBox. */
  function lineSVG(line, cls, glow) {
    const a = line[0], c = line[2];
    const ax = a % 3 + .5, ay = Math.floor(a / 3) + .5, cx = c % 3 + .5, cy = Math.floor(c / 3) + .5;
    const len = Math.hypot(cx - ax, cy - ay), ux = (cx - ax) / len, uy = (cy - ay) / len, ext = .2;
    const l = (c) => `<line class="${c}" x1="${ax - ux * ext}" y1="${ay - uy * ext}" x2="${cx + ux * ext}" y2="${cy + uy * ext}" pathLength="1"/>`;
    return `<svg class="${cls}" viewBox="0 0 3 3" aria-hidden="true">${glow ? l('halo') : ''}${l('')}</svg>`;
  }

  function create(host, opts) {
    opts = opts || {};
    const view = {
      el: null, style: 'clean', glow: false, anim: true, interactive: opts.interactive !== false,
      symbols: { 1: { kind: 'draw' }, 2: { kind: 'draw' } },
      vals: new Array(81).fill(0), boards: new Array(9).fill(0), legal: new Set(), turn: 1,
      timers: [], cellEls: [], sbEls: [], keyboard: false, ghost: null,
    };
    const board = el('div', 'board');
    board.setAttribute('role', 'group');
    board.setAttribute('aria-label', 'Ultimate Tic Tac Toe board: nine small boards of nine cells');
    view.el = board;

    for (let b = 0; b < 9; b++) {
      const sb = el('div', 'sb');
      sb.dataset.b = b;
      sb.setAttribute('role', 'group');
      view.sbEls.push(sb);
      for (let c = 0; c < 9; c++) {
        const cell = el('button', 'cell');
        cell.type = 'button'; cell.dataset.b = b; cell.dataset.c = c;
        cell.tabIndex = -1;
        cell.appendChild(el('span', 'slot'));
        sb.appendChild(cell);
        view.cellEls.push(cell);
      }
      board.appendChild(sb);
    }
    host.appendChild(board);

    const cellAt = (b, c) => view.cellEls[b * 9 + c];
    /* Delayed animation steps (claiming a board, the game-over finish). A new move finishes any that are
       still waiting (flush) instead of dropping them; a full redraw discards them (cancelTimers). */
    const later = (fn, ms) => {
      const job = { fn };
      job.t = setTimeout(() => { view.timers.splice(view.timers.indexOf(job), 1); fn(); }, view.anim ? ms : 0);
      view.timers.push(job);
    };
    const cancelTimers = () => { view.timers.forEach((j) => clearTimeout(j.t)); view.timers = []; };
    const flush = () => { const jobs = view.timers; view.timers = []; jobs.forEach((j) => { clearTimeout(j.t); j.fn(); }); };

    function glyph(p) { return view.symbols[p].kind === 'emoji' ? view.symbols[p].glyph : (p === 1 ? 'X' : 'O'); }

    /* glow: themes like neon add a wide, faint copy of the strokes underneath (cheaper than a CSS filter). */
    function markHTML(p, glow) {
      const s = view.symbols[p];
      if (s.kind === 'emoji') return `<span class="emo">${s.glyph}</span>`;
      const shape = SHAPES[view.style][p];
      return `<svg viewBox="0 0 100 100" aria-hidden="true">${glow && view.glow ? `<g class="halo">${shape}</g>` : ''}${shape}</svg>`;
    }

    function label(b, c) {
      const v = view.vals[b * 9 + c], bs = view.boards[b];
      const where = `Board ${b + 1}, ${POS[b]}. Cell ${POS[c]}`;
      let what = v ? `taken by ${glyph(v)}` : 'empty';
      if (!v) {
        if (bs === 1 || bs === 2) what = 'empty, board already won';
        else if (bs === 3) what = 'empty, board full';
        else if (view.legal.has(b)) what = 'empty, playable';
      }
      return `${where}: ${what}`;
    }

    function refreshLabels(b) {
      const bs = view.boards[b];
      view.sbEls[b].setAttribute('aria-label', `Board ${b + 1}, ${POS[b]}: ${bs === 1 || bs === 2 ? 'won by ' + glyph(bs) : bs === 3 ? 'drawn' : view.legal.has(b) ? 'playable' : 'open'}`);
      for (let c = 0; c < 9; c++) {
        const cell = cellAt(b, c), legal = view.legal.has(b) && !view.vals[b * 9 + c];
        cell.setAttribute('aria-label', label(b, c));
        cell.classList.toggle('legal', legal);
        cell.setAttribute('aria-disabled', legal && view.interactive ? 'false' : 'true');
      }
    }

    /* ───── marks ───── */
    function setMark(b, c, p, animate) {
      const cell = cellAt(b, c), slot = cell.firstChild;
      view.vals[b * 9 + c] = p;
      cell.classList.remove('x', 'o');
      slot.className = 'slot';
      slot.innerHTML = '';
      if (!p) return;
      cell.classList.add(p === 1 ? 'x' : 'o');
      slot.innerHTML = markHTML(p, true);
      slot.classList.add('mark', view.symbols[p].kind === 'emoji' ? 'is-emoji' : 'is-draw');
      if (animate && view.anim) {
        slot.classList.add('draw', 'pop');
        const r = el('span', 'ripple');
        cell.appendChild(r);
        r.addEventListener('animationend', () => r.remove());
      }
    }

    function claim(b, p, line, animate) {
      const sb = view.sbEls[b];
      view.boards[b] = p;
      sb.classList.remove('won', 'p1', 'p2', 'drawn', 'settled');
      sb.querySelectorAll('.claim, .wline').forEach((n) => n.remove());
      if (p === 3) {
        sb.classList.add('drawn');
        if (!animate || !view.anim) sb.classList.add('settled');
        sb.appendChild(el('div', 'claim', '<span class="eq" aria-hidden="true">=</span>'));
        return;
      }
      sb.classList.add('won', 'p' + p);
      if (!animate || !view.anim) sb.classList.add('settled');
      if (line) sb.insertAdjacentHTML('beforeend', lineSVG(line, 'wline', view.glow));
      sb.appendChild(el('div', 'claim', markHTML(p, true)));
    }

    function clearOverlays() {
      view.sbEls.forEach((sb) => {
        sb.classList.remove('won', 'p1', 'p2', 'drawn', 'settled', 'flash', 'inline');
        sb.querySelectorAll('.claim, .wline').forEach((n) => n.remove());
      });
      board.querySelectorAll('.mline, .shrug').forEach((n) => n.remove());
      board.classList.remove('victory', 'draw', 'over');
      board.removeAttribute('data-winner');
    }

    /* ───── whole-board drawing (no animation) ───── */
    function render(state) {
      cancelTimers();
      clearOverlays();
      view.boards = state.boards.slice();
      for (let b = 0; b < 9; b++) for (let c = 0; c < 9; c++) setMark(b, c, state.cells[b * 9 + c], false);
      for (let b = 0; b < 9; b++) {
        const v = state.boards[b];
        if (v === 1 || v === 2) claim(b, v, R.boardLine(state.cells, b), false);
        else if (v === 3) claim(b, 3, null, false);
      }
      setLast(null); setHint(null);
      view.legal = new Set(R.legalBoards(state));
      view.turn = state.turn;
      if (state.winner) finish(state, false);
      applyLegal();
    }

    function applyLegal() {
      view.sbEls.forEach((sb, b) => {
        sb.classList.toggle('legal', view.legal.has(b));
        refreshLabels(b);
      });
      board.classList.toggle('has-legal', view.legal.size > 0);
    }

    function setLegal(list, turn) {
      view.legal = new Set(list);
      if (turn) view.turn = turn;
      applyLegal();
    }

    function finish(state, animate) {
      board.classList.add('over');
      if (state.winner === 3) {
        board.classList.add('draw');
        if (animate) board.appendChild(el('div', 'shrug', '<span aria-hidden="true">🤷</span>'));
      } else {
        board.classList.add('victory');
        board.dataset.winner = state.winner;
        board.insertAdjacentHTML('beforeend', lineSVG(state.line, 'mline', view.glow));
        state.line.forEach((b) => view.sbEls[b].classList.add('inline'));
        if (!animate || !view.anim) board.classList.add('settled');
      }
    }

    /* ───── a move just happened (state is already updated by the controller) ───── */
    function place(b, c, p, state, events, cb) {
      cb = cb || {};
      flush();
      setMark(b, c, p, true);
      setLast(b, c);
      setHint(null);
      view.turn = state.turn;
      const drawMs = view.anim ? 380 : 0;
      if (events.boardWon) {
        later(() => { claim(b, events.boardWon.p, events.boardWon.line, true); refreshLabels(b); cb.onBoardWon && cb.onBoardWon(b, events.boardWon.p); }, drawMs);
      } else if (events.boardDrawn) {
        later(() => { claim(b, 3, null, true); refreshLabels(b); cb.onBoardDrawn && cb.onBoardDrawn(b); }, drawMs);
      }
      if (state.winner) {
        later(() => { finish(state, true); cb.onGameOver && cb.onGameOver(state); }, drawMs + (events.gameWon ? 650 : 450));
        setLegal([], state.turn);
      } else {
        view.legal = new Set(R.legalBoards(state));
        applyLegal();
      }
    }

    /* ───── small cues ───── */
    function setLast(b, c) {
      board.querySelectorAll('.cell.last').forEach((n) => n.classList.remove('last'));
      if (b != null) cellAt(b, c).classList.add('last');
    }

    function setHint(b, c) {
      board.querySelectorAll('.cell.hint').forEach((n) => n.classList.remove('hint'));
      if (b != null) cellAt(b, c).classList.add('hint');
    }

    function shake(b, c) {
      const cell = cellAt(b, c);
      cell.classList.remove('shake');
      void cell.offsetWidth;                          // restart the animation
      if (view.anim) cell.classList.add('shake');
    }

    function flash(list) {
      list.forEach((b) => {
        const sb = view.sbEls[b];
        sb.classList.remove('flash');
        void sb.offsetWidth;
        if (view.anim) sb.classList.add('flash');
      });
    }

    /* ───── hover ghost: a faint preview of your mark on a cell you may play ───── */
    function showGhost(cell) {
      if (view.ghost && view.ghost.parentNode === cell) return;
      hideGhost();
      if (!view.interactive || !view.ghostOn || cell.getAttribute('aria-disabled') === 'true') return;
      const g = el('span', 'preview mark ' + (view.symbols[view.turn].kind === 'emoji' ? 'is-emoji' : 'is-draw') + (view.turn === 1 ? ' gx' : ' go'), markHTML(view.turn, false));
      cell.appendChild(g);
      view.ghost = g;
    }
    function hideGhost() { if (view.ghost) { view.ghost.remove(); view.ghost = null; } }
    view.ghostOn = true;

    board.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      const cell = e.target.closest('.cell');
      if (cell) showGhost(cell);
    });
    board.addEventListener('pointerleave', hideGhost);
    board.addEventListener('focusin', (e) => {
      const cell = e.target.closest('.cell');
      if (cell && e.target.matches(':focus-visible')) showGhost(cell); else hideGhost();
    });
    board.addEventListener('focusout', hideGhost);

    board.addEventListener('click', (e) => {
      const cell = e.target.closest('.cell');
      if (!cell || !view.interactive) return;
      hideGhost();
      view.keyboard = e.detail === 0;                 // Enter/Space on a button gives detail 0
      opts.onCell && opts.onCell(+cell.dataset.b, +cell.dataset.c);
    });

    /* ───── keyboard: arrows walk the 9x9 grid, Enter / Space place ───── */
    const gridPos = (b, c) => ({ r: Math.floor(b / 3) * 3 + Math.floor(c / 3), q: (b % 3) * 3 + c % 3 });
    const cellFromGrid = (r, q) => cellAt(Math.floor(r / 3) * 3 + Math.floor(q / 3), (r % 3) * 3 + q % 3);

    function setTab(cell) {
      view.cellEls.forEach((n) => { n.tabIndex = -1; });
      cell.tabIndex = 0;
    }

    board.addEventListener('keydown', (e) => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      view.keyboard = true;
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      if (!d) return;
      e.preventDefault();
      const g = gridPos(+cell.dataset.b, +cell.dataset.c);
      const r = Math.min(8, Math.max(0, g.r + d[0])), q = Math.min(8, Math.max(0, g.q + d[1]));
      const next = cellFromGrid(r, q);
      setTab(next); next.focus();
    });
    board.addEventListener('focusin', (e) => { const cell = e.target.closest('.cell'); if (cell) setTab(cell); });
    setTab(cellAt(4, 4));

    /* After a move, a keyboard player lands on the best cell of the board they must play in. */
    function focusBest() {
      if (!view.keyboard || !view.legal.size) return;
      const cands = view.cellEls.filter((n) => n.classList.contains('legal'));
      if (!cands.length) return;
      const score = (n) => (+n.dataset.c === 4 ? 0 : 1);
      cands.sort((a, b) => score(a) - score(b));
      setTab(cands[0]); cands[0].focus({ preventScroll: true });
    }

    function redrawMarks() {
      for (let i = 0; i < 81; i++) if (view.vals[i]) setMark(Math.floor(i / 9), i % 9, view.vals[i], false);
      for (let b = 0; b < 9; b++) {
        const sb = view.sbEls[b], cl = sb.querySelector('.claim');
        if (cl && (view.boards[b] === 1 || view.boards[b] === 2)) cl.innerHTML = markHTML(view.boards[b], true);
        refreshLabels(b);
      }
    }

    return Object.assign(view, {
      cell: cellAt, sb: (b) => view.sbEls[b], markHTML: (p) => markHTML(p, false),
      render, place, setLegal, setLast, setHint, shake, flash, focusBest, cancelTimers,
      setStyle(s, glow) { view.style = SHAPES[s] ? s : 'clean'; view.glow = !!glow; },
      setAnim(on) { view.anim = !!on; board.classList.toggle('no-anim', !on); },
      setInteractive(on) { view.interactive = !!on; board.classList.toggle('locked', !on); applyLegal(); if (!on) hideGhost(); },
      /* Redraw the marks with new symbols or a new drawing style, keeping everything else. */
      setSymbols(s1, s2) {
        view.symbols = { 1: s1 || { kind: 'draw' }, 2: s2 || { kind: 'draw' } };
        redrawMarks();
      },
      redrawMarks,
      rect(b, c) { return (c == null ? view.sbEls[b] : cellAt(b, c)).getBoundingClientRect(); },
      destroy() { cancelTimers(); board.remove(); },
    });

  }

  root.UTTT.Board = { create, POS };
})(window);
