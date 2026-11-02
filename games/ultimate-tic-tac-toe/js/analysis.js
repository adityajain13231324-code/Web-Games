/* The analysis board: play moves for both sides (or load a finished game), watch the evaluation bar,
   see the engine's best lines, and review a whole game move by move.
   The search runs in engine-worker.js (or on the main thread if workers are unavailable).

   Evaluations are kept for X's side as a score; the bar and the graph show the chance that X wins. */
(function (root) {
  'use strict';
  const U = root.UTTT, R = U.rules, E = U.engine, settings = U.settings, audio = U.audio, store = U.store;
  const $ = (id) => document.getElementById(id);
  const POS = U.Board.POS;

  const LIVE = { timeMs: 6000, maxDepth: 20, multiPV: 3 };      // the position you are looking at
  const REVIEW = { timeMs: 280, maxDepth: 12, multiPV: 1 };     // every position of a game
  const LABEL = { best: 'Best', good: 'Good', inacc: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder' };
  const MARK = { best: '★', good: '✓', inacc: '?!', mistake: '?', blunder: '??' };
  const ORDER = ['best', 'good', 'inacc', 'mistake', 'blunder'];

  let view = null, moves = [], states = [R.newGame()], evals = [], cursor = 0;
  let engineOn = store.get('analysisEngine', true), reviewing = false, progress = 0, paintQueued = false;
  const els = {};

  /* ───────── the engine, in a worker (with a main-thread fallback, e.g. from file://) ───────── */
  let workersFailed = false, fallbackSearcher = null;
  function makeClient() {
    let worker = null, busy = false, id = 0, handler = null;
    function spawn() {
      if (worker || workersFailed) return;
      try {
        worker = new Worker('js/engine-worker.js');
        worker.onmessage = (e) => { if (e.data.id !== id) return; if (e.data.type === 'done') busy = false; if (handler) handler(e.data); };
        worker.onerror = () => { workersFailed = true; worker = null; };
      } catch (err) { workersFailed = true; worker = null; }
    }
    function fallback(msg, my, cb) {
      fallbackSearcher = fallbackSearcher || E.createSearcher();
      const opts = Object.assign({}, msg.opts, { timeMs: Math.min(msg.opts.timeMs, 350), maxDepth: Math.min(msg.opts.maxDepth, 9) });
      if (msg.cmd === 'analyze') {
        setTimeout(() => {
          if (my !== id) return;
          fallbackSearcher.analyze(msg.state, opts, (info) => cb({ id: my, type: 'info', info }));
          cb({ id: my, type: 'done' });
        }, 30);
        return;
      }
      let i = 0, s = R.newGame();
      const step = () => {
        if (my !== id) return;
        if (i > msg.moves.length) { cb({ id: my, type: 'done' }); return; }
        if (i > 0) { const m = msg.moves[i - 1]; s = m.b < 0 ? R.pass(s) : R.play(s, m.b, m.c).state; }
        cb({ id: my, type: 'position', i, info: fallbackSearcher.analyze(s, opts) });
        i++;
        setTimeout(step, 0);
      };
      setTimeout(step, 30);
    }
    return {
      run(msg, cb) {
        this.cancel();
        id++; handler = cb; busy = true;
        spawn();
        if (worker) worker.postMessage(Object.assign({ id }, msg));
        else fallback(msg, id, cb);
      },
      cancel() {
        if (worker && busy) { worker.terminate(); worker = null; }   // the only way to stop a running search
        busy = false; handler = null; id++;
      },
    };
  }
  const live = makeClient(), review = makeClient();

  /* ───────── numbers ───────── */
  const toX = (info, score) => (info.turn === 1 ? score : -score);
  const glyph = (p) => { const s = settings.symbolPair()[p - 1]; return s.kind === 'emoji' ? s.glyph : p === 1 ? 'X' : 'O'; };
  const pct = (e) => (e ? E.winProb(e.x) : 0.5);
  const isMate = (x) => Math.abs(x) > E.MATE;

  function wordFor(e) {
    if (!e) return 'Not analysed yet';
    if (isMate(e.x)) return e.x > 0 ? `${glyph(1)} wins` : `${glyph(2)} wins`;
    const p = e.x > 0 ? pct(e) : 1 - pct(e), who = e.x > 0 ? glyph(1) : glyph(2), d = p - 0.5;
    if (d < 0.04) return 'Equal';
    return `${who} is ${d < 0.12 ? 'slightly better' : d < 0.25 ? 'better' : 'winning'}`;
  }
  function mateText(x) {
    const n = Math.ceil((E.WIN - Math.abs(x)) / 2);
    return `${x > 0 ? glyph(1) : glyph(2)} wins in ${n}`;
  }
  const lineText = (b, c) => `${b + 1}·${c + 1}`;

  /* How good was move i (1-based)? Compares X's winning chance before and after, from the mover's side. */
  function quality(i) {
    const a = evals[i - 1], b = evals[i], m = moves[i - 1];
    if (!a || !b || !m || m.b < 0) return null;
    const side = (e) => (m.p === 1 ? pct(e) : 1 - pct(e));
    const loss = Math.max(0, side(a) - side(b));
    const topMove = a.best && a.best.b === m.b && a.best.c === m.c;
    const kind = topMove || loss < 0.015 ? 'best' : loss < 0.05 ? 'good' : loss < 0.1 ? 'inacc' : loss < 0.2 ? 'mistake' : 'blunder';
    return { kind, loss };
  }

  function accuracy(player) {
    const counts = { best: 0, good: 0, inacc: 0, mistake: 0, blunder: 0 };
    let total = 0, n = 0;
    for (let i = 1; i <= moves.length; i++) {
      if (moves[i - 1].p !== player) continue;
      const q = quality(i);
      if (!q) continue;
      counts[q.kind]++; total += q.loss * 100; n++;
    }
    if (!n) return null;
    return { n, counts, acc: Math.max(0, Math.min(100, 103.17 * Math.exp(-0.04354 * (total / n)) - 3.17)) };
  }

  /* ───────── the position ───────── */
  function applyMove(s, m) { return m.b < 0 ? R.pass(s) : R.play(s, m.b, m.c).state; }
  function ensureStates() { for (let k = states.length; k <= moves.length; k++) states[k] = applyMove(states[k - 1], moves[k - 1]); }

  function setEval(i, info) {
    if (!info) return;
    if (info.terminal) { evals[i] = { x: toX(info, info.score), depth: 0, best: null, lines: [], terminal: true }; return; }
    const l0 = info.lines[0];
    evals[i] = { x: toX(info, l0.score), depth: info.depth, nodes: info.nodes, best: { b: l0.b, c: l0.c }, lines: info.lines.map((l) => ({ b: l.b, c: l.c, x: toX(info, l.score), pv: l.pv })) };
  }

  function goTo(i, animate) {
    i = Math.max(0, Math.min(moves.length, i));
    const prev = cursor;
    cursor = i;
    ensureStates();
    const m = moves[i - 1];
    if (animate && i === prev + 1 && m.b >= 0) {
      audio.play('place', m.p);
      view.place(m.b, m.c, m.p, states[i], R.play(states[i - 1], m.b, m.c).events, { onBoardWon: (b, p) => audio.play('boardWin', p) });
    } else {
      view.render(states[i]);
      if (m && m.b >= 0) view.setLast(m.b, m.c);
    }
    paint();
    runLive();
  }

  function onCell(b, c) {
    const s = states[cursor], r = R.check(s, b, c);
    if (!r.ok) {
      audio.play('illegal');
      view.shake(b, c);
      U.Game.toast(r.reason, 'bad');
      if (r.boards && r.boards.length) view.flash(r.boards);
      return;
    }
    const next = moves[cursor];
    if (!(next && next.b === b && next.c === c)) {                  // a different move replaces the rest of the line
      moves.length = cursor; states.length = cursor + 1; evals.length = cursor + 1;
      moves.push({ p: s.turn, b, c });
    }
    goTo(cursor + 1, true);
  }

  /* ───────── live analysis of the position on the board ───────── */
  function runLive() {
    live.cancel();
    if (reviewing) return;
    const i = cursor, s = states[i];
    if (!engineOn) { els.side.classList.remove('busy'); paint(); return; }
    if (s.winner) { setEval(i, { terminal: true, turn: s.turn, score: s.winner === R.DRAW ? 0 : -E.WIN }); els.side.classList.remove('busy'); paint(); return; }
    els.meta.textContent = 'Thinking…';
    els.side.classList.add('busy');
    live.run({ cmd: 'analyze', state: s, opts: LIVE }, (msg) => {
      if (i !== cursor) return;
      if (msg.type === 'info') { setEval(i, msg.info); paint(); }
      else if (msg.type === 'done') { els.side.classList.remove('busy'); paint(); }
    });
  }

  /* ───────── review of the whole game ───────── */
  function startReview() {
    if (!moves.length || reviewing) return;
    live.cancel();
    reviewing = true; progress = 0;
    els.side.classList.remove('busy');
    review.run({ cmd: 'review', moves: moves.slice(), opts: REVIEW }, (msg) => {
      if (msg.type === 'position') { setEval(msg.i, msg.info); progress = (msg.i + 1) / (moves.length + 1); paint(); }
      else if (msg.type === 'done') { reviewing = false; progress = 1; paint(); runLive(); }
    });
    paint();
  }

  /* ───────── drawing ───────── */
  function paint() { if (!paintQueued) { paintQueued = true; requestAnimationFrame(() => { paintQueued = false; draw(); }); } }

  let shownPct = 50;
  function tween(from, to, set) {
    const t0 = performance.now(), dur = settings.animOn() ? 450 : 0;
    (function f(t) {
      const k = dur ? Math.min(1, (t - t0) / dur) : 1;
      set(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  }

  function draw() {
    const e = evals[cursor], p = pct(e), x = Math.round(p * 100);
    els.bar.style.setProperty('--p', String(p));
    els.bar.setAttribute('aria-label', e ? `Evaluation: ${glyph(1)} ${x} percent, ${glyph(2)} ${100 - x} percent. ${isMate(e.x) ? mateText(e.x) : wordFor(e)}` : 'Evaluation bar: not analysed yet');
    if (x !== shownPct) { const from = shownPct; shownPct = x; tween(from, x, (v) => { els.ebX.textContent = String(v); els.ebO.textContent = String(100 - v); els.big.textContent = v + '%'; }); }
    els.big.title = `Chance that ${glyph(1)} wins`;
    els.word.textContent = e && isMate(e.x) ? mateText(e.x) : wordFor(e);
    els.meta.textContent = reviewing ? `Reviewing… ${Math.round(progress * 100)}%` : e && e.depth ? `depth ${e.depth} · ${fmt(e.nodes)} nodes` : engineOn ? (states[cursor].winner ? 'Game over' : 'Thinking…') : 'Engine off';
    els.engine.checked = engineOn;
    els.side.classList.toggle('off', !engineOn);
    els.sub.textContent = reviewing ? 'Reviewing the game…' : engineOn ? 'Engine on' : 'Engine off';

    // the engine's best lines
    const lines = engineOn && !reviewing && e && e.lines ? e.lines : [];
    els.lines.innerHTML = lines.map((l, k) => {
      const chip = isMate(l.x) ? '#' + Math.ceil((E.WIN - Math.abs(l.x)) / 2) : Math.round(E.winProb(l.x) * 100) + '%';
      const rest = l.pv.slice(1, 5).map((m) => lineText(m.b, m.c)).join(' ');
      return `<button type="button" class="an-line" data-k="${k}"><span class="chip ${l.x >= 0 ? 'cx' : 'co'}">${chip}</span><b>Board ${l.b + 1} · cell ${l.c + 1}</b><small>${rest ? '→ ' + rest : ''}</small></button>`;
    }).join('') || `<p class="an-none">${states[cursor].winner ? 'The game is over here.' : engineOn ? 'Looking for the best moves…' : 'Turn the engine on to see the best moves.'}</p>`;
    view.setEngine(lines);

    // move quality on the board and in the list
    els.stage.querySelectorAll('.cell[data-q]').forEach((n) => n.removeAttribute('data-q'));
    const q = quality(cursor), m = moves[cursor - 1];
    if (q && m) view.cell(m.b, m.c).dataset.q = q.kind;

    drawList();
    drawGraph();
    drawAccuracy();
    els.first.disabled = els.prev.disabled = cursor === 0;
    els.next.disabled = els.last.disabled = cursor === moves.length;
    els.review.disabled = reviewing || !moves.length;
    els.review.textContent = reviewing ? `Reviewing… ${Math.round(progress * 100)}%` : moves.length && evals.slice(0, moves.length + 1).filter(Boolean).length > moves.length ? 'Review again' : 'Review game';
  }
  const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n || 0));

  function drawList() {
    const rows = moves.map((m, i) => {
      const q = quality(i + 1);
      const what = m.b < 0 ? 'Skipped (time ran out)' : `Board ${m.b + 1} · cell ${m.c + 1}`;
      return `<li data-i="${i + 1}" class="${i + 1 === cursor ? 'cur' : ''}"><span class="n">${i + 1}</span><span class="${m.p === 1 ? 'xm' : 'om'}">${glyph(m.p)}</span><span>${what}</span>${q ? `<span class="q" data-q="${q.kind}" title="${LABEL[q.kind]}">${MARK[q.kind]}</span>` : ''}</li>`;
    });
    els.hist.innerHTML = rows.join('') || '<li class="empty">Play a move on the board, or open a game from the results screen.</li>';
    const cur = els.hist.querySelector('li.cur');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  function drawGraph() {
    const n = Math.max(1, moves.length), W = 100, H = 40;
    const pts = [];
    for (let i = 0; i <= moves.length; i++) if (evals[i]) pts.push([i / n * W, (1 - pct(evals[i])) * H, i]);
    const line = pts.map((p) => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
    const area = pts.length > 1 ? `M${pts[0][0]},${H} L${pts.map((p) => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' L')} L${pts[pts.length - 1][0]},${H} Z` : '';
    const dots = pts.filter((p) => { const q = p[2] && quality(p[2]); return q && (q.kind === 'mistake' || q.kind === 'blunder'); })
      .map((p) => `<line class="gd" data-q="${quality(p[2]).kind}" x1="${p[0].toFixed(2)}" y1="${p[1].toFixed(2)}" x2="${p[0].toFixed(2)}" y2="${p[1].toFixed(2)}"/>`).join('');
    els.graph.innerHTML = `<rect class="g-o" width="${W}" height="${H}"/><path class="g-x" d="${area}"/><line class="g-mid" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"/>`
      + (pts.length > 1 ? `<polyline class="g-line" points="${line}"/>` : '') + dots
      + `<line class="g-cur" x1="${(cursor / n * W).toFixed(2)}" y1="0" x2="${(cursor / n * W).toFixed(2)}" y2="${H}"/>`;
  }

  function drawAccuracy() {
    const part = (p) => {
      const a = accuracy(p);
      if (!a) return `<div class="acc"><b>${glyph(p)}</b><span>–</span></div>`;
      const c = a.counts;
      return `<div class="acc"><b>${glyph(p)}</b><span class="accn">${a.acc.toFixed(0)}%</span><small>${ORDER.map((k) => c[k] ? `<i data-q="${k}">${MARK[k]}${c[k]}</i>` : '').join(' ')}</small></div>`;
    };
    els.acc.innerHTML = moves.length ? part(1) + part(2) : '<small>Play or load a game, then press Review.</small>';
  }

  /* ───────── wiring ───────── */
  function applyTheme() {
    const t = U.themes.byId(settings.data.theme), [a, b] = settings.symbolPair();
    view.setStyle(t.style, t.glow);
    view.setSymbols(a, b);
    view.setAnim(settings.animOn());
    if (document.getElementById('analysis').classList.contains('on')) paint();
  }

  function init() {
    if (view) return;
    ['bar:evalbar', 'ebX', 'ebO', 'big:anBig', 'word:anWord', 'meta:anMeta', 'engine:anEngine', 'lines:anLines', 'first:anFirst', 'prev:anPrev', 'next:anNext', 'last:anLast',
      'graph:anGraph', 'acc:anAcc', 'review:anReview', 'hist:anHist', 'sub:anSub', 'stage:anStage'].forEach((spec) => {
      const [k, id] = spec.includes(':') ? spec.split(':') : [spec, spec];
      els[k] = $(id);
    });
    els.side = document.querySelector('#analysis .an-side');
    view = U.Board.create(els.stage, { onCell });
    applyTheme();
    settings.onChange((k) => { if (['theme', 'symbols', 'custom', 'anim'].includes(k)) applyTheme(); });

    els.engine.addEventListener('change', () => { engineOn = els.engine.checked; store.set('analysisEngine', engineOn); audio.play('click'); runLive(); });
    els.first.addEventListener('click', () => { audio.play('click'); goTo(0); });
    els.prev.addEventListener('click', () => { audio.play('click'); goTo(cursor - 1); });
    els.next.addEventListener('click', () => { audio.play('click'); goTo(cursor + 1, true); });
    els.last.addEventListener('click', () => { audio.play('click'); goTo(moves.length); });
    els.review.addEventListener('click', () => { audio.play('click'); startReview(); });
    els.hist.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) goTo(+li.dataset.i); });
    els.lines.addEventListener('click', (e) => { const b = e.target.closest('.an-line'); if (b) { const l = evals[cursor].lines[+b.dataset.k]; onCell(l.b, l.c); } });
    els.lines.addEventListener('pointerover', (e) => {
      const b = e.target.closest('.an-line');
      els.stage.querySelectorAll('.cell.eng-on').forEach((n) => n.classList.remove('eng-on'));
      if (b && evals[cursor] && evals[cursor].lines[+b.dataset.k]) { const l = evals[cursor].lines[+b.dataset.k]; view.cell(l.b, l.c).classList.add('eng-on'); }
    });
    els.lines.addEventListener('pointerleave', () => els.stage.querySelectorAll('.cell.eng-on').forEach((n) => n.classList.remove('eng-on')));
    els.graph.addEventListener('click', (e) => { const r = els.graph.getBoundingClientRect(); goTo(Math.round((e.clientX - r.left) / r.width * Math.max(1, moves.length))); });
    root.addEventListener('keydown', (e) => {
      if (!$('analysis').classList.contains('on') || document.querySelector('dialog[open]') || /input|textarea|select/i.test(e.target.tagName)) return;
      // while the board has focus the plain arrows walk its cells, so use Alt+arrows or Page Up / Page Down there
      const onBoard = !!e.target.closest('.board'), plain = !onBoard && !e.altKey;
      const k = {
        ArrowLeft: (plain || e.altKey) && (() => goTo(cursor - 1)), ArrowRight: (plain || e.altKey) && (() => goTo(cursor + 1, true)),
        PageUp: () => goTo(cursor - 1), PageDown: () => goTo(cursor + 1, true), Home: !onBoard && (() => goTo(0)), End: !onBoard && (() => goTo(moves.length)),
      }[e.key];
      if (k) { e.preventDefault(); k(); }
    });
    root.addEventListener('beforeunload', () => { live.cancel(); review.cancel(); });
  }

  /* Open the analysis board with a list of moves (empty for a fresh board). */
  function open(opts) {
    init();
    live.cancel(); review.cancel();
    reviewing = false; progress = 0;
    moves = (opts.moves || []).map((m) => ({ p: m.p, b: m.b, c: m.c }));
    states = [R.newGame()]; evals = [];
    ensureStates();
    cursor = opts.review ? moves.length : 0;
    shownPct = 50;
    els.ebX.textContent = els.ebO.textContent = '50'; els.big.textContent = '50%';
    applyTheme();
    view.render(states[cursor]);
    const m = moves[cursor - 1];
    if (m && m.b >= 0) view.setLast(m.b, m.c);
    paint();
    if (opts.review && moves.length) startReview(); else runLive();
  }

  function close() { live.cancel(); review.cancel(); reviewing = false; }

  U.Analysis = { open, close };
})(window);
