/* Browser smoke test: drives the real page in headless Chromium.
   Needs Playwright (npm i playwright). Serves the game itself, so just run:  node tests/ui-smoke.js
   Online play is tested with a mocked PeerJS (BroadcastChannel between two pages); the real PeerJS
   broker needs the internet, so check that by hand. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

/* A stand-in for PeerJS: peers find each other through a BroadcastChannel (same browser, different tabs). */
const MOCK_PEER = `(function () {
  const bc = new BroadcastChannel('mockpeer'), peers = {};
  class Conn {
    constructor(owner, remote, id) { this.owner = owner; this.peer = remote; this.id = id; this.open = false; this.h = {}; }
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; }
    emit(e, a) { (this.h[e] || []).forEach((f) => f(a)); }
    send(m) { bc.postMessage({ t: 'data', to: this.peer, cid: this.id, m: JSON.parse(JSON.stringify(m)) }); }
    close() { if (this.open) { this.open = false; bc.postMessage({ t: 'close', to: this.peer, cid: this.id }); this.emit('close'); } }
  }
  class Peer {
    constructor(id) { this.id = typeof id === 'string' ? id : 'anon' + Math.random().toString(36).slice(2, 8); this.h = {}; this.conns = {}; peers[this.id] = this; if (!(window.__mock && window.__mock.brokerDown)) setTimeout(() => this.emit('open', this.id), 20); }
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; }
    emit(e, a) { (this.h[e] || []).forEach((f) => f(a)); }
    connect(to) {
      const cid = Math.random().toString(36).slice(2), c = new Conn(this, to, cid);
      this.conns[cid] = c;
      if (window.__mock && window.__mock.iceFail) {           // the two networks cannot reach each other: ICE reports 'failed'
        c.peerConnection = { iceConnectionState: 'checking', addEventListener() {} };
        setTimeout(() => { c.peerConnection.iceConnectionState = 'failed'; }, 500);
        return c;
      }
      bc.postMessage({ t: 'connect', to, from: this.id, cid });
      setTimeout(() => { if (!c.open) this.emit('error', { type: 'peer-unavailable' }); }, 700);
      return c;
    }
    destroy() { delete peers[this.id]; Object.values(this.conns).forEach((c) => c.close()); }
    reconnect() {}
  }
  bc.onmessage = (e) => {
    const d = e.data, p = peers[d.to];
    if (!p) return;
    if (d.t === 'connect') { const c = new Conn(p, d.from, d.cid); c.open = true; p.conns[d.cid] = c; bc.postMessage({ t: 'accept', to: d.from, cid: d.cid }); p.emit('connection', c); setTimeout(() => c.emit('open'), 0); }
    else if (d.t === 'accept') { const c = p.conns[d.cid]; if (c) { c.open = true; c.emit('open'); } }
    else if (d.t === 'data') {
      if (window.__mock && window.__mock.dropHi > 0 && d.m && d.m.t === 'hi') { window.__mock.dropHi--; return; }   // lose the first hello(s)
      const c = p.conns[d.cid]; if (c) c.emit('data', d.m);
    }
    else if (d.t === 'close') { const c = p.conns[d.cid]; if (c && c.open) { c.open = false; c.emit('close'); } }
  };
  window.Peer = Peer;
})();`;

let passed = 0, failed = 0;
const results = [];
async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); passed++; results.push(`  ok   ${name} (${Date.now() - t0} ms)`); }
  catch (e) { failed++; results.push(`  FAIL ${name}\n       ${String(e.message).split('\n').slice(0, 4).join('\n       ')}`); }
}
function ok(v, msg) { if (!v) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || 'not equal'}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); }

let browser, base;
const errorsOf = new WeakMap();

async function open(opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 800 }, reducedMotion: opts.reducedMotion, hasTouch: opts.touch });
  if (!opts.tutorial) await ctx.addInitScript(() => { try { if (!localStorage.getItem('uttt.tutorial')) localStorage.setItem('uttt.tutorial', '"skipped"'); } catch (e) { /* ignore */ } });
  if (opts.settings) await ctx.addInitScript((s) => { try { if (!localStorage.getItem('uttt.settings')) localStorage.setItem('uttt.settings', JSON.stringify(s)); } catch (e) { /* ignore */ } }, opts.settings);
  if (opts.mockPeer) await ctx.addInitScript((m) => { window.__mock = m; }, opts.mockState || {});
  if (opts.mockPeer) await ctx.route('**/peerjs.min.js', (r) => r.fulfill({ contentType: 'text/javascript', body: MOCK_PEER }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  errorsOf.set(page, errs);
  await page.goto(base + '/index.html');
  return page;
}
const noErrors = (page) => eq(errorsOf.get(page), [], 'console errors');
const cell = (page, b, c) => page.click(`.cell[data-b="${b}"][data-c="${c}"]`, { force: true });
const game = (page) => page.evaluate(() => JSON.parse(JSON.stringify(UTTT.Game.state)));
async function startLocal(page) { await page.click('[data-act=local]'); await page.click('#setupGo'); await page.waitForSelector('#game.on'); }
/* Menu -> Quit to menu; confirms only when a game is in progress (the dialog is skipped for an untouched game). */
async function quitToMenu(page) {
  await page.click('#btnMenu'); await page.click('#pQuit');
  if (await page.waitForSelector('#dlgConfirm[open]', { timeout: 400 }).catch(() => null)) await page.click('#cfYes');
}
async function playMoves(page, moves) { for (const [b, c] of moves) { await cell(page, b, c); await page.waitForTimeout(40); } }
/* X wins board 1 (index 0) on its 5th move; the move points at the won board, so O gets a free move. */
/* A full 58-move game that ends in a draw (also checked in test-rules.js). */
const DRAWN_GAME = [[6,1],[1,5],[5,2],[2,6],[6,8],[8,3],[3,6],[6,7],[7,2],[2,8],[8,4],[4,8],[8,6],[6,2],[2,2],[2,7],[7,0],[0,2],[4,0],[0,5],[5,1],[1,7],[7,7],[7,8],[8,2],[4,3],[3,0],[0,0],[0,7],[7,3],[3,4],[4,7],[7,5],[5,3],[3,8],[0,3],[5,0],[0,8],[1,6],[6,5],[1,8],[1,2],[6,3],[7,4],[4,5],[7,1],[1,1],[1,0],[6,6],[6,4],[4,6],[6,0],[4,4],[4,2],[1,3],[7,6],[4,1],[1,4]];
const WIN_BOARD0 = [[0, 1], [1, 0], [0, 2], [2, 0], [0, 0]];
const toastText = (page) => page.evaluate(() => (document.getElementById('toast').classList.contains('on') ? document.getElementById('toast').textContent : ''));

async function main() {
  await new Promise((r) => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();

  await test('first visit shows the tutorial; every step has Skip; skipping is remembered', async () => {
    const page = await open({ tutorial: true });
    await page.waitForSelector('#tut:not([hidden])');
    for (let i = 1; i <= 7; i++) {
      eq(await page.textContent('#tutStep'), `Step ${i} of 7`);
      ok(await page.isVisible('#tutSkip'), 'Skip tutorial visible on step ' + i);
      if (i < 7) await page.click('#tutNext');
    }
    await page.click('#tutBack');
    eq(await page.textContent('#tutStep'), 'Step 6 of 7');
    await page.click('#tutSkip');
    ok(await page.isHidden('#tut'));
    eq(await page.evaluate(() => localStorage.getItem('uttt.tutorial')), '"skipped"');
    await page.reload();
    await page.waitForTimeout(1500);
    ok(await page.isHidden('#tut'), 'tutorial must not reopen after skipping');
    await page.click('[data-act=how]');
    ok(await page.isVisible('#tut'), 'How to Play replays it');
    await page.keyboard.press('Escape');
    ok(await page.isHidden('#tut'));
    noErrors(page); await page.context().close();
  });

  await test('tutorial demos play their scripted moves (small board win, game win)', async () => {
    const page = await open({ tutorial: true });
    await page.waitForSelector('#tut:not([hidden])');
    for (let i = 0; i < 3; i++) await page.click('#tutNext');           // step 4: win a small board
    await page.waitForSelector('#tutBoard .sb.won.p1', { timeout: 5000 });
    await page.click('#tutNext');                                        // step 5: free move
    await page.waitForFunction(() => document.querySelectorAll('#tutBoard .sb.legal').length === 8, null, { timeout: 4000 });
    await page.click('#tutNext');                                        // step 6: win the game
    await page.waitForSelector('#tutBoard .board.victory', { timeout: 6000 });
    await page.click('#tutNext'); await page.click('#tutNext');          // finish
    ok(await page.isHidden('#tut'));
    eq(await page.evaluate(() => localStorage.getItem('uttt.tutorial')), '"done"');
    noErrors(page); await page.context().close();
  });

  await test('local game: turns, send-to-board, free move, small-board win', async () => {
    const page = await open();
    await startLocal(page);
    await cell(page, 4, 0);
    let s = await game(page);
    eq(s.next, 0); eq(s.turn, 2);
    eq(await page.$$eval('.sb.legal', (n) => n.map((e) => e.dataset.b)), ['0'], 'only board 1 glows');
    await page.click('#btnRestart'); await page.waitForSelector('#dlgConfirm[open]'); await page.click('#cfYes');
    await playMoves(page, WIN_BOARD0);
    s = await game(page);
    eq(s.boards[0], 1, 'X owns board 1'); eq(s.next, -1, 'free move');
    await page.waitForSelector('.sb.won.p1 .claim');
    ok(await page.$('.sb.won.p1 .wline'), 'win line drawn');
    eq(await page.$$eval('.sb.legal', (n) => n.length), 8, 'eight open boards glow on a free move');
    noErrors(page); await page.context().close();
  });

  await test('illegal moves: shake, reason toast (never stacked), legal board flashes', async () => {
    const page = await open();
    await startLocal(page);
    await cell(page, 4, 4);                                  // O must now play in board 5
    await cell(page, 0, 0);
    eq(await toastText(page), 'You must play in the glowing board');
    ok(await page.$eval('.cell[data-b="0"][data-c="0"]', (e) => e.classList.contains('shake')), 'cell shakes');
    ok(await page.$eval('.sb[data-b="4"]', (e) => e.classList.contains('flash')), 'legal board flashes');
    await cell(page, 4, 4);
    await page.waitForTimeout(1200);
    const resting = (sel) => page.$eval(sel, (e) => getComputedStyle(e, '::after').opacity);
    eq(await resting('.sb[data-b="4"]'), '0', 'the flash overlay fades away and does not stay as a solid block');
    eq(await toastText(page), 'Cell already taken');
    eq((await game(page)).moves.length, 1, 'no move was made');
    eq(await page.$$eval('#toast', (n) => n.length), 1, 'a single toast element');
    await page.waitForTimeout(2600);
    eq(await toastText(page), '', 'toast auto-dismisses');
    await page.click('#btnRestart'); await page.click('#cfYes');
    await playMoves(page, WIN_BOARD0);
    await playMoves(page, [[3, 3]]);                         // O plays the free move, X must go to board 4
    await cell(page, 0, 5);
    eq(await toastText(page), 'That board is already won');
    noErrors(page); await page.context().close();
  });

  await test('undo / redo and hint', async () => {
    const page = await open();
    await startLocal(page);
    await playMoves(page, [[4, 4], [4, 0]]);
    await page.click('#btnUndo');
    eq((await game(page)).moves.length, 1);
    await page.click('#btnRedo');
    eq((await game(page)).moves.length, 2);
    await page.click('#btnUndo'); await page.click('#btnUndo');
    eq((await game(page)).moves.length, 0);
    ok(await page.$eval('#btnUndo', (b) => b.getAttribute('aria-disabled') === 'true'), 'undo disabled with no moves');
    await cell(page, 4, 4);
    ok(await page.$eval('#btnRedo', (b) => b.getAttribute('aria-disabled') === 'true'), 'redo cleared by a new move');
    eq(await page.textContent('#btnHint .badge'), '3');
    await page.click('#btnHint');
    await page.waitForSelector('.cell.hint', { timeout: 4000 });
    eq(await page.textContent('#btnHint .badge'), '2');
    const hintDot = () => page.$eval('.cell.hint', (e) => Number(getComputedStyle(e, '::before').opacity));
    await page.evaluate(() => UTTT.settings.set('anim', false));
    ok((await hintDot()) < 0.7, 'with animations off the hint is a soft dot, not a solid disc');
    noErrors(page); await page.context().close();
  });

  await test('vs computer: easy, medium and hard answer; the UI stays responsive while hard thinks', async () => {
    const page = await open();
    for (const level of ['easy', 'medium', 'hard']) {
      await page.evaluate((l) => UTTT.settings.set('level', l), level);
      await page.click('[data-act=ai]'); await page.click('#setupGo'); await page.waitForSelector('#game.on');
      await page.evaluate(() => { window.__gaps = []; let last = performance.now(); (function f(t) { window.__gaps.push(t - last); last = t; requestAnimationFrame(f); })(last); });
      await cell(page, 4, 4);
      if (level === 'hard') ok(await page.waitForSelector('.pcard.thinking', { timeout: 1500 }), 'thinking dots shown');
      await page.waitForFunction(() => UTTT.Game.state.moves.length === 2, null, { timeout: 6000 });
      const s = await game(page);
      eq(s.moves[1].p, 2, level + ': the computer is O');
      const worst = await page.evaluate(() => Math.max(...window.__gaps));
      ok(worst < 250, `${level}: longest frame gap ${Math.round(worst)} ms`);
      await quitToMenu(page);
      await page.waitForSelector('#menu.on');
    }
    noErrors(page); await page.context().close();
  });

  await test('a whole game to the end: result dialog, replay, rematch swaps who starts, score kept', async () => {
    const page = await open();
    await startLocal(page);
    for (let i = 0; i < 90; i++) {
      const m = await page.evaluate(() => { const s = UTTT.Game.state; if (s.winner) return null; const l = UTTT.rules.legalMoves(s); return l[Math.floor(Math.random() * l.length)]; });
      if (!m) break;
      await cell(page, m.b, m.c);
    }
    await page.waitForSelector('#dlgResult[open]', { timeout: 8000 });
    const title = await page.textContent('#resTitle');
    ok(/wins!|draw/i.test(title), 'result title: ' + title);
    const s = await game(page);
    ok(s.winner > 0);
    await page.click('#resReplay');
    await page.waitForSelector('#game.replaying');
    await page.waitForTimeout(1100);
    ok((await page.evaluate(() => document.querySelectorAll('.board .cell.x, .board .cell.o').length)) > 0, 'replay places marks');
    await page.click('#rpClose');
    await page.waitForSelector('#dlgResult[open]');
    await page.click('#resRematch');
    await page.waitForFunction(() => UTTT.Game.state.moves.length === 0 && !UTTT.Game.over);
    eq(await page.evaluate(() => UTTT.Game.cfg.xSeat), 1, 'rematch swaps who plays X');
    const total = await page.evaluate(() => { const sc = UTTT.Game.score(); return sc.w[0] + sc.w[1] + sc.d; });
    eq(total, 1, 'score kept across the rematch');
    noErrors(page); await page.context().close();
  });

  await test('a drawn game: sympathetic shrug, draw result, nobody scores a win', async () => {
    const page = await open();
    await startLocal(page);
    await playMoves(page, DRAWN_GAME.slice(0, -1));
    await cell(page, DRAWN_GAME[57][0], DRAWN_GAME[57][1]);
    await page.waitForSelector('.board.draw .shrug', { timeout: 4000 });
    await page.waitForSelector('#dlgResult[open]', { timeout: 6000 });
    eq(await page.textContent('#resTitle'), "It's a draw");
    eq(await page.evaluate(() => { const s = UTTT.Game.score(); return [s.w[0], s.w[1], s.d]; }), [0, 0, 1]);
    ok(await page.$('.sb.drawn .claim .eq'), 'drawn boards are marked');
    noErrors(page); await page.context().close();
  });

  await test('undo and redo against the computer step back to your turn', async () => {
    const page = await open();
    await page.evaluate(() => UTTT.settings.set('level', 'easy'));
    await page.click('[data-act=ai]'); await page.click('#setupGo'); await page.waitForSelector('#game.on');
    await cell(page, 4, 4);
    await page.waitForFunction(() => UTTT.Game.state.moves.length === 2, null, { timeout: 5000 });
    await page.click('#btnUndo');
    eq((await game(page)).moves.length, 0, 'both the computer move and yours are undone');
    await page.click('#btnRedo');
    eq((await game(page)).moves.length, 2, 'redo puts both back');
    await page.waitForTimeout(1200);
    eq((await game(page)).moves.length, 2, 'the computer does not move twice');
    noErrors(page); await page.context().close();
  });

  await test('interruptions: pausing, settings and the tutorial mid-game never let the computer move early or twice', async () => {
    const page = await open();
    await page.evaluate(() => UTTT.settings.set('level', 'easy'));
    await page.click('[data-act=ai]'); await page.click('#setupGo'); await page.waitForSelector('#game.on');
    const moves = async () => (await game(page)).moves.length;
    await cell(page, 4, 4);                                   // the computer is now thinking
    await page.click('#btnMenu');                             // pause straight away
    await page.waitForTimeout(1600);
    eq(await moves(), 1, 'no computer move while paused');
    await page.click('#pHow');                                // tutorial from the pause menu
    ok(await page.isVisible('#tut'));
    await page.keyboard.press('Escape');
    await page.waitForSelector('#dlgPause[open]');
    await page.waitForTimeout(1200);
    eq(await moves(), 1, 'still paused after the tutorial');
    await page.keyboard.press('Escape');                      // close the pause dialog: resume
    await page.waitForFunction(() => UTTT.Game.state.moves.length === 2, null, { timeout: 5000 });
    await page.waitForTimeout(1500);
    eq(await moves(), 2, 'exactly one computer move after resuming');
    await cell(page, (await game(page)).next, 4);             // our turn again; open settings while it thinks
    await page.click('#btnSettings');
    await page.waitForTimeout(1500);
    eq(await moves(), 3, 'settings dialog pauses the computer too');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => UTTT.Game.state.moves.length === 4, null, { timeout: 5000 });
    await page.click('#btnUndo');                             // undo while it is our turn, then again straight after a move
    eq(await moves(), 2);
    await cell(page, (await game(page)).next, 4);
    await page.click('#btnUndo');                             // undo while the computer is thinking
    await page.waitForTimeout(1800);
    eq(await moves(), 2, 'the computer does not answer a move that was undone');
    ok(await page.$eval('#players', (e) => e.dataset.active !== '0'), 'game is still live');
    noErrors(page); await page.context().close();
  });

  await test('every sound plays in every theme, and the packs really differ', async () => {
    const page = await open();
    await page.evaluate(() => {
      window.__osc = [];
      const proto = AudioContext.prototype, orig = proto.createOscillator;
      proto.createOscillator = function () { const o = orig.call(this); window.__osc.push(o); return o; };
    });
    await page.click('[data-act=settings]');
    const names = ['place', 'illegal', 'boardWin', 'gameWin', 'draw', 'click', 'theme', 'hint', 'tick', 'undo'];
    const sigs = new Set();
    for (const id of await page.$$eval('#themeGrid .theme-btn', (n) => n.map((e) => e.dataset.theme))) {
      await page.evaluate((t) => UTTT.settings.setTheme(t, true), id);
      const sig = await page.evaluate(async (names) => {
        const kinds = new Set();
        for (const n of names) {
          const before = window.__osc.length;
          UTTT.audio.play(n, 1);
          if (window.__osc.length === before) throw new Error('no sound for ' + n);
          window.__osc.slice(before).forEach((o) => kinds.add(o.type));
        }
        return [...kinds].sort().join('+');
      }, names);
      sigs.add(sig);
    }
    ok(sigs.size >= 3, 'themes use different waveforms: ' + [...sigs].join(' | '));
    noErrors(page); await page.context().close();
  });

  await test('all seven themes switch live, are saved, and survive a reload', async () => {
    const page = await open();
    await page.click('[data-act=settings]');
    const ids = await page.$$eval('#themeGrid .theme-btn', (n) => n.map((e) => e.dataset.theme));
    eq(ids.length, 7);
    for (const id of ids) {
      await page.click(`#themeGrid [data-theme="${id}"]`);
      await page.waitForFunction((t) => document.documentElement.dataset.theme === t, id);
      eq(await page.evaluate(() => JSON.parse(localStorage.getItem('uttt.settings')).theme), id);
    }
    await page.reload();
    eq(await page.evaluate(() => document.documentElement.dataset.theme), ids[ids.length - 1]);
    noErrors(page); await page.context().close();
  });

  await test('sound and animation settings are saved; audio only starts after a gesture', async () => {
    const page = await open();
    eq(await page.evaluate(() => UTTT.audio.running), false, 'no audio before interaction');
    await page.click('[data-act=settings]');
    ok(await page.evaluate(() => UTTT.audio.running), 'audio running after a click');
    await page.evaluate(() => { const v = document.getElementById('optVol'); v.value = '30'; v.dispatchEvent(new Event('input')); });
    await page.click('label.switch:has(#optSound)');
    await page.click('label.switch:has(#optAnim)');
    eq(await page.evaluate(() => JSON.parse(localStorage.getItem('uttt.sound'))), { muted: true, vol: 0.3 });
    ok(await page.evaluate(() => document.documentElement.classList.contains('no-anim')), 'animations off');
    await page.reload();
    eq(await page.evaluate(() => UTTT.audio.muted), true);
    ok(await page.evaluate(() => document.documentElement.classList.contains('no-anim')));
    noErrors(page); await page.context().close();
  });

  await test('reduced-motion preference turns animations off by default', async () => {
    const page = await open({ reducedMotion: 'reduce' });
    ok(await page.evaluate(() => document.documentElement.classList.contains('no-anim')));
    await startLocal(page);
    await cell(page, 4, 4);
    eq(await page.$$eval('.ripple', (n) => n.length), 0, 'no ripple');
    noErrors(page); await page.context().close();
  });

  await test('turn timer: a random move is played, or the turn is skipped, when time runs out', async () => {
    const page = await open();
    await page.evaluate(() => { UTTT.settings.set('timer', 1); UTTT.settings.set('timeout', 'random'); });
    await startLocal(page);
    ok(await page.$eval('#timer', (e) => e.classList.contains('on')), 'timer bar visible');
    await page.waitForFunction(() => UTTT.Game.state.moves.length === 1, null, { timeout: 3500 });
    await quitToMenu(page);
    await page.evaluate(() => UTTT.settings.set('timeout', 'skip'));
    await startLocal(page);
    await page.waitForFunction(() => UTTT.Game.state.moves.length === 1 && UTTT.Game.state.moves[0].b === -1, null, { timeout: 3500 });
    const s = await game(page);
    eq(s.turn, 2); eq(s.next, -1, 'opponent gets a free move after a skipped turn');
    noErrors(page); await page.context().close();
  });

  await test('keyboard: arrows move over the 9x9 grid, Enter places', async () => {
    const page = await open();
    await startLocal(page);
    await page.focus('.cell[data-b="4"][data-c="4"]');
    await page.keyboard.press('ArrowRight');
    eq(await page.evaluate(() => [document.activeElement.dataset.b, document.activeElement.dataset.c]), ['4', '5']);
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
    eq(await page.evaluate(() => [document.activeElement.dataset.b, document.activeElement.dataset.c]), ['1', '8']);
    await page.keyboard.press('Enter');
    eq((await game(page)).moves[0], { p: 1, b: 1, c: 8 });
    ok((await page.getAttribute('.cell[data-b="1"][data-c="8"]', 'aria-label')).includes('taken by X'), 'screen-reader label updated');
    noErrors(page); await page.context().close();
  });

  for (const [name, viewport] of [['phone portrait', { width: 375, height: 667 }], ['small phone', { width: 320, height: 568 }], ['phone landscape', { width: 667, height: 375 }], ['tablet', { width: 820, height: 1180 }]]) {
    await test(`responsive: ${name} ${viewport.width}x${viewport.height}`, async () => {
      const page = await open({ viewport, touch: true });
      await startLocal(page);
      await playMoves(page, [[4, 4], [4, 0]]);
      const m = await page.evaluate(() => {
        const r = (sel) => { const e = document.querySelector(sel).getBoundingClientRect(); return { l: e.left, t: e.top, r: e.right, b: e.bottom, w: e.width }; };
        return { board: r('.board'), toolbar: r('.toolbar'), cell: r('.cell'), players: r('#players'), vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth };
      });
      ok(m.board.l >= 0 && m.board.r <= m.vw && m.board.t >= 0 && m.board.b <= m.vh, 'board fits the screen: ' + JSON.stringify(m.board));
      ok(m.toolbar.b <= m.vh + 1 && m.toolbar.r <= m.vw, 'toolbar on screen');
      ok(m.sw <= m.vw, 'no horizontal scroll');
      ok(m.cell.w >= 24, 'cell at least 24px: ' + m.cell.w);
      noErrors(page); await page.context().close();
    });
  }

  await test('online (mock PeerJS): room code, moves both ways, out-of-turn blocked, rematch, leave', async () => {
    const a = await open({ mockPeer: true });
    const ctx = a.context();
    const b = await ctx.newPage(); errorsOf.set(b, []);
    b.on('pageerror', (e) => errorsOf.get(b).push('pageerror: ' + e.message));
    await b.goto(base + '/index.html');
    await a.click('[data-act=online]'); await a.fill('#nameOn', 'Ana'); await a.click('#onHost');
    await a.waitForFunction(() => document.getElementById('onShow').textContent.length === 4);
    const code = await a.textContent('#onShow');
    await b.click('[data-act=online]'); await b.fill('#nameOn', 'Ben'); await b.fill('#onCode', code); await b.click('#onJoin');
    await a.waitForSelector('#game.on'); await b.waitForSelector('#game.on');
    const xHost = await a.evaluate(() => UTTT.Game.cfg.xSeat === 0);
    const [first, second] = xHost ? [a, b] : [b, a];
    await cell(second, 4, 4);                                  // not their turn
    eq((await game(first)).moves.length, 0);
    ok(/Waiting for/.test(await toastText(second)), 'out-of-turn click explained');
    await cell(first, 4, 4);
    await second.waitForFunction(() => UTTT.Game.state.moves.length === 1);
    await cell(second, 4, 0);
    await first.waitForFunction(() => UTTT.Game.state.moves.length === 2);
    eq(await first.textContent('#pc1 .pname'), xHost ? 'Ben' : 'Ana');
    // finish the game quickly with random legal moves from whoever's turn it is
    for (let i = 0; i < 90; i++) {
      const done = await a.evaluate(() => UTTT.Game.state.winner);
      if (done) break;
      const turnIsA = await a.evaluate(() => { const s = UTTT.Game.state, c = UTTT.Game.cfg; return (s.turn === 1) === (c.xSeat === 0); });
      const mover = turnIsA ? a : b;
      const m = await mover.evaluate(() => { const l = UTTT.rules.legalMoves(UTTT.Game.state); return l[Math.floor(Math.random() * l.length)]; });
      const before = (await game(a)).moves.length;
      await cell(mover, m.b, m.c);
      await a.waitForFunction((n) => UTTT.Game.state.moves.length > n, before, { timeout: 3000 });
      await b.waitForFunction((n) => UTTT.Game.state.moves.length > n, before, { timeout: 3000 });
    }
    eq((await game(a)).moves, (await game(b)).moves, 'both players see the same game');
    await a.waitForSelector('#dlgResult[open]', { timeout: 8000 }); await b.waitForSelector('#dlgResult[open]', { timeout: 8000 });
    await a.click('#resRematch');
    await b.click('#resRematch');
    await a.waitForFunction(() => UTTT.Game.state.moves.length === 0 && !UTTT.Game.over && !document.getElementById('dlgResult').open, null, { timeout: 5000 });
    await b.waitForFunction(() => UTTT.Game.state.moves.length === 0 && !UTTT.Game.over && !document.getElementById('dlgResult').open, null, { timeout: 5000 });
    eq(await a.evaluate(() => UTTT.Game.cfg.xSeat) + await b.evaluate(() => UTTT.Game.cfg.xSeat), 1, 'exactly one of them is X after the rematch');
    await quitToMenu(b);
    await a.waitForSelector('#dlgConfirm[open]');
    ok(/left/i.test(await a.textContent('#cfTitle')), 'the other player is told their friend left');
    noErrors(a); noErrors(b); await ctx.close();
  });

  await test('analysis board: engine lines, eval bar, playing and stepping through moves', async () => {
    const page = await open();
    await page.click('[data-act=analysis]');
    await page.waitForSelector('#analysis.on');
    await page.waitForFunction(() => document.querySelectorAll('#anLines .an-line').length === 3, null, { timeout: 8000 });
    const sum = await page.evaluate(() => Number(document.getElementById('ebX').textContent) + Number(document.getElementById('ebO').textContent));
    eq(sum, 100, 'the two bar numbers add up to 100');
    ok(await page.$$eval('.cell.eng', (n) => n.length) >= 3, 'the three best moves are marked on the board');
    ok(/depth \d+/.test(await page.textContent('#anMeta')), 'search depth shown');
    await cell(page, 4, 4);                                                   // play a move for X
    await page.waitForFunction(() => UTTT.Analysis && document.querySelectorAll('#anHist li[data-i]').length === 1);
    await cell(page, 4, 0);
    await page.waitForFunction(() => document.querySelectorAll('#anLines .an-line').length === 3, null, { timeout: 8000 });
    await cell(page, 5, 5);                                                   // O's move sent X to board 1: board 6 is wrong, explained, not played
    eq(await toastText(page), 'You must play in the glowing board');
    eq(await page.$$eval('#anHist li[data-i]', (n) => n.length), 2);
    await page.keyboard.press('PageUp');                                      // step back (plain arrows move around the board while it has focus)
    eq(await page.$$eval('#anHist li.cur', (n) => n.length), 1);
    eq(await page.getAttribute('#anHist li.cur', 'data-i'), '1');
    await page.click('#anFirst');
    eq(await page.$$eval('#anStage .cell.x, #anStage .cell.o', (n) => n.length), 0, 'back at the start');
    await page.click('#anLast');
    eq(await page.$$eval('#anStage .cell.x, #anStage .cell.o', (n) => n.length), 2);
    await page.click('#anEngine', { force: true });
    ok(await page.isVisible('.an-none'), 'with the engine off there are no lines');
    eq(await page.$$eval('.cell.eng', (n) => n.length), 0);
    await page.click('#anBack');
    ok(await page.isVisible('#menu'));
    noErrors(page); await page.context().close();
  });

  await test('analysis board: a finished game is reviewed with accuracy, move marks and a graph', async () => {
    const page = await open();
    await startLocal(page);
    for (let i = 0; i < 90; i++) {
      const m = await page.evaluate(() => { const s = UTTT.Game.state; if (s.winner) return null; const l = UTTT.rules.legalMoves(s); return l[Math.floor(Math.random() * l.length)]; });
      if (!m) break;
      await cell(page, m.b, m.c);
    }
    await page.waitForSelector('#dlgResult[open]', { timeout: 8000 });
    await page.click('#resAnalyse');
    await page.waitForSelector('#analysis.on');
    await page.waitForFunction(() => /again/.test(document.getElementById('anReview').textContent), null, { timeout: 60000 });
    ok(await page.$$eval('#anAcc .acc .accn', (n) => n.length) === 2, 'accuracy for both players');
    ok(await page.$$eval('#anHist .q', (n) => n.length) > 10, 'moves are marked');
    ok(await page.$('#anGraph .g-line'), 'evaluation graph drawn');
    const n = await page.$$eval('#anHist li[data-i]', (e) => e.length);
    eq(await page.getAttribute('#anHist li.cur', 'data-i'), String(n), 'opens at the end of the game');
    await page.evaluate(() => { const g = document.getElementById('anGraph'), r = g.getBoundingClientRect(); g.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 5, clientY: r.top + 30 })); });
    ok((await page.$$eval('#anStage .cell.x, #anStage .cell.o', (c) => c.length)) < 3, 'clicking the left edge of the graph jumps back to the start');
    noErrors(page); await page.context().close();
  });

  await test('analysis board: the eval bar uses each theme\'s colours and fits a phone', async () => {
    const page = await open({ viewport: { width: 375, height: 667 }, touch: true });
    await page.click('[data-act=analysis]');
    await page.waitForSelector('#analysis.on');
    for (const id of ['neon', 'paper', 'dark', 'arcade', 'ocean', 'forest', 'light']) {
      await page.evaluate((t) => UTTT.settings.setTheme(t, true), id);
      const same = await page.evaluate(() => {
        const probe = document.createElement('i'); probe.style.background = 'var(--x)'; document.body.appendChild(probe);
        const want = getComputedStyle(probe).backgroundColor; probe.remove();
        return getComputedStyle(document.querySelector('.eb-fill')).backgroundColor === want;
      });
      ok(same, 'bar fill follows --x in ' + id);
    }
    const m = await page.evaluate(() => { const r = (q) => document.querySelector(q).getBoundingClientRect(); return { bar: r('#evalbar'), board: r('.board'), vw: innerWidth, sw: document.documentElement.scrollWidth }; });
    ok(m.bar.width > 300 && m.bar.height < 50, 'the bar is horizontal on a phone');
    ok(m.board.left >= 0 && m.board.right <= m.vw && m.sw <= m.vw, 'board fits, no sideways scroll');
    noErrors(page); await page.context().close();
  });

  await test('analysis board still works when Web Workers are unavailable (e.g. opened from a file)', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(() => { localStorage.setItem('uttt.tutorial', '"skipped"'); window.Worker = function () { throw new Error('no workers here'); }; });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(base + '/index.html');
    await page.click('[data-act=analysis]');
    await page.waitForFunction(() => document.querySelectorAll('#anLines .an-line').length === 3, null, { timeout: 8000 });
    await cell(page, 4, 4);
    await page.waitForFunction(() => document.querySelectorAll('#anLines .an-line').length === 3 && document.querySelectorAll('#anHist li[data-i]').length === 1, null, { timeout: 8000 });
    eq(errs, []);
    await ctx.close();
  });

  await test('online: a lost hello is retried, so both sides still start', async () => {
    const a = await open({ mockPeer: true, mockState: { dropHi: 2 } });
    const ctx = a.context();
    const b = await ctx.newPage(); errorsOf.set(b, []);
    await b.goto(base + '/index.html');
    await a.click('[data-act=online]'); await a.click('#onHost');
    await a.waitForFunction(() => document.getElementById('onShow').textContent.length === 4);
    const code = await a.textContent('#onShow');
    await b.click('[data-act=online]'); await b.fill('#onCode', code); await b.click('#onJoin');
    await a.waitForSelector('#game.on', { timeout: 10000 }); await b.waitForSelector('#game.on', { timeout: 10000 });
    await ctx.close();
  });

  await test('online: each failure says what went wrong (wrong code, no matchmaking server, blocked link)', async () => {
    let page = await open({ mockPeer: true });
    await page.click('[data-act=online]'); await page.fill('#onCode', 'ZZZZ'); await page.click('#onJoin');
    await page.waitForFunction(() => /No room with that code/.test(document.getElementById('onStatus').textContent), null, { timeout: 5000 });
    ok(await page.$eval('#onJoin', (b) => !b.disabled), 'can try again');
    await page.context().close();

    page = await open({ mockPeer: true, mockState: { brokerDown: true } });
    await page.evaluate(() => { UTTT.net.timeouts.broker = 1200; });
    await page.click('[data-act=online]'); await page.click('#onHost');
    await page.waitForFunction(() => /matchmaking server/.test(document.getElementById('onStatus').textContent), null, { timeout: 5000 });
    ok(!/internet/i.test(await page.textContent('#onStatus')), 'no vague "check your internet"');
    await page.context().close();

    page = await open({ mockPeer: true, mockState: { iceFail: true } });
    await page.click('[data-act=online]'); await page.fill('#onCode', 'ABCD'); await page.click('#onJoin');
    await page.waitForFunction(() => /could not open a direct link/.test(document.getElementById('onStatus').textContent), null, { timeout: 8000 });
    ok(/hotspot|same Wi-Fi/.test(await page.textContent('#onStatus')), 'tells the player what to try');
    await page.context().close();
  });

  await test('stats and achievements are recorded and shown', async () => {
    const page = await open();
    await page.evaluate(() => UTTT.stats.record({ mode: 'ai', level: 'hard', result: 'win', moves: 25, mine: 3, theirs: 0, deficit: 0 }));
    await page.click('[data-act=stats]');
    const unlocked = await page.$$eval('#achList li:not(.lock)', (n) => n.length);
    ok(unlocked >= 4, 'first win, hard, speed and shutout unlocked, got ' + unlocked);
    noErrors(page); await page.context().close();
  });

  await browser.close();
  server.close();
  console.log(results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
