/* The app shell: menu, dialogs, settings controls, online room flow and the tutorial's first-visit logic.
   The match itself is in game.js; the rules and the computer player are pure modules. */
(function (root) {
  'use strict';
  const U = root.UTTT, store = U.store, settings = U.settings, audio = U.audio, themes = U.themes, Game = U.Game;
  const $ = (id) => document.getElementById(id);
  const $$ = (sel, r) => Array.from((r || document).querySelectorAll(sel));
  const D = settings.data;

  settings.init();

  /* ───────── screens and dialogs ───────── */
  function show(screen) {
    $('menu').classList.toggle('on', screen === 'menu');
    $('game').classList.toggle('on', screen === 'game');
    $('analysis').classList.toggle('on', screen === 'analysis');
    document.body.dataset.screen = screen;
    if (screen === 'menu') root.scrollTo(0, 0);
  }

  function openDlg(id) { const d = $(id); if (!d.open) d.showModal(); return d; }
  /* keepPaused: this dialog hands over to another one, so the game must not resume when it closes. */
  function closeDlg(id, keepPaused) { const d = $(id); if (!d.open) return; d.dataset.keep = keepPaused ? '1' : ''; d.close(); }

  $$('dialog').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => {
      const keep = d.dataset.keep; d.dataset.keep = '';
      if (keep || !Game.active || Game.over) return;
      if (['dlgPause', 'dlgSettings'].includes(d.id) && !$('dlgPause').open && !$('dlgSettings').open) Game.resume();
    });
    $$('[data-close]', d).forEach((b) => b.addEventListener('click', () => { audio.play('click'); d.close(); }));
  });

  /* A yes/no question as a dialog; resolves true or false. */
  function ask(title, text, yes, no) {
    $('cfTitle').textContent = title; $('cfText').textContent = text;
    $('cfYes').textContent = yes || 'OK'; $('cfNo').textContent = no || 'Cancel'; $('cfNo').hidden = no === null;
    const d = $('dlgConfirm');
    return new Promise((resolve) => {
      let answer = false;
      const done = (v) => () => { answer = v; d.close(); };
      const yesH = done(true), noH = done(false);
      $('cfYes').addEventListener('click', yesH, { once: true });
      $('cfNo').addEventListener('click', noH, { once: true });
      d.addEventListener('close', () => { $('cfYes').removeEventListener('click', yesH); $('cfNo').removeEventListener('click', noH); resolve(answer); }, { once: true });
      d.showModal();
    });
  }

  /* ───────── menu: logo and theme dots ───────── */
  (function buildLogo() {
    let html = '';
    for (let b = 0; b < 9; b++) {
      html += '<i>';
      for (let c = 0; c < 9; c++) {
        const k = (b * 5 + c * 7) % 11;
        const cls = k < 2 ? 'x' : k < 4 ? 'o' : '';
        html += `<b class="${cls}" style="--d:${((b * .45 + c * .21) % 4.2).toFixed(2)}s"></b>`;
      }
      html += '</i>';
    }
    $('logo').innerHTML = html;
  })();

  function buildThemeButtons() {
    $('themeDots').innerHTML = themes.LIST.map((t) =>
      `<button type="button" class="theme-dot" data-theme="${t.id}" aria-label="${t.name} theme" title="${t.name}" aria-pressed="false" style="background:linear-gradient(135deg,${t.swatch[0]} 45%,${t.swatch[1]} 45% 70%,${t.swatch[2]} 70%)"></button>`).join('');
    $('themeGrid').innerHTML = themes.LIST.map((t) =>
      `<button type="button" class="theme-btn" data-theme="${t.id}" aria-pressed="false"><span class="sw">${t.swatch.map((c) => `<i style="background:${c}"></i>`).join('')}</span><span>${t.name}</span></button>`).join('');
    $$('[data-theme]', $('themeDots')).concat($$('[data-theme]', $('themeGrid'))).forEach((b) =>
      b.addEventListener('click', () => settings.setTheme(b.dataset.theme)));
  }
  function syncThemeButtons() {
    $$('.theme-dot, .theme-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === D.theme)));
  }

  /* ───────── settings controls (shared by the setup and settings dialogs) ───────── */
  const CONTROLS = {
    level:   { opts: [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']] },
    playAs:  { opts: [['x', 'X · first'], ['o', 'O · second'], ['random', 'Random']] },
    timer:   { opts: [[0, 'Off'], [15, '15 s'], [30, '30 s']] },
    timeout: { opts: [['random', 'Random move'], ['skip', 'Lose turn']] },
  };

  function buildControls() {
    $$('[data-ctl]').forEach((host) => {
      const key = host.dataset.ctl;
      if (key === 'symbols') { buildSymbols(host); return; }
      host.className = 'seg';
      host.setAttribute('role', 'group');
      host.innerHTML = CONTROLS[key].opts.map(([v, label]) => `<button type="button" data-v="${v}" aria-pressed="false">${label}</button>`).join('');
      host.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        audio.play('click');
        const raw = b.dataset.v;
        settings.set(key, key === 'timer' ? Number(raw) : raw);
      });
    });
  }

  function buildSymbols(host) {
    host.innerHTML = `<select aria-label="Symbols">${themes.SYMBOLS.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
      <div class="field two custom" style="margin:8px 0 0" hidden><input type="text" maxlength="4" data-i="0" aria-label="Symbol for the first player" placeholder="First"><input type="text" maxlength="4" data-i="1" aria-label="Symbol for the second player" placeholder="Second"></div>`;
    host.querySelector('select').addEventListener('change', (e) => { audio.play('click'); settings.set('symbols', e.target.value); });
    $$('.custom input', host).forEach((inp) => inp.addEventListener('input', () => {
      const c = D.custom.slice(); c[+inp.dataset.i] = inp.value; settings.set('custom', c);
    }));
  }

  function syncControls() {
    $$('[data-ctl]').forEach((host) => {
      const key = host.dataset.ctl;
      if (key === 'symbols') {
        host.querySelector('select').value = D.symbols;
        const custom = host.querySelector('.custom');
        custom.hidden = D.symbols !== 'custom';
        $$('input', custom).forEach((inp) => { if (document.activeElement !== inp) inp.value = D.custom[+inp.dataset.i] || ''; });
        return;
      }
      $$('button', host).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(D[key]))));
    });
    $$('.timeoutField').forEach((f) => { f.hidden = !D.timer; });
    $('optSound').checked = !audio.muted;
    $('optVol').value = String(Math.round(audio.volume * 100));
    $('optAnim').checked = settings.animOn();
    syncThemeButtons();
  }

  $('optSound').addEventListener('change', (e) => { audio.setMuted(!e.target.checked); audio.unlock(); audio.play('click'); });
  $('optVol').addEventListener('input', (e) => { audio.setVolume(e.target.value / 100); });
  $('optVol').addEventListener('change', () => audio.play('place', 1));
  $('optAnim').addEventListener('change', (e) => settings.set('anim', e.target.checked));
  settings.onChange(() => syncControls());

  buildThemeButtons();
  buildControls();
  syncControls();

  /* ───────── starting games ───────── */
  const cleanName = (v, fallback) => (String(v).trim().slice(0, 14) || fallback);
  let setupMode = 'local';

  function openSetup(mode) {
    setupMode = mode;
    $('setupTitle').textContent = mode === 'local' ? 'Local 2-player' : 'Vs computer';
    $('lblA').textContent = mode === 'local' ? 'Player 1 (X goes first)' : 'Your name';
    $('nameA').value = D.names[0];
    $('nameB').value = D.names[1];
    $('nameBWrap').hidden = mode !== 'local';
    $('setupNames').classList.toggle('two', mode === 'local');
    $$('#dlgSetup [data-modes]').forEach((f) => { f.hidden = !f.dataset.modes.split(' ').includes(mode); });
    syncControls();
    openDlg('dlgSetup');
    audio.play('click');
  }

  function begin(cfg) {
    cfg.level = D.level; cfg.timer = D.timer; cfg.timeout = D.timeout;
    cfg.onOver = showResult;
    cfg.onReplayEnd = () => openDlg('dlgResult');
    cfg.sig = [cfg.mode, cfg.names.join('|'), cfg.mode === 'ai' ? cfg.level : ''].join('#');
    show('game');
    Game.start(cfg);
  }

  $('setupGo').addEventListener('click', () => {
    const a = cleanName($('nameA').value, 'Player 1'), b = cleanName($('nameB').value, 'Player 2');
    audio.unlock(); audio.play('click');
    D.names = [a, setupMode === 'local' ? b : D.names[1]]; settings.set('names', D.names);
    closeDlg('dlgSetup');
    if (setupMode === 'local') begin({ mode: 'local', names: [a, b], xSeat: 0 });
    else {
      const xSeat = D.playAs === 'random' ? Math.round(Math.random()) : D.playAs === 'o' ? 1 : 0;
      begin({ mode: 'ai', names: [a, 'Computer'], xSeat });
    }
  });

  /* ───────── the end of a game ───────── */
  function showResult(info) {
    const cfg = Game.cfg;
    const win = info.winnerSeat, ai = cfg.mode === 'ai', online = cfg.mode === 'online';
    let emoji, title;
    if (info.draw) { emoji = '🤝'; title = "It's a draw"; }
    else if (win === 0 && (ai || online)) { emoji = '🎉'; title = 'You win!'; }
    else if (win === 1 && ai) { emoji = '🤖'; title = 'Computer wins'; }
    else { emoji = win === 0 ? '🎉' : '🏆'; title = `${cfg.names[win]} wins!`; }
    $('resEmoji').textContent = emoji;
    $('resTitle').textContent = title;
    const m = Math.floor(info.seconds / 60), s = info.seconds % 60;
    $('resSub').textContent = `${info.moves} moves · ${m}:${String(s).padStart(2, '0')}` + (info.draw ? ' · Nobody could make three in a row.' : '');
    const t = info.score;
    $('resTally').innerHTML = `<div><b>${t.w[0]}</b><small>${esc(cfg.names[0])}</small></div><div><b>${t.d}</b><small>Draws</small></div><div><b>${t.w[1]}</b><small>${esc(cfg.names[1])}</small></div>`;
    const ach = $('resAch');
    ach.hidden = !info.achievements.length;
    ach.innerHTML = info.achievements.map((a) => `${a.icon} <b>${a.name}</b> unlocked!`).join('<br>');
    if (info.achievements.length) audio.play('hint');
    $('resRematch').textContent = 'Rematch';
    $('resRematch').disabled = false;
    openDlg('dlgResult');
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  $('resRematch').addEventListener('click', () => {
    audio.play('click');
    if (Game.cfg.mode === 'online') { onlineRematch(); return; }
    closeDlg('dlgResult');
    Game.rematch();
  });
  $('resReplay').addEventListener('click', () => { audio.play('click'); closeDlg('dlgResult'); Game.startReplay(); });
  $('resMenu').addEventListener('click', () => { closeDlg('dlgResult'); toMenu(); });
  $('resAnalyse').addEventListener('click', () => {
    audio.play('click');
    const played = Game.moves.map((m) => ({ p: m.p, b: m.b, c: m.c }));
    closeDlg('dlgResult');
    if (online) leaveOnline();
    Game.leave();
    openAnalysis(played, true);
  });

  /* The analysis board: a fresh one from the menu, or a finished game that is reviewed straight away. */
  function openAnalysis(moves, review) {
    show('analysis');
    U.Analysis.open({ moves, review });
  }
  $('anBack').addEventListener('click', () => { audio.play('click'); U.Analysis.close(); show('menu'); });
  $('anSettings').addEventListener('click', () => { audio.play('click'); syncControls(); openDlg('dlgSettings'); });

  function toMenu() {
    if (online) leaveOnline();
    Game.leave();
    closeDlg('dlgPause', true);
    show('menu');
  }

  /* ───────── in-game buttons ───────── */
  const enabled = (b) => b.getAttribute('aria-disabled') !== 'true';
  $('btnUndo').addEventListener('click', () => { if (enabled($('btnUndo'))) Game.undo(); else Game.toast('Nothing to undo'); });
  $('btnRedo').addEventListener('click', () => { if (enabled($('btnRedo'))) Game.redo(); else Game.toast('Nothing to redo'); });
  $('btnHint').addEventListener('click', () => { audio.play('click'); Game.hint(); });
  $('btnHist').addEventListener('click', () => { audio.play('click'); Game.setHistory(true); });
  $('histClose').addEventListener('click', () => Game.setHistory(false));
  $('hist').addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) Game.jumpRow(+li.dataset.i); });
  $('btnMenu').addEventListener('click', () => { audio.play('click'); Game.pause(); $('pRestart').hidden = Game.cfg.mode === 'online'; openDlg('dlgPause'); });
  $('btnSettings').addEventListener('click', () => { audio.play('click'); Game.pause(); openDlg('dlgSettings'); });
  $('btnRestart').addEventListener('click', async () => {
    audio.play('click'); Game.pause();
    if (!Game.moves.length || Game.over || await ask('Restart this game?', 'The current game will be lost.', 'Restart', 'Keep playing')) Game.restart(); else Game.resume();
  });
  $('pRestart').addEventListener('click', async () => {
    closeDlg('dlgPause', true);
    if (await ask('Restart this game?', 'The current game will be lost.', 'Restart', 'Keep playing')) { Game.restart(); } else openDlg('dlgPause');
  });
  $('pHow').addEventListener('click', () => { closeDlg('dlgPause', true); U.Tutorial.start(() => openDlg('dlgPause')); });
  $('pScore').addEventListener('click', async () => {
    closeDlg('dlgPause', true);
    if (await ask('Reset the scoreboard?', 'Wins and draws for this match go back to zero.', 'Reset', 'Cancel')) Game.resetScore();
    openDlg('dlgPause');
  });
  $('pQuit').addEventListener('click', async () => {
    closeDlg('dlgPause', true);
    if (Game.over || !Game.moves.length || await ask('Quit to the menu?', 'The current game will be lost.', 'Quit', 'Keep playing')) toMenu(); else openDlg('dlgPause');
  });
  $('rpFirst').addEventListener('click', () => Game.replayControls.to(0));
  $('rpPrev').addEventListener('click', () => Game.replayControls.step(-1));
  $('rpPlay').addEventListener('click', () => Game.replayControls.play());
  $('rpNext').addEventListener('click', () => Game.replayControls.step(1));
  $('rpRange').addEventListener('input', (e) => Game.replayControls.to(+e.target.value));
  $('rpClose').addEventListener('click', () => Game.stopReplay());

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.dataset.screen === 'analysis' && !document.querySelector('dialog[open]') && $('tut').hidden) { $('anBack').click(); return; }
    if (e.key !== 'Escape' || !Game.active || document.querySelector('dialog[open]') || !$('tut').hidden) return;
    if (Game.replaying) { Game.stopReplay(); return; }
    if ($('history').classList.contains('open')) { Game.setHistory(false); return; }
    $('btnMenu').click();
  });

  /* ───────── menu buttons ───────── */
  $$('[data-act]').forEach((b) => b.addEventListener('click', () => {
    audio.unlock();
    const act = b.dataset.act;
    if (act === 'local' || act === 'ai') openSetup(act);
    else if (act === 'online') openOnline();
    else if (act === 'analysis') { audio.play('click'); openAnalysis([], false); }
    else if (act === 'how') { audio.play('click'); U.Tutorial.start(); }
    else if (act === 'stats') { audio.play('click'); openStats(); }
    else if (act === 'settings') { audio.play('click'); syncControls(); openDlg('dlgSettings'); }
  }));

  /* ───────── stats ───────── */
  function openStats() {
    const s = U.stats.data;
    const cells = [['Games', s.played], ['Wins', s.wins], ['Losses', s.losses], ['Draws', s.draws], ['Best streak', s.best], ['Fastest win', s.fastest ? s.fastest + ' moves' : '–']];
    $('statsGrid').innerHTML = cells.map(([k, v]) => `<div class="stat"><b>${v}</b><small>${k}</small></div>`).join('');
    $('achList').innerHTML = U.stats.ACHIEVEMENTS.map((a) =>
      `<li class="${s.ach[a.id] ? '' : 'lock'}"><span aria-hidden="true">${a.icon}</span><span><b>${a.name}</b><small>${a.desc}</small></span></li>`).join('');
    openDlg('dlgStats');
  }
  $('statsReset').addEventListener('click', async () => {
    closeDlg('dlgStats');
    if (await ask('Reset all stats?', 'Games, streaks and achievements will be cleared.', 'Reset', 'Cancel')) U.stats.reset();
    openStats();
  });

  /* ───────── online: room code over PeerJS ───────── */
  let online = null;   // { link, host, xHost, oppName, rematchMine, rematchTheirs, closeRoom }
  const status = (msg, kind) => { const n = $('onStatus'); n.textContent = msg || ''; n.className = 'net-status' + (kind ? ' ' + kind : ''); };
  const NET_ERRORS = { no_room: 'No room with that code. Check the letters and try again.', timeout: 'Could not connect. Check your internet and try again.', network: 'Could not reach the connection service. Try again in a moment.', 'unavailable-id': 'That room is busy. Try again.' };

  function openOnline() {
    audio.play('click');
    if (!root.Peer) { Game.toast('Online play is not available right now'); return; }
    $('nameOn').value = D.names[0];
    $('onChoose').hidden = false; $('onHosting').hidden = true; status('');
    $('onHost').disabled = $('onJoin').disabled = false;
    openDlg('dlgOnline');
  }
  function resetOnlineDialog() {
    if (online && !online.started) leaveOnline();
    $('onChoose').hidden = false; $('onHosting').hidden = true; status('');
  }
  $('onCancel').addEventListener('click', () => { $('dlgOnline').close(); });
  $('dlgOnline').addEventListener('close', resetOnlineDialog);
  $('onCode').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });

  function myName() {
    const n = cleanName($('nameOn').value, 'Player');
    D.names = [n, D.names[1]]; settings.set('names', D.names);
    return n;
  }

  $('onHost').addEventListener('click', async () => {
    audio.unlock();
    const name = myName();
    $('onHost').disabled = $('onJoin').disabled = true;
    status('Creating your room…');
    try {
      const room = await U.net.host((link) => {
        online = { link, host: true, xHost: Math.random() < .5, oppName: 'Friend', rematchMine: false, rematchTheirs: false, closeRoom: room.close, name };
        wire(link);
      });
      $('onChoose').hidden = true; $('onHosting').hidden = false;
      $('onShow').textContent = room.code;
      status('Waiting for your friend to join…');
      online = { pending: true, closeRoom: room.close };
    } catch (e) {
      status(NET_ERRORS[e.code] || NET_ERRORS.network, 'bad');
      $('onHost').disabled = $('onJoin').disabled = false;
    }
  });

  $('onJoin').addEventListener('click', async () => {
    audio.unlock();
    const code = $('onCode').value.trim();
    if (code.length !== 4) { status('Enter the 4-letter room code.', 'bad'); return; }
    const name = myName();
    $('onHost').disabled = $('onJoin').disabled = true;
    status('Joining…');
    try {
      const link = await U.net.join(code);
      online = { link, host: false, oppName: 'Friend', rematchMine: false, rematchTheirs: false, name };
      wire(link);
      link.send({ t: 'hi', name });
      status('Connected! Waiting for the host to start…', 'good');
    } catch (e) {
      status(NET_ERRORS[e.code] || NET_ERRORS.network, 'bad');
      $('onHost').disabled = $('onJoin').disabled = false;
    }
  });

  function wire(link) {
    link.onMsg((m) => onNetMessage(link, m));
    link.onClose(() => { if (online && online.link === link) friendLeft(); });
  }

  function onNetMessage(link, m) {
    if (!online || online.link !== link || !m) return;
    switch (m.t) {
      case 'hi':                                       // host: the guest introduced themselves
        online.oppName = cleanName(m.name, 'Friend');
        startOnline(online.xHost);
        break;
      case 'start':                                    // guest: the host says go
        online.oppName = cleanName(m.hostName, 'Friend');
        online.settings = { timer: m.timer, timeout: m.timeout };
        online.xHost = !!m.xHost;
        startOnline(online.xHost);
        break;
      case 'move': case 'pass': Game.applyRemote(m); break;
      case 'resync': if (online.host) link.send({ t: 'sync', moves: Game.moves }); break;
      case 'sync': if (!online.host) Game.loadMoves(m.moves); break;
      case 'rematch': online.rematchTheirs = true; maybeRematch(); break;
      case 'leave': friendLeft(); break;
      case 'full': status('That room already has two players.', 'bad'); break;
      default: break;
    }
  }

  function startOnline(xHost) {
    const host = online.host;
    if (host) online.link.send({ t: 'start', hostName: online.name, xHost, timer: D.timer, timeout: D.timeout });
    online.rematchMine = online.rematchTheirs = false;
    online.started = true;
    const link = online.link, s = online.settings || { timer: D.timer, timeout: D.timeout };
    show('game');
    const cfg = { mode: 'online', names: [online.name, online.oppName], xSeat: xHost === host ? 0 : 1, send: (m) => link.send(m) };
    cfg.level = D.level; cfg.timer = s.timer; cfg.timeout = s.timeout;
    cfg.onOver = showResult;
    cfg.onReplayEnd = () => openDlg('dlgResult');
    cfg.sig = ['online', online.name, online.oppName].join('#');
    Game.start(cfg);
    closeDlg('dlgOnline', true);
    closeDlg('dlgResult', true);
  }

  function onlineRematch() {
    online.rematchMine = true;
    online.link.send({ t: 'rematch' });
    $('resRematch').disabled = true;
    $('resRematch').textContent = 'Waiting for friend…';
    maybeRematch();
  }
  function maybeRematch() {
    if (!online || !online.rematchMine || !online.rematchTheirs || !online.host) return;
    online.xHost = !online.xHost;
    startOnline(online.xHost);
  }

  function leaveOnline() {
    if (!online) return;
    const o = online;
    online = null;
    if (o.link) { o.link.send({ t: 'leave' }); setTimeout(() => o.link.close(), 150); }
    if (o.closeRoom) o.closeRoom();
  }

  async function friendLeft() {
    if (!online) return;
    const o = online;
    online = null;
    if (o.closeRoom) o.closeRoom();
    if (!Game.active) { status('Your friend left.', 'bad'); $('onHost').disabled = $('onJoin').disabled = false; return; }
    Game.pause();
    closeDlg('dlgResult', true);
    await ask('Your friend left', 'The other player disconnected, so the game has ended.', 'Back to menu', null);
    toMenu();
  }

  /* ───────── first visit: offer the tutorial once ───────── */
  function maybeTutorial() {
    if (U.Tutorial.seen) return;
    setTimeout(() => { if (document.body.dataset.screen === 'menu' && !document.querySelector('dialog[open]')) U.Tutorial.start(); }, 600);
  }

  show('menu');
  maybeTutorial();
})(window);
