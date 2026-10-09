/* Blackjack 21: the table client.
   Solo game against bots. The rules engine (BJ) holds the truth; this file turns the engine's
   events into a staged, animated display (D), plays the sound, and asks the human for decisions. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id) };
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : d } catch (e) { return d } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }
  function rnd(n) { return Math.floor(Math.random() * n) }
  function money(n) { return '$' + n.toLocaleString('en-US') }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  var Au = window.BJAudio;
  function sfx(name, arg) { try { Au.sfx[name](arg) } catch (e) {} }

  /* ---------- settings, presets and stats ---------- */
  var DEF = { name: '', avatar: 'p1', bots: 4, level: 'normal', rounds: 15, decks: 6, maxBet: 1000, matchBets: true, surrender: true, timer: 20, hint: false, speed: 'normal', cards: 'classic' };
  var cfg = Object.assign({}, DEF, load('bj-settings', {}));
  if (cfg.bots > 5) cfg.bots = 5;
  if (BJArt.avatars.indexOf(cfg.avatar) < 0) cfg.avatar = 'p1';
  var stats = Object.assign({ games: 0, wins: 0, blackjacks: 0, best: 0 }, load('bj-stats', {}));
  function saveCfg() { save('bj-settings', cfg) }
  BJArt.setFourColour(cfg.cards === 'four');

  var OPTIONS = [
    { key: 'bots', label: 'Bots at the table', vals: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]] },
    { key: 'level', label: 'Bot level', vals: [['Easy', 'easy'], ['Normal', 'normal'], ['Hard', 'hard']] },
    { key: 'rounds', label: 'Rounds', vals: [['5', 5], ['10', 10], ['15', 15], ['25', 25], ['Endless', 0]] },
    { key: 'matchBets', label: 'Betting', vals: [['Match the highest', true], ['Free bets', false]], note: 'Match the highest: the opener bets, everyone else must match the biggest bet, raise or fold. Short stacks go all in.' },
    { key: 'maxBet', label: 'Table maximum bet', vals: [['$500', 500], ['$1,000', 1000], ['$5,000', 5000]] },
    { key: 'decks', label: 'Decks in the shoe', vals: [['1', 1], ['2', 2], ['4', 4], ['6', 6], ['8', 8]] },
    { key: 'surrender', label: 'Surrender', vals: [['Off', false], ['On', true]] },
    { key: 'timer', label: 'Turn timer', vals: [['Off', 0], ['20 s', 20], ['30 s', 30]] },
    { key: 'hint', label: 'Hints (basic strategy)', vals: [['Off', false], ['On', true]] },
    { key: 'speed', label: 'Game speed', vals: [['Normal', 'normal'], ['Fast', 'fast']] }
  ];
  var PRESETS = [
    { id: 'quick', name: 'Quick table', desc: '3 bots, 10 rounds. A short night.', set: { bots: 3, rounds: 10, level: 'normal', maxBet: 1000, matchBets: true } },
    { id: 'classic', name: 'Classic night', desc: '4 bots, 15 rounds, $1,000 limit.', set: { bots: 4, rounds: 15, level: 'normal', maxBet: 1000, matchBets: true } },
    { id: 'high', name: 'High roller', desc: '5 sharp bots, 25 rounds, $5,000 limit.', set: { bots: 5, rounds: 25, level: 'hard', maxBet: 5000, matchBets: true } },
    { id: 'practice', name: 'Practice', desc: '2 easy bots, free betting, hints on, no end.', set: { bots: 2, rounds: 0, level: 'easy', maxBet: 1000, matchBets: false, hint: true, timer: 0 } }
  ];
  function presetOn(p) { return Object.keys(p.set).every(function (k) { return cfg[k] === p.set[k] }) }

  /* ---------- screens and overlays ---------- */
  var screen = 'home';
  function show(id) { screen = id; ['home', 'setup', 'table', 'over'].forEach(function (s) { $(s).classList.toggle('on', s === id) }); screenMusic() }
  function overlay(id, on) { $(id).classList.toggle('on', on) }
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) { b.onclick = function () { sfx('click'); b.closest('.overlay').classList.remove('on') } });
  function icons() { Array.prototype.forEach.call(document.querySelectorAll('[data-icon]'), function (b) { b.innerHTML = BJArt.icon(b.getAttribute('data-icon')) }) }
  icons();

  /* ---------- music follows the screen and the game ---------- */
  function screenMusic() {
    if (!Au.ready() || !Au.settings().musicOn) return;
    if (screen === 'home' || screen === 'setup') Au.mood('lobby');
    else if (screen === 'over') Au.mood('end');
  }
  var unlocked = false;
  function firstGesture() {
    if (unlocked) return; unlocked = true;
    Au.unlock(); screenMusic(); if (screen === 'table' && S) roundMusic();
    refreshSoundIcon();
  }
  document.addEventListener('pointerdown', firstGesture, { once: false, passive: true });
  document.addEventListener('keydown', firstGesture, { passive: true });
  function refreshSoundIcon() { var b = $('btnSound'); if (b) b.innerHTML = BJArt.icon(Au.muted() ? 'mute' : 'sound') }
  var npT = 0;
  Au.onTrack(function (tr) {
    var el = $('nowplaying'); if (!el) return;
    el.innerHTML = BJArt.icon('music') + '<span>' + esc(tr.name) + '</span>'; el.classList.add('on'); clearTimeout(npT);
    npT = setTimeout(function () { el.classList.remove('on') }, 3800);
    if ($('ovSettings').classList.contains('on')) renderSettings();
  });

  /* ---------- home ---------- */
  function renderStats() {
    $('stats').innerHTML = '<div><b>' + stats.games + '</b>Games</div><div><b>' + stats.wins + '</b>Wins</div><div><b>' + stats.blackjacks + '</b>Blackjacks</div><div><b>' + money(stats.best) + '</b>Best stack</div>';
  }
  function renderFan() {
    var cards = [{ r: 'K', s: 'H' }, { r: 'A', s: 'S' }, { r: 'Q', s: 'D' }];
    $('fan').innerHTML = cards.map(function (c) { return '<div class="card">' + BJArt.card(c) + '</div>' }).join('');
  }
  function renderPlayer() { $('pface').innerHTML = BJArt.portrait(cfg.avatar, 'happy') }
  function renderCast() {
    var styles = { gambler: 'Gambler', steady: 'Steady', counter: 'Card counter', timid: 'Cautious' };
    $('castlist').innerHTML = BJBots.CAST.map(function (c) {
      return '<div class="castcard"><div class="cf">' + BJArt.portrait(c.key, 'neutral') + '</div><b>' + esc(c.name) + '</b><em>' + styles[c.style] + '</em><p>' + esc(c.blurb) + '</p></div>';
    }).join('');
  }
  function quickInfo() {
    $('quickInfo').textContent = cfg.bots + ' bot' + (cfg.bots === 1 ? '' : 's') + ' · ' + (cfg.rounds ? cfg.rounds + ' rounds' : 'endless') + ' · ' + (cfg.matchBets ? 'match bets' : 'free bets');
  }
  $('name').value = cfg.name;
  $('name').oninput = function () { cfg.name = $('name').value.trim().slice(0, 14); saveCfg() };
  function cycleAvatar(d) { var a = BJArt.avatars, i = (a.indexOf(cfg.avatar) + d + a.length) % a.length; cfg.avatar = a[i]; saveCfg(); renderPlayer(); sfx('click') }
  $('avPrev').onclick = function () { cycleAvatar(-1) };
  $('avNext').onclick = function () { cycleAvatar(1) };
  $('quick').onclick = function () { sfx('click'); startGame() };
  $('goSetup').onclick = function () { sfx('click'); renderSetup(); show('setup') };
  $('goHow').onclick = function () { sfx('click'); overlay('ovHow', true) };
  $('goSound').onclick = function () { sfx('click'); renderSettings(); overlay('ovSettings', true) };
  $('goCredits').onclick = function () { sfx('click'); overlay('ovCredits', true) };
  $('backHome').onclick = function () { sfx('click'); quickInfo(); show('home') };

  /* ---------- setup ---------- */
  function renderSetup() {
    $('presets').innerHTML = PRESETS.map(function (p) { return '<button class="preset' + (presetOn(p) ? ' on' : '') + '" data-p="' + p.id + '"><b>' + p.name + '</b><span>' + p.desc + '</span></button>' }).join('');
    Array.prototype.forEach.call($('presets').querySelectorAll('.preset'), function (b) {
      b.onclick = function () { var p = PRESETS.filter(function (x) { return x.id === b.getAttribute('data-p') })[0]; Object.assign(cfg, p.set); saveCfg(); sfx('click'); renderSetup() };
    });
    var panel = $('setupPanel'); panel.innerHTML = '<div class="optgrid" id="optgrid"></div>';
    var grid = $('optgrid');
    OPTIONS.forEach(function (o) {
      var box = document.createElement('div');
      var lab = document.createElement('label'); lab.className = 'row'; lab.textContent = o.label; box.appendChild(lab);
      var seg = document.createElement('div'); seg.className = 'seg';
      o.vals.forEach(function (v) {
        var b = document.createElement('button'); b.textContent = v[0]; b.className = cfg[o.key] === v[1] ? 'on' : '';
        b.onclick = function () { cfg[o.key] = v[1]; saveCfg(); sfx('click'); renderSetup() };
        seg.appendChild(b);
      });
      box.appendChild(seg);
      if (o.note && cfg[o.key] === true) { var n = document.createElement('p'); n.className = 'optnote'; n.textContent = o.note; box.appendChild(n) }
      grid.appendChild(box);
    });
  }

  /* ---------- sound and display settings ---------- */
  function renderSettings() {
    var s = Au.settings(), cur = Au.current(), body = $('settingsBody');
    function seg(id, vals, val) { return '<div class="seg" id="' + id + '">' + vals.map(function (v) { return '<button data-v="' + v[1] + '" class="' + (v[1] === val ? 'on' : '') + '">' + v[0] + '</button>' }).join('') + '</div>' }
    var html = '<div class="setrow"><label class="row">Music</label>' + seg('sMusic', [['On', 'on'], ['Off', 'off']], s.musicOn ? 'on' : 'off') +
      '<input class="range" id="vMusic" type="range" min="0" max="100" value="' + Math.round(s.music * 100) + '" aria-label="Music volume"></div>' +
      '<div class="setrow"><label class="row">Sound effects</label>' + seg('sSfx', [['On', 'on'], ['Off', 'off']], s.sfxOn ? 'on' : 'off') +
      '<input class="range" id="vSfx" type="range" min="0" max="100" value="' + Math.round(s.sfx * 100) + '" aria-label="Effects volume"></div>' +
      '<div class="setrow"><label class="row">Music tracks' + (cur ? ' · now playing ' + esc(Au.TRACKS[cur - 1].name) : '') + '</label><div class="tracks">' +
      '<button class="trk' + (s.track === 'auto' ? ' on' : '') + '" data-t="auto"><span class="n">A</span><span><b>Auto</b><small>The game picks the music to fit the moment</small></span></button>' +
      Au.TRACKS.map(function (t) { return '<button class="trk' + (String(s.track) === String(t.id) ? ' on' : '') + '" data-t="' + t.id + '"><span class="n">' + t.id + '</span><span><b>' + esc(t.name) + '</b><small>' + esc(t.mood) + ' · ' + t.bpm + ' BPM</small></span>' + (cur === t.id ? BJArt.icon('music') : '') + '</button>' }).join('') + '</div></div>' +
      '<div class="setrow"><label class="row">Card colours</label>' + seg('sCards', [['Classic', 'classic'], ['Four colours', 'four']], cfg.cards) + '</div>' +
      '<div class="setrow"><label class="row">Game speed</label>' + seg('sSpeed', [['Normal', 'normal'], ['Fast', 'fast']], cfg.speed) + '</div>';
    body.innerHTML = html;
    function wire(id, fn) { var el = $(id); if (!el) return; Array.prototype.forEach.call(el.querySelectorAll('button'), function (b) { b.onclick = function () { fn(b.getAttribute('data-v')) } }) }
    wire('sMusic', function (v) { firstGesture(); Au.set('musicOn', v === 'on'); if (v === 'on') { Au.unlock(); if (!Au.current()) screen === 'table' ? roundMusic() : screenMusic() } refreshSoundIcon(); renderSettings() });
    wire('sSfx', function (v) { firstGesture(); Au.set('sfxOn', v === 'on'); refreshSoundIcon(); renderSettings(); sfx('chip', 2) });
    wire('sCards', function (v) { cfg.cards = v; saveCfg(); BJArt.setFourColour(v === 'four'); renderSettings(); if (D) render(); renderFan() });
    wire('sSpeed', function (v) { cfg.speed = v; saveCfg(); renderSettings() });
    $('vMusic').oninput = function () { firstGesture(); Au.set('music', this.value / 100) };
    $('vSfx').oninput = function () { firstGesture(); Au.set('sfx', this.value / 100) };
    $('vSfx').onchange = function () { sfx('chip', 2) };
    Array.prototype.forEach.call(body.querySelectorAll('.trk'), function (b) {
      b.onclick = function () {
        firstGesture(); var t = b.getAttribute('data-t'); Au.set('track', t === 'auto' ? 'auto' : +t); Au.set('musicOn', true);
        if (t === 'auto') { screen === 'table' ? roundMusic() : screenMusic() } else Au.playTrack(+t);
        refreshSoundIcon(); renderSettings();
      };
    });
  }
  $('btnSound').onclick = function () { firstGesture(); Au.toggleMute(); refreshSoundIcon(); sfx('click') };
  $('menuSettings').onclick = function () { overlay('ovMenu', false); renderSettings(); overlay('ovSettings', true) };

  /* ---------- game state ---------- */
  var S = null, D = null, me = 0, botInfo = [], logs = [], chain = Promise.resolve(), gen = 0, lastBet = 0, keyHandler = null, lastSpeak = 0;
  function SP() { return cfg.speed === 'fast' ? .55 : 1 }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms * SP()) }) }
  function dead(g) { return g !== gen }
  function shuffled(a) { for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t } return a }

  function startGame() {
    firstGesture();
    var g = ++gen, n = 1 + cfg.bots;
    me = Math.floor((n - 1) / 2);
    var cast = shuffled(BJBots.CAST.slice()).slice(0, cfg.bots), bi = 0, players = [];
    botInfo = [];
    for (var i = 0; i < n; i++) {
      if (i === me) { players.push({ id: 'you', name: cfg.name || 'You' }); botInfo.push(null) }
      else { var b = cast[bi++]; players.push({ id: b.key, name: b.name, bot: true }); botInfo.push(b) }
    }
    S = BJ.newGame(players, { decks: cfg.decks, rounds: cfg.rounds || 1e9, maxBet: cfg.maxBet, surrender: cfg.surrender, matchBets: cfg.matchBets });
    logs = []; lastBet = 0; chain = Promise.resolve();
    D = {
      round: 0, of: cfg.rounds, dealer: { cards: [] }, dealerMood: 'neutral', active: null, bettor: -1, high: 0, betting: false,
      seats: S.players.map(function (p, i) { return { name: p.name, key: p.id, face: i === me ? cfg.avatar : p.id, bot: !!p.bot, mood: 'neutral', chips: p.chips, bet: 0, hands: [], out: false, folded: false, tag: '', ins: 0, sat: false, hideBet: false, _net: 0 } })
    };
    $('stage').innerHTML = '<div class="rail"></div><div class="felt">' + ARCS + '</div><div id="scene"></div><div id="fx"><div class="say" id="say"></div></div>';
    $('barRound').textContent = 'Blackjack 21';
    $('barLimits').textContent = 'Table ' + money(S.opts.minBet) + ' – ' + money(S.opts.maxBet);
    show('table'); overlay('ovMenu', false); overlay('ovSettings', false);
    render(); setIdle('Shuffling up'); refreshSoundIcon();
    run(g);
  }

  /* ---------- drawing the table ---------- */
  var ARCS = '<svg class="arcs" viewBox="0 0 600 160" aria-hidden="true">' +
    '<path id="arcA" d="M 40 120 Q 300 -20 560 120" fill="none"/><path id="arcB" d="M 90 150 Q 300 50 510 150" fill="none"/>' +
    '<text font-size="24"><textPath href="#arcA" startOffset="50%" text-anchor="middle">Blackjack pays 3 to 2</textPath></text>' +
    '<text class="a2"><textPath href="#arcB" startOffset="50%" text-anchor="middle">Insurance pays 2 to 1</textPath></text>' +
    '<text class="a3" x="300" y="158" text-anchor="middle">Dealer stands on all 17s</text></svg>';
  var SIZES = { 1: [60, 28], 2: [58, 27], 3: [50, 25], 4: [44, 23], 5: [38, 21], 6: [34, 19] };
  function seatPos(i, n) {
    var x = n === 1 ? .5 : .1 + .8 * i / (n - 1), k = (2 * x - 1);
    return { x: x * 100, y: 82 - 26 * k * k };
  }
  function handBadge(h) {
    var v = BJ.handValue(h.cards), cls = '', txt;
    if (h.result) {
      var net = h.net > 0 ? ' +' + h.net : h.net < 0 ? ' -' + (-h.net) : '';
      if (h.result === 'bust') { cls = 'lose'; txt = 'BUST' + net }
      else if (h.result === 'blackjack') { cls = 'win'; txt = 'BLACKJACK' + net }
      else if (h.result === 'win') { cls = 'win'; txt = 'WIN' + net }
      else if (h.result === 'push') { cls = 'push'; txt = 'PUSH' }
      else if (h.result === 'surrender') { cls = 'surr'; txt = 'SURRENDER' + net }
      else { cls = 'lose'; txt = 'LOSE' + net }
    } else if (v.total > 21) { cls = 'bust'; txt = 'BUST' }
    else if (h.natural) { cls = 'bj'; txt = 'BLACKJACK' }
    else txt = (v.soft && v.total < 21 ? 'soft ' : '') + v.total;
    return '<div class="badge ' + cls + '">' + txt + '</div>';
  }
  function cardHTML(c, i, n) {
    var cls = 'card' + (c._new ? ' new' : '') + (c._flip ? ' flip' : ''), mid = (n - 1) / 2, d = i - mid;
    c._new = c._flip = false;
    return '<div class="' + cls + '" style="--r:' + (d * 2.2).toFixed(1) + 'deg;--y:' + (Math.abs(d) * 1.4).toFixed(1) + 'px">' + (c.hidden ? BJArt.back() : BJArt.card(c)) + '</div>';
  }
  function cardsHTML(cards) { return cards.map(function (c, i) { return cardHTML(c, i, cards.length) }).join('') }
  var TAGS = { open: 'Opens', call: 'Call', raise: 'Raise', allin: 'All in', fold: 'Fold', wait: 'Betting' };
  function seatHTML(i) {
    var st = D.seats[i], n = D.seats.length, p = seatPos(i, n), turn = (D.active && D.active.seat === i) || (D.betting && D.bettor === i);
    var h = st.hands.map(function (hd, k) {
      return '<div class="hand' + (D.active && D.active.seat === i && D.active.hand === k ? ' active' : '') + '"><div class="cards">' + cardsHTML(hd.cards) + '</div>' +
        (hd.cards.length ? handBadge(hd) : '') + (st.hands.length > 1 ? '<div class="hbet">' + money(hd.bet) + '</div>' : '') + '</div>';
    }).join('');
    var spot = st.hideBet ? '' : BJArt.stack(st.bet, BJ);
    var label = st.out ? 'out' : st.folded ? 'folded' : st.sat ? 'sitting out' : money(st.chips);
    var nm = n >= 5 && i !== me ? st.name.split(' ').pop() : st.name;
    var tag = D.betting && D.bettor === i && !st.tag ? 'wait' : st.tag;
    return '<div class="seat n' + n + (i === me ? ' me' : '') + (turn ? ' turn' : '') + (st.out ? ' out' : '') + (st.folded ? ' folded' : '') + '" data-seat="' + i + '" style="left:' + p.x + '%;top:' + p.y + '%;width:' + (100 / (n + .6)) + '%">' +
      '<div class="hands">' + h + '</div>' +
      '<div class="spot">' + spot + (st.bet && !st.hideBet ? '<span class="tot">' + money(st.bet) + '</span>' : '') + (st.ins ? '<span class="ins">INS ' + st.ins + '</span>' : '') + '</div>' +
      '<div class="plate">' + (tag ? '<span class="stag ' + tag + '">' + TAGS[tag] + '</span>' : '') + '<div class="pf">' + BJArt.portrait(st.face, st.mood) + '</div>' +
      '<div class="t"><div class="nm">' + esc(nm) + '</div><div class="ch num">' + label + '</div></div></div></div>';
  }
  function render() {
    if (!D) return;
    var dv = BJ.handValue(D.dealer.cards.filter(function (c) { return !c.hidden }));
    var dBust = dv.total > 21, shown = D.dealer.cards.length ? '<div class="badge' + (dBust ? ' bust' : '') + '">' + (dBust ? 'BUST' : dv.total) + '</div>' : '';
    var n = D.seats.length, sz = SIZES[n], k = Math.max(.8, Math.min(1.6, $('stage').clientWidth / 380, $('stage').clientHeight / 500));
    var used = 100 - Math.round(Math.max(0, Math.min(1, S.shoe.length / (S.opts.decks * 52))) * 100);
    var html = '<div class="shoe"><div class="box" style="--used:' + used + '%"></div>Shoe</div>' +
      '<div class="dealer"><div class="portrait">' + BJArt.portrait('dealer', D.dealerMood) + '</div><div class="nm">DEALER</div><div class="hand"><div class="cards">' + cardsHTML(D.dealer.cards) + '</div>' + shown + '</div></div>' +
      (D.betting && D.high > 0 ? '<div class="tablebet">Table bet ' + money(D.high) + '</div>' : '');
    for (var i = 0; i < n; i++) html += seatHTML(i);
    var sc = $('scene'); sc.style.cssText = '--cw:' + Math.round(sz[0] * k) + 'px;--chip:' + Math.round(sz[1] * Math.min(k, 1.35)) + 'px;--ov:' + (n <= 4 ? .34 : .55);
    sc.innerHTML = html;
    $('barRound').textContent = D.round ? 'Round ' + D.round + (D.of ? ' of ' + D.of : '') : 'Blackjack 21';
  }
  function seatEl(i, part) { return document.querySelector('#scene .seat[data-seat="' + i + '"] ' + (part || '')) }
  function floatAt(i, text, cls) {
    var p = seatPos(i, D.seats.length), el = document.createElement('div');
    el.className = 'float ' + cls; el.textContent = text; el.style.left = p.x + '%'; el.style.top = (p.y - 16) + '%';
    $('fx').appendChild(el); setTimeout(function () { el.remove() }, 1600);
  }
  var toastEl = null, toastT = 0, sayT = 0;
  function toast(text, ms) {
    if (!toastEl || !toastEl.isConnected) { toastEl = document.createElement('div'); toastEl.className = 'toast'; $('stage').parentNode.appendChild(toastEl) }
    toastEl.textContent = text; toastEl.classList.add('on'); clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('on') }, ms || 1200);
  }
  // the dealer talks: a small speech bubble beside the portrait
  function say(text, ms) {
    var el = $('say'); if (!el) return;
    el.textContent = text; el.classList.add('on'); clearTimeout(sayT);
    sayT = setTimeout(function () { el.classList.remove('on') }, ms || 1800);
  }
  // a bot says something in character
  function speak(i, topic, prob) {
    var st = D.seats[i]; if (!st || !st.bot || i === me) return;
    if (Math.random() > (prob == null ? .45 : prob)) return;
    var now = Date.now(); if (now - lastSpeak < 700) return;
    var txt = BJBots.line(st.key, topic); if (!txt) return;
    lastSpeak = now;
    var p = seatPos(i, D.seats.length), el = document.createElement('div');
    el.className = 'bubble'; el.textContent = txt; el.style.left = Math.max(14, Math.min(86, p.x)) + '%'; el.style.top = (p.y - 20) + '%';
    $('fx').appendChild(el); setTimeout(function () { el.remove() }, 2300);
  }
  // chips flying from one element to another (screen coordinates, so it works through the table tilt)
  function flyChips(from, to, value, count) {
    if (!from || !to) return;
    var a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), layer = $('flight'), size = 26;
    for (var i = 0; i < count; i++) (function (i) {
      var w = document.createElement('div'); w.innerHTML = BJArt.chip(value); var c = w.firstChild;
      c.style.cssText = '--chip:' + size + 'px;position:fixed;left:' + (a.left + a.width / 2 - size / 2 + (i - 1) * 4) + 'px;top:' + (a.top + a.height / 2 - size / 2 - i * 3) + 'px;opacity:1';
      layer.appendChild(c);
      setTimeout(function () { c.style.transform = 'translate(' + (b.left + b.width / 2 - a.left - a.width / 2) + 'px,' + (b.top + b.height / 2 - a.top - a.height / 2) + 'px)' }, 30 + i * 80);
      setTimeout(function () { c.style.opacity = '0' }, 480 + i * 80);
      setTimeout(function () { c.remove() }, 1050 + i * 80);
    })(i);
  }
  function chipFor(amount) { var v = BJ.CHIPS.slice().reverse().find(function (c) { return c <= amount }); return v || 10 }

  /* ---------- music that fits the moment ---------- */
  function roundMusic() {
    if (!Au.ready() || !Au.settings().musicOn || !S) return;
    var r = D ? D.round : 0, of = cfg.rounds, p = S.players[me];
    if (of && r >= of && r > 1) Au.mood('end');
    else if (of && r > of - 3 && of >= 5) Au.mood('final');
    else if (p && p.streak >= 2) Au.mood('streak');
    else Au.mood(r % 2 ? 'calm' : 'action');
  }

  /* ---------- turning engine events into the staged display ---------- */
  function play(evs) { var g = gen; chain = chain.then(function () { return applyEvents(evs, g) }); return chain }
  async function applyEvents(evs, g) {
    for (var k = 0; k < evs.length; k++) { if (dead(g)) return; await applyEvent(evs[k], g) }
  }
  function syncChips() { S.players.forEach(function (p, i) { D.seats[i].chips = p.chips }) }
  function chipCount(amount) { var parts = BJ.chipsFor(amount), n = 0; Object.keys(parts).forEach(function (k) { n += parts[k] }); return n }
  async function applyEvent(e, g) {
    var st = e.seat >= 0 && e.seat != null ? D.seats[e.seat] : null, h;
    switch (e.t) {
      case 'round':
        D.round = e.n; D.of = cfg.rounds; D.dealer = { cards: [] }; D.dealerMood = 'neutral'; D.active = null; D.high = 0; D.betting = true; D.bettor = e.opener != null ? e.opener : -1;
        logs.push('<b>Round ' + e.n + '</b>');
        D.seats.forEach(function (s) { s.hands = []; s.bet = 0; s.ins = 0; s.sat = false; s.hideBet = false; s._net = 0; s.mood = 'neutral'; s.folded = false; s.tag = '' });
        syncChips(); render(); say('Place your bets, please', 2200); roundMusic();
        if (D.bettor >= 0 && D.bettor !== me) speak(D.bettor, 'hello', .35);
        break;
      case 'shuffle': toast('Shuffling the shoe', 1100); say('Shuffling…', 1300); sfx('shuffle'); render(); await wait(1000); break;
      case 'out': st.out = true; render(); break;
      case 'rebuy': st.chips = S.players[e.seat].chips; render(); toast(st.name + ' rebuys ' + money(e.amount), 1200); sfx('chips'); break;
      case 'bet':
        st.bet = e.amount; st.hideBet = false; st.chips = S.players[e.seat].chips; st.sat = e.amount === 0 && !S.opts.matchBets; st.folded = e.kind === 'fold'; st.tag = e.kind === 'bet' ? '' : e.kind;
        if (e.high != null) D.high = e.high;
        if (e.next != null) D.bettor = e.next;
        render();
        if (e.kind === 'fold') { sfx('fold'); speak(e.seat, 'fold', .55) }
        else if (e.amount > 0) {
          sfx('chip', Math.min(4, chipCount(e.amount)));
          if (e.seat !== me) flyChips(seatEl(e.seat, '.plate'), seatEl(e.seat, '.spot'), chipFor(e.amount), 2);
          if (e.kind === 'allin') speak(e.seat, 'allin', .9); else if (e.kind === 'raise') speak(e.seat, 'raise', .8);
          else if (e.amount >= S.opts.maxBet / 2) speak(e.seat, 'big', .5);
        }
        await wait(e.seat === me ? 160 : 380); break;
      case 'betsDone':
        D.bettor = -1; render();
        var mp = S.players[me];
        if (mp && mp.bet > 0 && e.high >= (mp.chips + mp.bet) * .5 && !(cfg.rounds && D.round > cfg.rounds - 3) && Au.ready()) Au.mood('big');
        break;
      case 'betsClosed':
        say('No more bets', 1200); D.betting = false; D.bettor = -1; D.seats.forEach(function (s) { s.tag = '' });
        e.seats.forEach(function (i) { D.seats[i].hands = [{ cards: [], bet: D.seats[i].bet, result: null }] });
        D.seats.forEach(function (s, i) { if (e.seats.indexOf(i) < 0 && !s.out) { s.sat = !S.opts.matchBets || !s.folded; if (s.folded) s.sat = false } });
        render(); await wait(300); break;
      case 'noBets': toast('No bets this round', 1200); break;
      case 'deal':
        if (e.seat === -1) D.dealer.cards.push(e.hidden ? { hidden: true, _new: true } : Object.assign({ _new: true }, e.card));
        else st.hands[e.hand].cards.push(Object.assign({ _new: true }, e.card));
        sfx('deal'); render(); await wait(340); break;
      case 'reveal':
        D.dealer.cards[1] = Object.assign({ _flip: true }, e.card); setStatus('Dealer plays'); sfx('flip'); render();
        // tension when the player has a good hand riding on the dealer
        var me_ = S.players[me], mh = me_.hands && me_.hands[0];
        if (mh && !mh.natural && !mh.surrendered && BJ.handValue(mh.cards).total >= 18 && BJ.handValue(mh.cards).total <= 21 && me_.inRound && !(cfg.rounds && D.round > cfg.rounds - 3) && Au.ready()) Au.mood('tense');
        await wait(700); break;
      case 'peek': say('Dealer checks for blackjack', 1400); await wait(800); break;
      case 'insuranceOffer': say('Insurance?', 1400); break;
      case 'insurance': st.ins = e.amount; st.chips -= e.amount; sfx('chip', 1); render(); break;
      case 'noInsurance': break;
      case 'insuranceLost': st.ins = 0; floatAt(e.seat, '-' + e.amount, 'lose'); render(); break;
      case 'insuranceWon': st.ins = 0; st.chips += e.amount; floatAt(e.seat, '+' + (e.amount * 2 / 3), 'win'); render(); break;
      case 'turn': D.active = { seat: e.seat, hand: e.hand }; render(); if (e.seat === me) sfx('turn'); break;
      case 'stand': break;
      case 'surrender': toast(st.name + ' surrenders', 1000); st.mood = 'worried'; sfx('surrender'); speak(e.seat, 'surrender', .9); break;
      case 'double': h = st.hands[e.hand]; st.chips -= h.bet; st.bet += h.bet; h.bet = e.bet; toast(st.name + ' doubles down', 900); sfx('chip', 3); speak(e.seat, 'double', .6); render(); await wait(300); break;
      case 'split': h = st.hands[e.hand]; st.chips -= e.bet; st.bet += e.bet;
        st.hands.splice(e.hand + 1, 0, { cards: [h.cards.pop()], bet: e.bet, result: null }); toast(st.name + ' splits', 900); sfx('chip', 3); speak(e.seat, 'split', .6); render(); await wait(450); break;
      case 'handDone': render(); break;
      case 'settle':
        h = st.hands[e.hand]; h.result = e.result; h.net = e.net; st.chips += e.payout; st._net += e.net;
        floatAt(e.seat, e.net > 0 ? '+' + money(e.net) : e.net < 0 ? '-' + money(-e.net) : 'Push', e.net > 0 ? 'win' : e.net < 0 ? 'lose' : 'push');
        var last = e.hand === st.hands.length - 1, spotEl = seatEl(e.seat, '.spot'), dealerEl = document.querySelector('#scene .dealer .portrait'), plateEl = seatEl(e.seat, '.plate');
        if (last) st.mood = st._net > 0 ? 'happy' : st._net < 0 ? 'sad' : 'neutral';
        if (e.result === 'blackjack') { st.mood = 'happy'; if (e.seat === me) sfx('blackjack'); speak(e.seat, 'bj', .85) }
        else if (e.result === 'bust' && e.seat === me) sfx('bust');
        else if (e.result === 'bust') speak(e.seat, 'bust', .6);
        else if (e.result === 'win') speak(e.seat, 'win', .4);
        else if (e.result === 'lose') speak(e.seat, 'lose', .35);
        render();
        if (last) {
          var total = st._net, v = chipFor(Math.abs(total) || st.bet);
          if (total < 0) { flyChips(spotEl, dealerEl, v, 3); sfx('chipsTake'); if (e.seat === me && e.result !== 'bust') sfx('lose'); st.hideBet = true }
          else if (total > 0) { flyChips(dealerEl, spotEl, v, 3); sfx('chipsPay'); if (e.seat === me && e.result === 'win') sfx('win'); await wait(520); flyChips(seatEl(e.seat, '.spot'), seatEl(e.seat, '.plate'), v, 3); st.hideBet = true }
          else { flyChips(spotEl, plateEl, chipFor(st.bet), 2); sfx('push'); st.hideBet = true }
          render();
        }
        await wait(e.seat === me ? 750 : 420); break;
      case 'roundEnd':
        D.active = null;
        var wins = 0, losses = 0;
        S.players.forEach(function (p) { p.hands.forEach(function (x) { if (x.result === 'win' || x.result === 'blackjack') wins++; else if (x.result === 'lose' || x.result === 'bust' || x.result === 'surrender') losses++ }) });
        D.dealerMood = e.dealerBJ ? 'happy' : e.dealerBust ? 'sad' : losses > wins ? 'smug' : wins > losses ? 'worried' : 'neutral';
        if (e.dealerBJ) sfx('dealerBlackjack');
        say(e.dealerBJ ? 'Dealer has blackjack' : e.dealerBust ? 'Dealer busts with ' + e.dealer : 'Dealer has ' + e.dealer, 2000);
        var res = S.players[me].hands.map(function (x) { return x.result }).join(', ');
        if (res) logs.push(esc(D.seats[me].name) + ': ' + res + ' (dealer ' + (e.dealerBust ? 'bust' : e.dealer) + (e.dealerBJ ? ', blackjack' : '') + ')');
        render(); await wait(450);
        D.seats.forEach(function (s) { s.bet = 0; s.hideBet = false; s.ins = 0; s.tag = '' });
        syncChips(); render(); break;
      case 'over': D.active = null; render(); break;
    }
  }

  /* ---------- human controls ---------- */
  var stopTimer = function () {};
  function setKeys(fn) { keyHandler = fn }
  document.addEventListener('keydown', function (ev) { if (keyHandler && !ev.metaKey && !ev.ctrlKey && !(ev.target && ev.target.tagName === 'INPUT')) keyHandler(ev) });
  function setIdle(text) { stopTimer(); setKeys(null); $('controls').innerHTML = '<div class="status">' + esc(text || '') + '</div>' }
  function setStatus(text) { if (!$('controls').querySelector('button')) setIdle(text) }
  function timer(sec, done) {
    var bar = $('controls').querySelector('.timer');
    if (!sec || !bar) { if (bar) bar.style.visibility = 'hidden'; return function () {} }
    var i = bar.firstElementChild; i.style.transition = 'none'; i.style.transform = 'scaleX(1)'; void i.offsetWidth;
    i.style.transition = 'transform ' + sec + 's linear'; i.style.transform = 'scaleX(0)';
    var t = setTimeout(done, sec * 1000), low = setTimeout(function () { bar.classList.add('low') }, Math.max(0, sec - 5) * 1000), tk = setTimeout(function tick() { sfx('tick'); tk = setTimeout(tick, 1000) }, Math.max(0, sec - 5) * 1000);
    return function () { clearTimeout(t); clearTimeout(low); clearTimeout(tk) };
  }
  function bind(id, fn) { var el = $(id); if (el) el.onclick = function () { fn() } }

  // The human's turn to bet. mode: 'open' (set the table bet), 'free' (free betting), or facing a bet (call / raise / all in / fold).
  function askBetTurn(g) {
    return new Promise(function (resolve) {
      var my = 0, mode = null;
      function finish(a) { stopTimer(); setKeys(null); resolve(a) }
      function previewBet() { var s = D.seats[me], p = S.players[me]; s.bet = my; s.hideBet = false; s.sat = false; s.chips = p.chips + p.bet - my; render() }
      function ui() {
        var v = BJ.view(S, me), p = S.players[me], cc = $('controls');
        if (v.needsRebuy) {
          cc.innerHTML = '<div class="timer"><i></i></div><div class="status">You are out of chips</div><div class="ctl-row"><button class="btn" id="rb">Rebuy ' + money(S.opts.rebuyAmount) + '</button><button class="btn ghost" id="rs">Sit out</button></div>';
          bind('rb', function () { stopTimer(); sfx('chips'); play(BJ.rebuy(S, me)); my = 0; ui() }); bind('rs', function () { finish(0) });
          stopTimer = timer(cfg.timer, function () { finish(0) }); return;
        }
        var o = S.opts.matchBets ? v.betOpts : { high: 0, min: S.opts.minBet, max: v.maxBet, mayOpen: v.maxBet >= S.opts.minBet, canFold: true };
        if (!o || (o.high === 0 && !o.mayOpen)) { finish(0); return }
        if (o.high > 0 && mode === null) mode = 'choice';
        if (o.high === 0) mode = S.opts.matchBets ? 'open' : 'free';
        if (mode === 'choice') choice(o); else builder(o);
      }
      function choice(o) {
        var cc = $('controls');
        function b(id, label, cls, key, on) { return on ? '<button class="act ' + cls + '" id="' + id + '">' + label + '<small>' + key + '</small></button>' : '' }
        cc.innerHTML = '<div class="timer"><i></i></div><div class="status">Table bet ' + money(o.high) + (o.canCall ? '' : ' · you have ' + money(S.players[me].chips + S.players[me].bet)) + '</div>' +
          '<div class="hint">' + (o.canCall ? 'Match it, raise, or fold out of this round' : 'You cannot cover it: go all in or fold') + '</div>' +
          '<div class="ctl-row acts">' + b('cCall', 'Call ' + money(o.high), 'hit', 'C', o.canCall) + b('cAll', 'All in ' + money(o.allIn), 'stand', 'A', !o.canCall && o.allIn) +
          b('cRaise', 'Raise', 'double', 'R', o.canRaise) + b('cFold', 'Fold', 'no', 'F', true) + '</div>';
        bind('cCall', function () { finish(o.high) }); bind('cAll', function () { finish(o.allIn) }); bind('cFold', function () { finish(0) });
        bind('cRaise', function () { mode = 'raise'; my = o.high; stopTimer(); ui(); previewBet() });
        setKeys(function (ev) { var k = ev.key.toLowerCase(); if (k === 'c' && o.canCall) finish(o.high); else if (k === 'a' && !o.canCall && o.allIn) finish(o.allIn); else if (k === 'r' && o.canRaise) { mode = 'raise'; my = o.high; stopTimer(); ui(); previewBet() } else if (k === 'f') finish(0) });
        stopTimer(); stopTimer = timer(cfg.timer, function () { finish(0) });
      }
      function builder(o) {
        var cc = $('controls'), p = S.players[me], raising = mode === 'raise', floor = raising ? o.high : 0, min = raising ? o.high + 10 : o.min, max = o.max;
        if (my < floor) my = floor; if (my > max) my = max;
        var allInNow = max === Math.floor((p.chips + p.bet) / 10) * 10;
        var chips = BJ.CHIPS.map(function (c) { return '<button class="chipbtn" data-c="' + c + '" aria-label="' + money(c) + ' chip"' + (my + c > max ? ' disabled' : '') + '>' + BJArt.chip(c) + '</button>' }).join('');
        var msg = raising ? 'Raise above the table bet of ' + money(o.high) : mode === 'open' ? 'You open the betting. Everyone must match your bet or fold.' : '';
        var okLabel = raising ? 'Raise to ' + money(my) : mode === 'open' ? 'Bet' : 'Deal';
        cc.innerHTML = '<div class="timer"><i></i></div>' + (msg ? '<div class="hint">' + msg + '</div>' : '') + '<div class="ctl-row">' + chips + '</div>' +
          '<div class="ctl-row"><button class="btn dark sm" id="bClr">Clear</button>' +
          (raising ? '' : '<button class="btn dark sm" id="bRep"' + (lastBet < min || lastBet > max ? ' disabled' : '') + '>Rebet' + (lastBet ? ' ' + money(lastBet) : '') + '</button>') +
          '<button class="btn dark sm" id="bX2"' + (my === 0 || my * 2 > max ? ' disabled' : '') + '>Double bet</button><button class="btn dark sm" id="bAll">' + (allInNow ? 'All in' : 'Max bet') + '</button></div>' +
          '<div class="ctl-row"><button class="btn ghost" id="bSit">' + (raising ? 'Back' : mode === 'open' ? 'Fold' : 'Sit out') + '</button><div class="amount"><small>' + (raising ? 'Raise to' : 'Your bet') + '</small><b class="num">' + money(my) + '</b></div><button class="btn lg" id="bDeal"' + (my < min ? ' disabled' : '') + '>' + okLabel + '</button></div>';
        Array.prototype.forEach.call(cc.querySelectorAll('.chipbtn'), function (b) {
          b.onclick = function () { var c = +b.getAttribute('data-c'); flyChips(b, seatEl(me, '.spot'), c, 1); sfx('chip', 1); my += c; previewBet(); builder(o) };
        });
        bind('bClr', function () { sfx('click'); my = floor; previewBet(); builder(o) });
        bind('bRep', function () { sfx('click'); my = lastBet; previewBet(); builder(o) });
        bind('bX2', function () { sfx('chip', 2); my *= 2; previewBet(); builder(o) });
        bind('bAll', function () { sfx('chips'); my = max; previewBet(); builder(o) });
        bind('bSit', function () { sfx('click'); if (raising) { mode = 'choice'; my = 0; D.seats[me].bet = 0; D.seats[me].chips = p.chips + p.bet; render(); ui() } else { my = 0; previewBet(); finish(0) } });
        function confirm() { if (my < min) return; if (!raising) lastBet = my; finish(my) }
        bind('bDeal', confirm);
        setKeys(function (ev) { if (ev.key === 'Enter') confirm() });
        stopTimer(); stopTimer = timer(cfg.timer, function () { if (my >= min && !raising) { lastBet = my; finish(my) } else finish(0) });
      }
      ui();
    });
  }

  function askIns(g) {
    return new Promise(function (resolve) {
      var p = S.players[me], cost = p.bet / 2;
      function finish(t) { stopTimer(); setKeys(null); resolve(t) }
      $('controls').innerHTML = '<div class="timer"><i></i></div><div class="status">Dealer shows an Ace. Insurance costs ' + money(cost) + ' and pays 2 to 1.</div>' +
        '<div class="ctl-row"><button class="act yes" id="iY">Insure<small>Y</small></button><button class="act no" id="iN">No thanks<small>N</small></button></div>';
      bind('iY', function () { finish('insurance') }); bind('iN', function () { finish('noinsurance') });
      setKeys(function (ev) { if (ev.key === 'y') finish('insurance'); if (ev.key === 'n') finish('noinsurance') });
      stopTimer = timer(cfg.timer, function () { finish('noinsurance') });
    });
  }

  var HINT = { hit: 'Hit', stand: 'Stand', double: 'Double down', split: 'Split', surrender: 'Surrender' };
  function askTurn(g) {
    return new Promise(function (resolve) {
      var v = BJ.view(S, me), l = v.legal, hint = '';
      if (cfg.hint) { try { hint = '<div class="hint">Basic strategy: ' + HINT[BJBots.basic(v, BJ)] + '</div>' } catch (e) {} }
      function finish(t) { stopTimer(); setKeys(null); resolve(t) }
      function b(t, label, cls, key) { return '<button class="act ' + cls + '" id="a_' + t + '"' + (l.indexOf(t) < 0 ? ' disabled' : '') + '>' + label + '<small>' + key + '</small></button>' }
      var row = b('hit', 'Hit', 'hit', 'H') + b('stand', 'Stand', 'stand', 'S') + b('double', 'Double', 'double', 'D') + b('split', 'Split', 'split', 'P') + (S.opts.surrender ? b('surrender', 'Surrender', 'surr', 'R') : '');
      $('controls').innerHTML = '<div class="timer"><i></i></div><div class="status">Your move</div>' + hint + '<div class="ctl-row acts">' + row + '</div>';
      ['hit', 'stand', 'double', 'split', 'surrender'].forEach(function (t) { bind('a_' + t, function () { if (l.indexOf(t) >= 0) finish(t) }) });
      var keys = { h: 'hit', s: 'stand', d: 'double', p: 'split', r: 'surrender' };
      setKeys(function (ev) { var t = keys[ev.key.toLowerCase()]; if (t && l.indexOf(t) >= 0) finish(t) });
      stopTimer = timer(cfg.timer, function () { finish('stand') });
    });
  }

  /* ---------- the game loop ---------- */
  async function run(g) {
    try {
      play(BJ.startRound(S));
      while (!dead(g)) {
        await chain; if (dead(g)) return;
        var ph = S.phase;
        if (ph === 'bet') await betPhase(g);
        else if (ph === 'insurance') await insPhase(g);
        else if (ph === 'turn') await turnPhase(g);
        else if (ph === 'roundEnd') await endPhase(g);
        else if (ph === 'over') { showOver(g); return }
        else await wait(100);
      }
    } catch (err) { console.error(err) }
  }

  async function botBet(seat, g) {
    var info = botInfo[seat], d = BJBots.decide(BJ.view(S, seat), BJ, info.key, cfg.level, Math.random);
    if (d && d.type === 'rebuy') { play(BJ.rebuy(S, seat)); d = BJBots.decide(BJ.view(S, seat), BJ, info.key, cfg.level, Math.random) }
    play(BJ.bet(S, seat, d && d.type === 'bet' ? d.amount : 0));
  }

  async function betPhase(g) {
    var human = S.players[me];
    if (S.opts.matchBets) {
      // betting goes round the table, one seat at a time
      while (S.phase === 'bet' && S.bettor >= 0 && !dead(g)) {
        var seat = S.bettor;
        if (seat === me) {
          await chain; if (dead(g)) return;
          var amount = await askBetTurn(g); if (dead(g)) return;
          setIdle(''); play(BJ.bet(S, me, amount));
        } else {
          setIdle(S.players[seat].name + ' is betting');
          await wait(600 + rnd(450)); if (dead(g)) return;
          await botBet(seat, g);
        }
        await chain;
      }
    } else {
      setIdle('Place your bets');
      var botsDone = (async function () {
        for (var i = 0; i < S.players.length; i++) {
          if (i === me || S.players[i].out) continue;
          if (dead(g)) return;
          await botBet(i, g); await wait(220);
        }
      })();
      var amt = 0;
      if (!human.out) amt = await askBetTurn(g); else setIdle("You're out of chips. Watching the table");
      if (dead(g)) return;
      await botsDone;
      if (!human.out) play(BJ.bet(S, me, amt));
    }
    await chain; if (dead(g)) return;
    setIdle(human.out ? "You're out of chips. Watching the table" : human.bet > 0 ? 'Dealing' : 'You sit this round out');
    play(BJ.closeBets(S));
  }

  async function insPhase(g) {
    while (S.phase === 'insurance' && !dead(g)) {
      var seat = S.pending[0], t;
      await chain; if (dead(g)) return;
      if (seat === me) t = await askIns(g);
      else { await wait(350); t = BJBots.decide(BJ.view(S, seat), BJ, botInfo[seat].key, cfg.level, Math.random).type }
      if (dead(g)) return;
      setIdle('');
      play(BJ.act(S, seat, t));
    }
  }

  async function turnPhase(g) {
    var seat = S.turn.seat, t;
    if (seat === me) t = await askTurn(g);
    else {
      setIdle(S.players[seat].name + ' is deciding');
      await wait(650 + rnd(500)); if (dead(g)) return;
      t = BJBots.decide(BJ.view(S, seat), BJ, botInfo[seat].key, cfg.level, Math.random).type;
    }
    if (dead(g)) return;
    setIdle('');
    play(BJ.act(S, seat, t));
  }

  async function endPhase(g) {
    var p = S.players[me], txt = '';
    if (p.hands.length) {
      var net = p.hands.reduce(function (a, h) { return a + (h.payout - h.bet) }, 0);
      txt = net > 0 ? 'You won ' + money(net) : net < 0 ? 'You lost ' + money(-net) : 'Push';
    } else txt = 'Next round';
    setIdle(txt);
    await wait(1700); if (dead(g)) return;
    play(BJ.nextRound(S));
  }

  function showOver(g) {
    if (dead(g)) return;
    var st = S.standings, win = S.winner === me, p = S.players[me];
    stats.games++; if (win) stats.wins++; stats.blackjacks += p.stats.blackjacks; stats.best = Math.max(stats.best, p.stats.peak); save('bj-stats', stats);
    $('crown').innerHTML = BJArt.icon(win ? 'crown' : 'spade');
    $('overTitle').textContent = win ? 'You win' : S.players[S.winner].name + ' wins';
    $('overSub').textContent = win ? 'Top of the table with ' + money(p.chips) : 'You finished with ' + money(p.chips);
    $('standings').innerHTML = st.map(function (r, i) {
      var pl = S.players[r.seat], face = r.seat === me ? cfg.avatar : pl.id;
      return '<li class="' + (i === 0 ? 'first' : '') + '"><span class="pos">' + (i + 1) + '</span><div class="pf">' + BJArt.portrait(face, i === 0 ? 'happy' : 'neutral') + '</div>' +
        '<span class="nm">' + esc(pl.name) + (r.seat === me && pl.name !== 'You' ? ' (you)' : '') + '</span><span class="ch num">' + money(r.chips) + '</span></li>';
    }).join('');
    $('mystats').innerHTML = '<div><b>' + p.stats.wins + '</b>Hands won</div><div><b>' + p.stats.blackjacks + '</b>Blackjacks</div><div><b>' + money(p.stats.biggestWin) + '</b>Biggest win</div><div><b>' + money(p.stats.peak) + '</b>Peak stack</div>';
    stopTimer(); setKeys(null);
    show('over');
    sfx(win ? 'blackjack' : 'lose');
  }

  /* ---------- menus ---------- */
  $('btnHelp').onclick = function () { sfx('click'); overlay('ovHow', true) };
  $('btnMenu').onclick = function () { sfx('click'); overlay('ovMenu', true) };
  $('btnLog').onclick = function () { sfx('click'); $('logBody').innerHTML = logs.length ? logs.slice().reverse().map(function (l) { return '<div>' + l + '</div>' }).join('') : '<div>Nothing yet.</div>'; overlay('ovLog', true) };
  $('quit').onclick = function () { gen++; stopTimer(); setKeys(null); overlay('ovMenu', false); renderStats(); quickInfo(); show('home') };
  $('start').onclick = function () { sfx('click'); startGame() };
  $('again').onclick = function () { sfx('click'); startGame() };
  $('overSetup').onclick = function () { sfx('click'); renderSetup(); show('setup') };
  $('overHome').onclick = function () { sfx('click'); renderStats(); quickInfo(); show('home') };

  var rt = 0; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(render, 150) });
  BJArt.init();
  renderStats(); renderFan(); renderPlayer(); renderCast(); quickInfo(); refreshSoundIcon();
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () {});
  window.__BJ = { get S() { return S }, get D() { return D }, cfg: cfg, startGame: startGame };   // debug handle for automated tests
})();
