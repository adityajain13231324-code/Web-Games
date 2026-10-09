// UI smoke test: plays whole games through the real buttons in a headless browser and fails on any console error.
// Needs Playwright (npm i playwright) and the site served locally:   python3 -m http.server 8123   then   node tests/ui-smoke.js
// Optional: node tests/ui-smoke.js http://localhost:8123/index.html
var pw;
try { pw = require('playwright') } catch (e) { console.log('Playwright is not installed (npm i playwright); skipping the UI smoke test.'); process.exit(0) }
var URL = process.argv[2] || 'http://localhost:8123/index.html';

async function game(browser, name, o) {
  var pg = await browser.newPage({ viewport: { width: o.w || 390, height: o.h || 844 } }), errs = [];
  pg.on('pageerror', function (e) { errs.push(String(e)) });
  pg.on('console', function (m) { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()) });
  // run the timers fast so a whole game takes seconds
  await pg.addInitScript(function () { var st = window.setTimeout; window.setTimeout = function (f, ms) { return st.apply(window, [f, (ms || 0) * .12].concat([].slice.call(arguments, 2))) } });
  await pg.goto(URL);
  if (o.shortStack) await pg.evaluate(function () { var make = BJ.newGame; BJ.newGame = function (p, opts) { var s = make(p, opts), me = Math.floor((p.length - 1) / 2); s.players.forEach(function (q, i) { q.chips = i === me ? 25 : 5000 }); s.opts.maxBet = 5000; return s } });
  await pg.click('#goSetup');
  async function opt(label, text) { await pg.locator('#optgrid > div', { has: pg.locator('label.row', { hasText: label }) }).getByRole('button', { name: text, exact: true }).click() }
  await opt('Bots at the table', String(o.bots)); await opt('Rounds', '5'); await opt('Turn timer', 'Off'); await opt('Betting', o.match ? 'Match the highest' : 'Free bets');
  await pg.click('#start');
  var seen = { call: 0, allin: 0, raise: 0, fold: 0, open: 0, moves: 0 };
  for (var i = 0; i < 8000; i++) {
    if (await pg.locator('#over.on').count()) break;
    if (await pg.locator('#cRaise').count() && Math.random() < .3) { seen.raise++; await pg.click('#cRaise') }
    else if (await pg.locator('#cCall').count()) { seen.call++; await pg.click('#cCall') }
    else if (await pg.locator('#cAll').count()) { seen.allin++; await pg.click('#cAll') }
    else if (await pg.locator('#cFold').count()) { seen.fold++; await pg.click('#cFold') }
    else if (await pg.locator('#bDeal').count()) {
      await pg.locator('.chipbtn[data-c="50"]:not([disabled])').first().click().catch(function () {});
      seen.open++; await pg.locator('#bDeal:not([disabled])').click({ timeout: 2000 }).catch(function () {});
    } else if (await pg.locator('#iN').count()) await pg.click('#iN');
    else if (await pg.locator('#a_hit:not([disabled])').count()) { seen.moves++; await pg.click(Math.random() < .5 ? '#a_stand' : '#a_hit').catch(function () {}) }
    else if (await pg.locator('#rb').count()) await pg.click('#rb');
    await pg.waitForTimeout(40);
  }
  var done = await pg.locator('#over.on').count();
  await pg.close();
  var ok = done === 1 && errs.length === 0;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(seen) + (errs.length ? ' errors: ' + JSON.stringify(errs.slice(0, 3)) : ''));
  return ok;
}

(async () => {
  var b = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }), ok = true;
  ok = (await game(b, 'phone, 5 bots, matching bets', { bots: 5, match: true })) && ok;
  ok = (await game(b, 'phone, short stack must go all in or fold', { bots: 5, match: true, shortStack: true })) && ok;
  ok = (await game(b, 'desktop, 3 bots, free bets', { bots: 3, match: false, w: 1200, h: 760 })) && ok;
  await b.close();
  process.exit(ok ? 0 : 1);
})();
