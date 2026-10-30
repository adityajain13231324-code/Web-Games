/* The game controller: owns the state of one match and connects the rules, the computer player,
   the board view, sound and effects. It knows nothing about menus or dialogs (see app.js).

   Seats: seat 0 is the left player card, seat 1 the right one. Which seat plays X (moves first)
   is cfg.xSeat; a rematch swaps it so both sides get to start. */
(function (root) {
  'use strict';
  const U = root.UTTT, R = U.rules, store = U.store, audio = U.audio, fx = U.fx, settings = U.settings;
  const $ = (id) => document.getElementById(id);
  const POS = U.Board.POS;
  const HINTS = 3;
  const THINK_MS = { easy: 550, medium: 850, hard: 1100 };

  const els = {};
  let cfg = null, state = null, view = null;
  let redoStack = [], over = false, paused = false, thinking = false, token = 0;
  let hintsLeft = HINTS, startedAt = 0, deficit = 0, replay = null;
  let timerAnim = null, timerIv = 0, lastTickSec = -1;

  /* ───────── the computer player: a Web Worker, with a main-thread fallback (e.g. opened from a file) ───────── */
  const AIC = (function () {
    let worker = null, failed = false, seq = 0;
    const pending = new Map();
    function fallback(p) { p.resolve(U.ai.choose(p.state, p.level, { timeMs: 250 })); }
    function ensure() {
      if (worker || failed) return;
      try {
        worker = new Worker('js/ai-worker.js');
        worker.onmessage = (e) => { const p = pending.get(e.data.id); if (p) { pending.delete(e.data.id); p.resolve(e.data.move); } };
        worker.onerror = () => { failed = true; worker = null; pending.forEach(fallback); pending.clear(); };
      } catch (e) { failed = true; worker = null; }
    }
    return {
      ask(s, level, ms) {
        ensure();
        return new Promise((resolve) => {
          if (!worker) { setTimeout(() => fallback({ resolve, state: s, level }), 20); return; }
          const id = ++seq;
          pending.set(id, { resolve, state: s, level });
          worker.postMessage({ id, state: s, level, opts: { timeMs: ms || 900 } });
        });
      },
    };
  })();

  /* ───────── helpers ───────── */
  const seatOf = (p) => ((p === 1) === (cfg.xSeat === 0) ? 0 : 1);
  const playerOf = (seat) => (seat === cfg.xSeat ? 1 : 2);
  const kindOf = (seat) => cfg.seats[seat];
  const turnKind = () => kindOf(seatOf(state.turn));
  const nameOf = (seat) => cfg.names[seat];
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const colorOf = (p) => cssVar(p === 1 ? '--x' : '--o');
  const animOn = () => settings.animOn();
  const lastMove = () => { for (let i = state.moves.length - 1; i >= 0; i--) if (state.moves[i].b >= 0) return state.moves[i]; return null; };

  function toast(msg, kind) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'on' + (kind ? ' ' + kind : '');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.className = ''; }, 2200);
  }
  function announce(msg) { const l = $('live'); l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 30); }
  const scoreKey = () => cfg.mode;
  function score() { const all = store.get('score', {}); return all[scoreKey()] || { w: [0, 0], d: 0 }; }
  function saveScore(s) { const all = store.get('score', {}); all[scoreKey()] = Object.assign({ sig: cfg.sig }, s); store.set('score', all); }

  function applySymbols() {
    const [a, b] = settings.symbolPair();
    view.setSymbols(a, b);
    if (cfg) { updateHUD(); renderHistory(); }
  }
  function applyThemeStyle() { const t = U.themes.byId(settings.data.theme); view.setStyle(t.style, t.glow); applySymbols(); }

  /* ───────── starting and leaving ───────── */
  function ensureView() {
    if (view) return;
    for (const id of ['game', 'stage', 'players', 'pc0', 'pc1', 'timer', 'status', 'modeTitle', 'modeSub', 'btnUndo', 'btnRedo', 'btnHint', 'history', 'hist', 'rpPlay', 'rpRange']) els[id] = $(id);
    view = U.Board.create(els.stage, { onCell });
    settings.onChange((k) => {
      if (!view) return;
      if (k === 'theme') applyThemeStyle();
      if (k === 'symbols' || k === 'custom') applySymbols();
      if (k === 'anim') view.setAnim(animOn());
    });
    view.setAnim(animOn());
    applyThemeStyle();
  }

  function start(config) {
    ensureView();
    stopAll();
    cfg = config;
    cfg.seats = cfg.mode === 'local' ? ['human', 'human'] : cfg.mode === 'ai' ? ['human', 'ai'] : ['human', 'remote'];
    const all = store.get('score', {});
    if (!all[cfg.mode] || all[cfg.mode].sig !== cfg.sig) { all[cfg.mode] = { w: [0, 0], d: 0, sig: cfg.sig }; store.set('score', all); } // a new pairing starts a new scoreboard
    state = R.newGame();
    lastStatus = '';
    redoStack = []; over = false; paused = false; hintsLeft = HINTS; deficit = 0; startedAt = Date.now();
    els.game.classList.remove('replaying');
    view.setInteractive(true);
    view.render(state);
    view.ghostOn = true;
    renderHistory();
    updateHUD();
    announce(`New game. ${nameOf(cfg.xSeat)} plays X and starts.`);
    next();
  }

  /* Cancel timers, thinking and replay: used before a new game and when leaving to the menu. */
  function stopAll() {
    token++;
    thinking = false;
    clearTimer();
    stopReplayTimer();
    if (view) view.cancelTimers();
    document.querySelectorAll('.pcard').forEach((n) => n.classList.remove('thinking'));
  }
  function leave() { stopAll(); replay = null; over = true; if (els.game) els.game.classList.remove('replaying'); setHistory(false); }

  /* Whatever should happen now that it's someone's turn. */
  function next() {
    if (over || paused || replay) return;
    const kind = turnKind();
    if (kind === 'ai') think();
    else startTimer(kind);
  }

  /* ───────── input ───────── */
  function onCell(b, c) {
    if (over || replay || paused) return;
    if (turnKind() !== 'human') {
      illegal(b, c, { reason: turnKind() === 'ai' ? `${nameOf(seatOf(state.turn))} is thinking…` : `Waiting for ${nameOf(seatOf(state.turn))}`, boards: [] });
      return;
    }
    const r = R.check(state, b, c);
    if (!r.ok) { illegal(b, c, r); return; }
    commit(b, c, true);
  }

  function illegal(b, c, r) {
    audio.play('illegal');
    view.shake(b, c);
    toast(r.reason, 'bad');
    if (r.boards && r.boards.length) view.flash(r.boards);
    announce(r.reason);
  }

  /* ───────── making moves ───────── */
  function commit(b, c, local) {
    clearTimer();
    clearHint();
    const mover = state.turn;
    const res = R.play(state, b, c);
    state = res.state;
    redoStack = [];
    if (cfg.mode === 'online' && local) cfg.send({ t: 'move', b, c, n: state.moves.length - 1 });
    const counts = R.counts(state), me = playerOf(0);
    deficit = Math.max(deficit, counts[R.other(me)] - counts[me]);
    audio.play('place', mover);
    view.place(b, c, mover, state, res.events, {
      onBoardWon: (bb, p) => {
        audio.play('boardWin', p);
        const r = view.rect(bb);
        fx.burst(r.left + r.width / 2, r.top + r.height / 2, [colorOf(p), cssVar('--accent')], 30);
      },
      onBoardDrawn: () => audio.play('draw'),
      onGameOver: () => gameOver(),
    });
    addHistoryRow(state.moves.length - 1);
    updateHUD();
    announce(`${nameOf(seatOf(mover))} played board ${b + 1}, cell ${c + 1}.${state.winner ? '' : ' ' + describeNext()}`);
    if (!state.winner) { next(); if (view.keyboard) setTimeout(() => view.focusBest(), 0); }
  }

  function doPass(local) {
    clearTimer();
    state = R.pass(state);
    redoStack = [];
    if (cfg.mode === 'online' && local) cfg.send({ t: 'pass', n: state.moves.length - 1 });
    view.setLegal(R.legalBoards(state), state.turn);
    view.setLast(null);
    audio.play('illegal');
    addHistoryRow(state.moves.length - 1);
    updateHUD();
    next();
  }

  /* ───────── the computer's turn ───────── */
  function think() {
    const tok = ++token, level = cfg.level, t0 = Date.now();
    thinking = true;
    updateHUD();
    AIC.ask(R.clone(state), level, 1000).then((m) => {
      const wait = Math.max(0, THINK_MS[level] - (Date.now() - t0));
      setTimeout(() => {
        if (tok !== token || over || paused || replay) return;
        thinking = false;
        commit(m.b, m.c, false);
      }, animOn() ? wait : Math.min(wait, 150));
    });
  }

  /* ───────── the per-move timer ───────── */
  function startTimer(kind) {
    clearTimer();
    if (!cfg.timer || over || paused || replay || kind === 'ai') { els.timer.classList.remove('on'); return; }
    const fill = els.timer.firstElementChild, ms = cfg.timer * 1000;
    els.timer.classList.add('on'); els.timer.classList.remove('low');
    timerAnim = fill.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ms, fill: 'forwards', easing: 'linear' });
    const anim = timerAnim;
    anim.onfinish = () => { if (anim === timerAnim && kind === 'human') timeout(); };
    lastTickSec = -1;
    timerIv = setInterval(() => {
      if (!timerAnim || paused) return;
      const left = Math.ceil((ms - timerAnim.currentTime) / 1000);
      els.timer.classList.toggle('low', left <= 5);
      if (left <= 5 && left !== lastTickSec && left > 0 && kind === 'human') { lastTickSec = left; audio.play('tick'); }
    }, 200);
  }
  function clearTimer() {
    clearInterval(timerIv);
    if (timerAnim) { timerAnim.onfinish = null; timerAnim.cancel(); timerAnim = null; }
    if (els.timer) els.timer.classList.remove('on', 'low');
  }
  function timeout() {
    if (over || paused) return;
    if (cfg.timeout === 'random') {
      const moves = R.legalMoves(state), m = moves[Math.floor(Math.random() * moves.length)];
      toast("Time's up! A random move was played.");
      commit(m.b, m.c, true);
    } else {
      toast("Time's up! Turn skipped; your opponent plays anywhere.");
      doPass(true);
    }
  }

  /* ───────── undo / redo / hint ───────── */
  function undoCount() {
    if (cfg.mode === 'online' || over || replay || !state.moves.length) return 0;
    if (cfg.mode === 'local') return 1;
    const n = state.moves.length;
    for (let k = 1; k <= n; k++) if (kindOf(seatOf(state.moves[n - k].p)) === 'human') return k; // back to the human's turn
    return 0;
  }
  const canRedo = () => cfg.mode !== 'online' && !over && !replay && redoStack.length > 0;
  const canHint = () => cfg.mode !== 'online' && !over && !replay && !paused && turnKind() === 'human' && hintsLeft > 0;

  function jumpTo(moves, soundName) {
    stopAll();
    state = R.fromMoves(moves);
    view.render(state);
    const lm = lastMove();
    if (lm) view.setLast(lm.b, lm.c);
    renderHistory(); updateHUD();
    if (soundName) audio.play(soundName);
    next();
  }
  function undo() {
    const k = undoCount();
    if (!k) return;
    redoStack.push(state.moves.slice(-k));
    jumpTo(state.moves.slice(0, -k), 'undo');
  }
  function redo() {
    if (!canRedo()) return;
    const group = redoStack.pop();
    jumpTo(state.moves.concat(group), 'place');
  }
  function clearHint() { if (view) view.setHint(null); }
  function hint() {
    if (!canHint()) { if (hintsLeft <= 0) toast('No hints left this game'); return; }
    hintsLeft--;
    updateHUD();
    toast('Thinking of a good move…');
    const tok = token;
    AIC.ask(R.clone(state), 'hard', 700).then((m) => {
      if (tok !== token || over) return;
      view.setHint(m.b, m.c);
      audio.play('hint');
      toast(`Try board ${m.b + 1}, cell ${m.c + 1}`);
    });
  }

  /* ───────── pause / restart ───────── */
  function pause() {
    if (cfg.mode === 'online' || paused || over) return;
    paused = true; token++; thinking = false;
    if (timerAnim) timerAnim.pause();
    updateHUD();
  }
  function resume() {
    if (!paused) return;
    paused = false;
    updateHUD();
    if (timerAnim) timerAnim.play(); else next();
  }
  function restart() { start(Object.assign({}, cfg)); }
  function rematch() { start(Object.assign({}, cfg, { xSeat: 1 - cfg.xSeat })); }

  /* ───────── the end of a game ───────── */
  function gameOver() {
    over = true; thinking = false; clearTimer();
    updateHUD();
    const w = state.winner, sc = score();
    let winnerSeat = -1;
    if (w === R.DRAW) { sc.d++; audio.play('draw'); announce('The game is a draw.'); }
    else {
      winnerSeat = seatOf(w);
      sc.w[winnerSeat]++;
      audio.play('gameWin');
      fx.celebrate([colorOf(w), colorOf(w), cssVar('--accent'), colorOf(R.other(w))]);
      if (animOn()) { els.stage.classList.remove('quake'); void els.stage.offsetWidth; els.stage.classList.add('quake'); }
      announce(`${nameOf(winnerSeat)} wins the game.`);
    }
    saveScore(sc);
    const counts = R.counts(state), me = playerOf(0);
    const one = cfg.mode !== 'local';
    const earned = U.stats.record({
      mode: cfg.mode, level: cfg.level, moves: state.moves.filter((m) => m.b >= 0).length, deficit,
      result: w === R.DRAW ? 'draw' : !one ? 'played' : winnerSeat === 0 ? 'win' : 'loss',
      mine: counts[me], theirs: counts[R.other(me)],
    });
    setTimeout(() => {
      if (!over || replay) return;
      if (cfg.onOver) cfg.onOver({ winnerSeat, draw: w === R.DRAW, score: sc, achievements: earned, moves: state.moves.length, seconds: Math.round((Date.now() - startedAt) / 1000) });
    }, animOn() ? (w === R.DRAW ? 1700 : 1900) : 300);
  }

  /* ───────── the HUD ───────── */
  function describeNext() {
    const legal = R.legalBoards(state);
    if (state.next >= 0 && legal.length === 1) return `Play in board ${legal[0] + 1}, the ${POS[legal[0]]} one.`;
    return 'Free move: play in any glowing board.';
  }

  function updateHUD() {
    if (!view) return;
    const [s0, s1] = settings.symbolPair();
    const sc = score();
    const sym = [s0, s1];
    for (let seat = 0; seat < 2; seat++) {
      const p = playerOf(seat), card = els['pc' + seat];
      const kind = kindOf(seat);
      card.className = 'pcard ' + (p === 1 ? 'is-x' : 'is-o') + (thinking && seatOf(state.turn) === seat && kind === 'ai' ? ' thinking' : '');
      card.querySelector('.pmark').innerHTML = view.markHTML(p);
      card.querySelector('.pname').textContent = nameOf(seat);
      card.querySelector('.pscore').textContent = sc.w[seat];
      const glyph = sym[p - 1].kind === 'emoji' ? sym[p - 1].glyph : p === 1 ? 'X' : 'O';
      card.querySelector('.psub').textContent = kind === 'ai' ? `Computer · ${cap(cfg.level)}` : kind === 'remote' ? `Friend · ${glyph}` : cfg.mode === 'ai' ? `You · ${glyph}` : `Plays ${glyph}`;
      card.querySelector('.think .hmm').hidden = cfg.level !== 'hard';
    }
    els.players.dataset.seat = String(seatOf(state.turn));
    els.players.dataset.active = over || paused ? '0' : String(state.turn);
    els.modeTitle.textContent = cfg.mode === 'local' ? 'Local 2-Player' : cfg.mode === 'ai' ? 'Vs Computer' : 'Online';
    els.modeSub.textContent = (cfg.mode === 'ai' ? cap(cfg.level) + ' · ' : '') + `Draws ${sc.d}` + (cfg.timer ? ` · ${cfg.timer}s timer` : '');
    setStatus();
    els.btnUndo.setAttribute('aria-disabled', String(!undoCount()));
    els.btnRedo.setAttribute('aria-disabled', String(!canRedo()));
    els.btnHint.setAttribute('aria-disabled', String(!canHint()));
    els.btnHint.querySelector('.badge').textContent = String(hintsLeft);
    $('btnRestart').hidden = cfg.mode === 'online';
    document.body.dataset.mode = cfg.mode;
  }
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  let lastStatus = '';
  function setStatus() {
    let main, sub = '';
    const seat = seatOf(state.turn), name = nameOf(seat), kind = kindOf(seat);
    if (over) {
      main = state.winner === R.DRAW ? "It's a draw" : `${nameOf(seatOf(state.winner))} wins!`;
    } else if (paused) {
      main = 'Paused';
    } else if (kind === 'ai') {
      main = `${name} is thinking…`;
    } else if (kind === 'remote') {
      main = `${name}'s turn`; sub = 'Waiting for your friend';
    } else {
      main = cfg.mode === 'local' ? `${name}'s turn` : 'Your turn';
      sub = describeNext();
    }
    const html = `<span class="dot"></span><span><b>${esc(main)}</b>${sub ? '<br><small>' + esc(sub) + '</small>' : ''}</span>`;
    const stamp = main + '|' + sub + '|' + state.turn;
    if (stamp === lastStatus) return;
    lastStatus = stamp;
    els.status.innerHTML = html;
    els.status.style.setProperty('--pc', state.turn === 1 ? 'var(--x)' : 'var(--o)');
    if (animOn()) els.status.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'ease-out' });
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ───────── move history ───────── */
  function rowHTML(i, m) {
    if (m.b < 0) return `<li data-i="${i + 1}"><span class="n">${i + 1}</span><span class="${m.p === 1 ? 'xm' : 'om'}">${esc(glyphOf(m.p))}</span><span>Skipped (time ran out)</span></li>`;
    return `<li data-i="${i + 1}"><span class="n">${i + 1}</span><span class="${m.p === 1 ? 'xm' : 'om'}">${esc(glyphOf(m.p))}</span><span>Board ${m.b + 1} · cell ${m.c + 1}</span></li>`;
  }
  function glyphOf(p) { const s = settings.symbolPair()[p - 1]; return s.kind === 'emoji' ? s.glyph : p === 1 ? 'X' : 'O'; }
  function renderHistory() {
    els.hist.innerHTML = state.moves.length ? state.moves.map((m, i) => rowHTML(i, m)).join('') : '<li class="empty">No moves yet.</li>';
    markCurrentRow(state.moves.length);
  }
  function addHistoryRow(i) {
    if (!i) els.hist.innerHTML = '';
    els.hist.insertAdjacentHTML('beforeend', rowHTML(i, state.moves[i]));
    markCurrentRow(i + 1);
  }
  function markCurrentRow(n) {
    els.hist.querySelectorAll('li.cur').forEach((li) => li.classList.remove('cur'));
    const li = els.hist.querySelector(`li[data-i="${n}"]`);
    if (li) { li.classList.add('cur'); li.scrollIntoView({ block: 'nearest' }); }
  }
  function setHistory(open) { if (els.history) els.history.classList.toggle('open', open); }

  /* ───────── replay of a finished game ───────── */
  function startReplay() {
    if (!over) return;
    stopAll();
    replay = { moves: state.moves.slice(), i: 0, iv: 0 };
    els.game.classList.add('replaying');
    view.setInteractive(false);
    els.rpRange.max = String(replay.moves.length);
    replayTo(0);
    playReplay(true);
  }
  function replayTo(i, animate) {
    const r = replay;
    if (!r) return;
    i = Math.max(0, Math.min(r.moves.length, i));
    if (animate && i === r.i + 1) {
      const before = R.fromMoves(r.moves.slice(0, i - 1)), m = r.moves[i - 1];
      if (m.b < 0) { view.render(R.fromMoves(r.moves.slice(0, i))); }
      else {
        const res = R.play(before, m.b, m.c);
        audio.play('place', m.p);
        view.place(m.b, m.c, m.p, res.state, res.events, { onBoardWon: (b, p) => audio.play('boardWin', p) });
      }
    } else {
      view.render(R.fromMoves(r.moves.slice(0, i)));
      const last = r.moves.slice(0, i).reverse().find((m) => m.b >= 0);
      if (last) view.setLast(last.b, last.c);
    }
    r.i = i;
    els.rpRange.value = String(i);
    markCurrentRow(i);
    if (i >= r.moves.length) playReplay(false);
  }
  function playReplay(on) {
    if (!replay) return;
    clearInterval(replay.iv);
    replay.iv = 0;
    els.rpPlay.textContent = on ? '⏸' : '▶';
    els.rpPlay.setAttribute('aria-label', on ? 'Pause replay' : 'Play replay');
    if (on) {
      if (replay.i >= replay.moves.length) replayTo(0);
      replay.iv = setInterval(() => replayTo(replay.i + 1, true), animOn() ? 850 : 500);
    }
  }
  function stopReplayTimer() { if (replay) clearInterval(replay.iv); }
  function stopReplay() {
    if (!replay) return;
    stopReplayTimer();
    replay = null;
    els.game.classList.remove('replaying');
    view.setInteractive(true);
    view.render(state);
    const lm = lastMove();
    if (lm) view.setLast(lm.b, lm.c);
    renderHistory(); updateHUD();
    if (cfg.onReplayEnd) cfg.onReplayEnd();
  }

  /* ───────── messages from the other player (online) ───────── */
  function applyRemote(msg) {
    if (!cfg || cfg.mode !== 'online' || over || replay) return;
    if (msg.t === 'move' && msg.n === state.moves.length && turnKind() === 'remote' && R.check(state, msg.b, msg.c).ok) commit(msg.b, msg.c, false);
    else if (msg.t === 'pass' && msg.n === state.moves.length && turnKind() === 'remote') doPass(false);
    else if (msg.t === 'move' || msg.t === 'pass') cfg.send({ t: 'resync' });
  }
  function loadMoves(moves) {
    if (!cfg || over || replay) return;
    try { jumpTo(moves); } catch (e) { toast('Could not sync the game'); }
  }

  U.Game = {
    start, restart, rematch, pause, resume, undo, redo, hint, leave, startReplay, stopReplay, applyRemote, loadMoves,
    toast, setHistory,
    replayControls: { play: () => playReplay(!(replay && replay.iv)), step: (d) => { playReplay(false); replayTo((replay ? replay.i : 0) + d, d === 1); }, to: (i) => { playReplay(false); replayTo(i); } },
    jumpRow(i) { if (replay) { playReplay(false); replayTo(i); } },
    get state() { return state; }, get cfg() { return cfg; }, get over() { return over; }, get paused() { return paused; }, get replaying() { return !!replay; },
    get moves() { return state ? state.moves : []; },
    score, resetScore() { if (cfg) { saveScore({ w: [0, 0], d: 0 }); updateHUD(); } },
    get active() { return !!view && !!cfg && els.game.classList.contains('on'); },
  };
})(window);
