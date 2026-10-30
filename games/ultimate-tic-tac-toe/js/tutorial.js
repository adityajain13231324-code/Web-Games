/* The interactive tutorial: a dimmed screen with a spotlight on the part of a demo board being explained,
   a small guide box (Back / Next / Skip) and scripted moves that play by themselves.
   The lessons themselves are in tutorial-script.js. */
(function (root) {
  'use strict';
  const U = root.UTTT, R = U.rules, S = U.tutorialScript, store = U.store, audio = U.audio, settings = U.settings;
  const $ = (id) => document.getElementById(id);
  const PAD = 8;

  let view = null, idx = 0, curPhase = 0, state = null, timers = [], onDone = null, firstSpot = true, open = false, inertEls = [];

  const later = (fn, ms) => { timers.push(setTimeout(fn, settings.animOn() ? ms : Math.min(ms, 200))); };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function union(rects) {
    const l = Math.min(...rects.map((r) => r.left)), t = Math.min(...rects.map((r) => r.top));
    const rr = Math.max(...rects.map((r) => r.right)), b = Math.max(...rects.map((r) => r.bottom));
    return { left: l, top: t, width: rr - l, height: b - t };
  }

  /* Where the spotlight should shine for a `focus` value. */
  function rectFor(f) {
    if (f === 'board') return view.el.getBoundingClientRect();
    if (f === 'legal') return union(R.legalBoards(state).map((b) => view.rect(b)));
    if (f.board != null) return view.rect(f.board);
    if (f.boards) return union(f.boards.map((b) => view.rect(b)));
    if (f.cell) return view.rect(f.cell[0], f.cell[1]);
    return view.el.getBoundingClientRect();
  }

  function spot(f) {
    const r = rectFor(f), s = $('tutSpot'), small = f.cell ? 4 : PAD;
    if (firstSpot) s.style.transition = 'none';
    s.style.left = r.left - small + 'px'; s.style.top = r.top - small + 'px';
    s.style.width = r.width + small * 2 + 'px'; s.style.height = r.height + small * 2 + 'px';
    if (firstSpot) { void s.offsetWidth; s.style.transition = ''; firstSpot = false; }
  }

  function phase(k) {
    curPhase = k;
    const step = S.STEPS[idx];
    $('tutText').textContent = S.at(step.text, k);
    spot(S.at(step.focus, k));
  }

  function show(i) {
    idx = i;
    clearTimers();
    const step = S.STEPS[i];
    state = S.build(step.setup);
    const theme = U.themes.byId(settings.data.theme);
    view.setStyle(theme.style, theme.glow);
    const [a, b] = settings.symbolPair();
    view.setSymbols(a, b);
    view.setAnim(settings.animOn());
    view.render(state);
    $('tutStep').textContent = `Step ${i + 1} of ${S.STEPS.length}`;
    $('tutTitle').textContent = step.title;
    $('tutBack').disabled = i === 0;
    $('tutNext').textContent = i === S.STEPS.length - 1 ? 'Let’s play!' : 'Next';
    $('tutReplay').hidden = !step.moves.length;
    document.querySelectorAll('#tutDots i').forEach((d, k) => d.classList.toggle('on', k === i));
    phase(0);
    step.moves.forEach(([mb, mc], k) => later(() => playMove(mb, mc, k), 1300 + k * 1700));
  }

  function playMove(b, c, k) {
    const p = state.turn;
    const res = R.play(state, b, c);
    state = res.state;
    audio.play('place', p);
    view.place(b, c, p, state, res.events, {
      onBoardWon: (bb, pp) => audio.play('boardWin', pp),
      onGameOver: () => { audio.play('gameWin'); const r = view.el.getBoundingClientRect(); U.fx.burst(r.left + r.width / 2, r.top + r.height / 2, [getComputedStyle(document.documentElement).getPropertyValue('--x').trim(), getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()], 50, { power: 380 }); },
    });
    later(() => phase(k + 1), 500);
  }

  function close(kind) {
    if (!open) return;
    open = false;
    clearTimers();
    store.set('tutorial', kind);
    $('tut').hidden = true;
    inertEls.forEach((e) => { e.inert = false; });
    root.removeEventListener('keydown', onKey, true);
    root.removeEventListener('resize', onResize);
    audio.play('click');
    if (onDone) onDone(kind);
  }

  function go(d) {
    audio.play('click');
    const n = idx + d;
    if (n >= S.STEPS.length) { close('done'); return; }
    if (n >= 0) show(n);
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close('skipped'); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  }
  const onResize = () => { if (open) phase(curPhase); };

  function start(done) {
    onDone = done;
    open = true;
    firstSpot = true;
    const tut = $('tut');
    if (!view) {
      view = U.Board.create($('tutBoard'), { interactive: false });
      $('tutDots').innerHTML = S.STEPS.map(() => '<i></i>').join('');
      $('tutNext').addEventListener('click', () => go(1));
      $('tutBack').addEventListener('click', () => go(-1));
      $('tutSkip').addEventListener('click', () => close('skipped'));
      $('tutReplay').addEventListener('click', () => { audio.play('click'); show(idx); });
    }
    inertEls = ['menu', 'game'].map($).filter(Boolean);
    inertEls.forEach((e) => { e.inert = true; });
    root.addEventListener('keydown', onKey, true);
    root.addEventListener('resize', onResize);
    tut.hidden = false;
    show(0);
    $('tutNext').focus({ preventScroll: true });
  }

  U.Tutorial = {
    start,
    get seen() { return !!store.get('tutorial', null); },
  };
})(window);
