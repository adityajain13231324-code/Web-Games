/* Liar's Call: table client, host driver (bots + online host), guest driver, home and lobby.
   The table never reads the full game state: it animates events and redraws from a "view",
   which is exactly what one seat may see. That is what makes online play safe and simple. */
(function () {
  'use strict';
  var A = window.LCArt, AU = window.LCAudio, BOT = window.LCBots;
  var $ = function (id) { return document.getElementById(id) };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v ? Object.assign({}, d, v) : d } catch (e) { return d } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }
  function rnd(a) { return a[Math.floor(Math.random() * a.length)] }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }

  var settings = load('lc-settings', { char: 'sharma', n: 4, level: 'normal', timer: 30, name: '', theme: 'wedding', fit: {}, voice: true });
  var stats = load('lc-stats', { games: 0, wins: 0, streak: 0, best: 0, online: 0, cw: {} });
  if (!settings.fit) settings.fit = {};
  if (!stats.cw) stats.cw = {};
  var UNLOCK = 2;                                   // wins as a character to unlock their shaadi look
  function unlocked(k) { return (stats.cw[k] || 0) >= UNLOCK }
  function myFit() { return !!(settings.fit[settings.char] && unlocked(settings.char)) }
  var curTheme = settings.theme || 'wedding';
  function applyTheme(t) {
    curTheme = A.THEMES[t] ? t : 'wedding';
    $('bg').innerHTML = A.backdrop(W, H, curTheme) + '<div class="vignette"></div>';
    $('table').setAttribute('data-theme', curTheme);
    $('table').querySelector('.felt').innerHTML = A.feltArt(curTheme);
    document.body.setAttribute('data-theme', curTheme);
  }
  var TOKEN = (function () { try { var t = sessionStorage.getItem('lc-token'); if (!t) { t = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('lc-token', t) } return t } catch (e) { return Math.random().toString(36).slice(2, 10) } })();

  /* ---------------- words ---------------- */
  var NUM = ['', 'Ek', 'Do', 'Teen'];
  var RNAME = { K: 'Raja', Q: 'Rani', A: 'Ikka' };
  var LINES = {
    sharma: { call: ['Beta, mujhse chaalaki? JHOOTH!', 'Pakda gaya! LIAR!'], caught: ['Arre... galti ho gayi', 'Hehe, mazaak tha'], safe: ['Sharma ji ka pet strong hai!', 'Bach gaye!'], truth: ['Dekha? Sach bolta hoon main!'], out: ['PAANI! PAANI!!'], win: ['Mithai lao, Sharma ji jeet gaye!'], wrong: ['Arre, sach tha kya?'] },
    pinky: { call: ['Haww! Jhooth!', 'Mujhe sab pata hai. LIAR!'], caught: ['Uff, kya yaar', 'Main toh bas test kar rahi thi'], safe: ['Hayee, bach gayi!'], truth: ['Sach bola tha, beta!'], out: ['MIRCHI! Mera makeup!'], win: ['Pinky Aunty number one!'], wrong: ['Haww, sach tha?!'] },
    bunty: { call: ['LIAR LIAR!', 'Jhoothaaa!'], caught: ['Maine kuch nahi kiya!', 'Mummyyy!'], safe: ['Yayyy! Phir se!'], truth: ['Hehe, sach tha!'], out: ['Aaaaa! Thanda do!'], win: ['Main jeeta! Main jeeta!'], wrong: ['Not fair!'] },
    gupta: { call: ['Calculation says: LIAR!', 'Probability: jhooth.'], caught: ['Statistical error...'], safe: ['As expected. Phew.'], truth: ['Data never lies.'], out: ['Spice level... 100%!!'], win: ['Logic wins again.'], wrong: ['Recalculating...'] },
    dadi: { call: ['Beta, Dadi se chaalaki? JHOOTH!', 'Main sab jaanti hoon!'], caught: ['Hmph. Umar ho gayi...'], safe: ['70 saal se mirchi kha rahi hoon!'], truth: ['Dadi kabhi jhooth nahi bolti'], out: ['Hey Bhagwan! Paani!'], win: ['Dadi always wins, bachchon'], wrong: ['Achha? Hmph.'] },
    rocky: { call: ['Bro... LIAR!', 'Pakda, bhai!'], caught: ['Chill bro, chill'], safe: ['Protein se strong hoon, bro'], truth: ['Bro, sach tha'], out: ['BRO IT BURNS!'], win: ['Gym aur game, dono mein first!'], wrong: ['Bro... my bad'] }
  };
  var GG = '<svg viewBox="0 0 20 20" width="14" height="14"><circle cx="10" cy="11" r="8" fill="#e9a83c" stroke="#7a4a14" stroke-width="1.5"/><ellipse cx="11" cy="7.5" rx="3.2" ry="1.8" fill="#6b3b10"/></svg>';
  var REACT = ['😂', '😱', '🤔', '😤', '🙏', '🌶️'];
  var TAUNTS = ['Sach bol raha hoon!', 'Jhooth mat bolo!', 'Mirchi ready hai?', 'Bach ke rehna!', 'Chal hatt!', 'Hehe 😏', 'Pakka?', 'Bhai, trust me'];

  /* ---------------- stage, layout, fit to screen ---------------- */
  var W = 1280, H = 720, K = 1, portrait = false, L = null;
  function computeLayout() {
    var vw = window.innerWidth, vh = window.innerHeight;
    portrait = vh > vw * 1.1;
    if (portrait) { W = 720; H = Math.round(Math.max(1180, Math.min(1600, 720 * vh / vw))) }
    else { H = 720; W = Math.round(Math.max(1180, Math.min(1600, 720 * vw / vh))) }
    K = Math.min(vw / W, vh / H);
    var st = $('stage');
    st.style.width = W + 'px'; st.style.height = H + 'px';
    st.style.transform = 'translate(' + ((vw - W * K) / 2) + 'px,' + ((vh - H * K) / 2) + 'px) scale(' + K + ')';
    L = portrait ? {
      tw: 620, th: 700, cx: W / 2, cy: H * 0.47 + 40, ang: 42, persp: 1500,
      handY: H - 14, handGap: 66, handX: W / 2 + 40, charW: 200, me: { x: 12, y: H - 340 }, ctrl: { x: W - 222, y: H - 400, w: 206 },
      react: { x: 140, y: H - 266 }
    } : {
      tw: Math.min(1060, W - 130), th: 600, cx: W / 2, cy: 470, ang: 56, persp: 1400,
      handY: H - 10, handGap: 80, handX: W / 2 - 10, charW: 196, me: { x: 18, y: H - 150 }, ctrl: { x: W - 236, y: H - 214, w: 218 },
      react: { x: 160, y: H - 56 }
    };
    document.body.classList.toggle('portrait', portrait);
    applyTheme(curTheme);
    var t = $('table');
    $('tableWrap').style.perspective = L.persp + 'px';
    $('tableWrap').style.perspectiveOrigin = '50% ' + (portrait ? '30%' : '25%');
    t.style.width = L.tw + 'px'; t.style.height = L.th + 'px';
    t.style.left = (L.cx - L.tw / 2) + 'px'; t.style.top = (L.cy - L.th / 2) + 'px';
    t.style.transform = 'rotateX(' + L.ang + 'deg)';
    var me = $('me'); me.style.left = L.me.x + 'px'; me.style.top = L.me.y + 'px';
    var c = $('controls'); c.style.left = L.ctrl.x + 'px'; c.style.top = L.ctrl.y + 'px'; c.style.width = L.ctrl.w + 'px';
    var r = $('react'); r.style.left = L.react.x + 'px'; r.style.top = L.react.y + 'px';
    var tp = $('tauntPanel'); tp.style.left = Math.min(L.react.x, W - 440) + 'px'; tp.style.top = (L.react.y - (portrait ? 150 : 130)) + 'px';
    if (G && G.seats) placeSeats();
    layoutHand();
  }
  function box(e) {
    var r = e.getBoundingClientRect(), s = $('stage').getBoundingClientRect();
    return { x: (r.left - s.left) / K, y: (r.top - s.top) / K, w: r.width / K, h: r.height / K, cx: (r.left + r.width / 2 - s.left) / K, cy: (r.top + r.height / 2 - s.top) / K };
  }

  /* ---------------- seat geometry (my seat is always at the bottom) ---------------- */
  var ANGLES = { 1: [270], 2: [222, 318], 3: [200, 270, 340], 4: [194, 244, 296, 346], 5: [190, 228, 270, 312, 350] };
  var ANGLES_P = { 1: [270], 2: [236, 304], 3: [220, 270, 320], 4: [212, 252, 288, 328], 5: [208, 239, 270, 301, 332] };
  function base() { return G.me < 0 ? 0 : G.me }
  function pos(i) { return (i - base() + G.n) % G.n }
  function seatAngle(i) { var d = pos(i); return d === 0 ? 90 : (portrait ? ANGLES_P : ANGLES)[G.n - 1][d - 1] }
  function onTable(deg, r) {
    var a = deg * Math.PI / 180;
    return { x: L.tw / 2 + Math.cos(a) * L.tw / 2 * r, y: L.th / 2 + Math.sin(a) * L.th / 2 * r };
  }

  /* =====================================================================
     TABLE CLIENT
     ===================================================================== */
  var G = null, speed = 1;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms / speed) }) }
  function chk(id) { if (!G || G.id !== id) throw 'abort' }

  // roster: [{name, key, kind:'bot'|'human'}], me: my seat, mode: 'local'|'host'|'guest'
  function clientStart(roster, me, opts, mode) {
    if (G) { stopTimer(); G.id = -1 }
    G = { id: Math.random(), me: me, n: roster.length, roster: roster, opts: opts, mode: mode, v: null, q: [], pumping: false, waiters: [],
      sel: {}, pileEls: [], lastEls: [], mine: { lies: 0, plays: 0, calls: 0, good: 0, eaten: 0 }, flyFrom: null, human: null, log: [], onAction: null };
    G.seats = roster.map(function (r, i) {
      return { i: i, key: r.key, fit: !!r.fit, kind: r.kind, you: i === me, bottom: i === (me < 0 ? 0 : me), name: i === me ? 'You' : r.name, persona: A.INFO[r.key].persona };
    });
    speed = 1;
    clearFx();
    $('ff').style.display = 'none';
    $('logList').innerHTML = '';
    document.body.classList.toggle('spectating', me < 0);
    if (opts && opts.theme) applyTheme(opts.theme);
    ticker(me < 0 ? '👀 You\'re watching this game' : welcome());
    buildTable();
    show(null);
    return G;
  }
  function clearTable() {
    ['seats', 'plates', 'spots', 'pile', 'hand'].forEach(function (id) { $(id).innerHTML = '' });
    $('tcard').innerHTML = ''; $('tcard').style.opacity = 0;
    $('me').querySelector('.av').innerHTML = ''; $('hudTC').style.display = 'none';
    $('logPanel').classList.remove('show'); $('tauntPanel').classList.remove('show');
    ticker(welcome());
  }
  function welcome() { return ({ wedding: 'Welcome to the shaadi!', dhaba: 'Welcome to the dhaba! Chai is on the house.', canteen: 'Welcome to the canteen! Bunk the lecture.', diwali: 'Happy Diwali! Patakhe and bluffs.' })[curTheme] || 'Welcome!' }
  function clearFx() {
    $('fx').querySelectorAll('.fly,.rv,.confetti').forEach(function (e) { e.remove() });
    $('eat').className = ''; $('eat').innerHTML = '';
    $('stampEl').className = 'stamp';
  }

  function pushPacket(p) { if (!G) return; G.q.push(p); pump() }
  async function pump() {
    if (!G || G.pumping) return;
    G.pumping = true;
    var id = G.id;
    try {
      while (G.q.length) {
        chk(id);
        var p = G.q.shift();
        if (p.v) G.v = p.v;
        await doEvents(p.ev || [], id);
        if (!G.q.length) afterPacket();
      }
    } catch (e) { if (e !== 'abort') console.error(e) }
    if (G && G.id === id) { G.pumping = false; G.waiters.splice(0).forEach(function (f) { f() }) }
  }
  function idle() { return new Promise(function (r) { if (!G || (!G.pumping && !G.q.length)) r(); else G.waiters.push(r) }) }

  function afterPacket() {
    var v = G.v;
    if (!v || v.phase !== 'turn') return;
    if (v.turn === G.me) { if (!G.human) humanTurn() }
    else if (G.seats[v.turn].kind !== 'bot' && G.opts.timer) startTimer(v.turn, G.opts.timer);
  }

  function buildTable() {
    $('seats').innerHTML = ''; $('plates').innerHTML = ''; $('spots').innerHTML = ''; $('pile').innerHTML = '';
    $('tcard').innerHTML = ''; $('tcard').style.opacity = 0; $('hand').innerHTML = '';
    $('hudTC').style.display = 'none'; $('hudRound').innerHTML = '<span class="lab">Round</span>–';
    G.seats.forEach(function (st, i) {
      var plate = el('div', 'plate', A.plate() + '<div class="katori">' + A.katori() + '</div>');
      st.gg = [];
      for (var g = 0; g < 6; g++) {
        var gg = el('div', 'gg', A.golgappa(30));
        var ga = g / 6 * Math.PI * 2 + 0.5;
        gg.style.left = (60 - 15 + Math.cos(ga) * 31) + 'px'; gg.style.top = (38 - 18 + Math.sin(ga) * 17) + 'px';
        gg.style.zIndex = Math.round(10 + Math.sin(ga) * 5);
        plate.appendChild(gg); st.gg.push(gg);
      }
      $('spots').appendChild(plate); st.plate = plate;
      var edge = el('div', 'spot'); edge.style.width = '100px'; $('spots').appendChild(edge); st.edge = edge;
      st.np = el('div', 'np'); $('plates').appendChild(st.np);
      st.bub = el('div', 'bubble'); $('plates').appendChild(st.bub);
      if (st.bottom) {
        $('me').querySelector('.av').innerHTML = A.character(st.key, st.fit);
        st.svg = $('me').querySelector('.ch'); $('me').classList.remove('out');
        return;
      }
      var seat = el('div', 'seat', A.character(st.key, st.fit));
      $('seats').appendChild(seat); st.el = seat; st.svg = seat.querySelector('.ch');
    });
    placeSeats();
    G.seats.forEach(function (st, i) { updateNP(i) });
  }
  function placeSpots() {
    G.seats.forEach(function (st, i) {
      var a = seatAngle(i);
      var p = st.bottom ? onTable(portrait ? 122 : 128, 0.78) : onTable(a, 0.68);
      st.plate.style.left = p.x + 'px'; st.plate.style.top = p.y + 'px';
      var e2 = onTable(a, 1.0);
      st.edge.style.left = e2.x + 'px'; st.edge.style.top = e2.y + 'px';
    });
  }
  function placeSeats() {
    placeSpots();
    G.seats.forEach(function (st, i) {
      if (st.bottom) {
        var mb = box($('me').querySelector('.av'));
        st.np.style.left = (mb.cx + (portrait ? 40 : 0)) + 'px'; st.np.style.top = (mb.y - 6) + 'px';
        st.bub.style.left = (mb.cx + 70) + 'px'; st.bub.style.top = (mb.y - 50) + 'px';
        return;
      }
      var e = box(st.edge), scale = Math.max(0.7, Math.min(1.08, e.w / 100));
      var a = seatAngle(i), side = Math.abs(Math.cos(a * Math.PI / 180)) > 0.75;
      var w = L.charW * scale * (side ? 0.95 : 1), h = w * 260 / 220;
      var sink = side ? 0.42 : 0.36;
      st.el.style.width = w + 'px';
      var push = side ? Math.sign(Math.cos(a * Math.PI / 180)) * w * 0.12 : 0;
      e = { x: e.x + push, y: e.y - (side ? h * 0.08 : 0), w: e.w };
      e.x = Math.max(w * 0.42, Math.min(W - w * 0.42, e.x));
      st.el.style.left = (e.x - w / 2) + 'px';
      st.el.style.top = (e.y - h * (1 - sink)) + 'px';
      st.el.style.zIndex = Math.round(1000 - e.y);
      var nx = Math.max(96, Math.min(W - 96, e.x));
      st.np.style.left = nx + 'px'; st.np.style.top = (e.y - h * (1 - sink) + 4) + 'px';
      st.bub.style.left = Math.max(120, Math.min(W - 120, e.x)) + 'px'; st.bub.style.top = (e.y - h * (1 - sink) - 34) + 'px';
    });
  }

  function P(i) { return G.v && G.v.players[i] ? G.v.players[i] : { alive: i >= 0, pulls: 0, cards: 0 } }
  function updateNP(i) {
    var st = G.seats[i], p = P(i);
    var eaten = p.pulls, left = 6 - eaten;
    var tag = st.away ? '<span class="tagaway">offline</span>' : (st.kind === 'bot' && G.mode !== 'local' ? '<span class="tagbot">bot</span>' : '');
    var sub = p.alive ? '<span class="cc"><i></i>' + p.cards + '</span><span class="gi">' + GG + left + '</span>' + tag : '<span class="outtag">OUT</span>';
    var turn = G.v && G.v.turn === i && G.v.phase === 'turn';
    st.np.className = 'np' + (turn ? ' turn' : '') + (p.alive ? '' : ' outnp');
    st.np.innerHTML = '<div class="ring" style="--p:' + (st.p || 0) + '"><b>' + (st.you ? '★' : st.bottom ? '👁' : (pos(i))) + '</b></div><div><div class="nm">' + esc(st.name) + '</div><div class="sub">' + sub + '</div></div>';
    st.gg.forEach(function (g, k) { g.classList.toggle('gone', k < eaten) });
    st.plate.classList.toggle('dead', !p.alive);
    if (st.el) st.el.classList.toggle('out', !p.alive);
    if (!p.alive) st.svg.setAttribute('data-ex', 'out');
  }
  function setRing(i, p) {
    var st = G.seats[i]; if (!st) return; st.p = p;
    var r = st.np.querySelector('.ring'); if (r) r.style.setProperty('--p', p);
  }
  function ex(i, e) { var st = G.seats[i]; if (!st) return; if (P(i).alive || e === 'out') st.svg.setAttribute('data-ex', e) }
  function say(i, text, ms, cls) {
    if (!G || !G.seats[i]) return;
    var b = G.seats[i].bub;
    b.className = 'bubble ' + (cls || ''); b.textContent = text;
    void b.offsetWidth; b.classList.add('show');
    clearTimeout(b._t); b._t = setTimeout(function () { b.classList.remove('show') }, (ms || 1800) / speed);
  }
  // scripted lines only for bot-controlled characters; real people speak for themselves
  function line(i, kind) { if (!G) return; var st = G.seats[i]; if (st.you || st.kind !== 'bot') return; var l = LINES[st.key][kind]; if (l) { var t = rnd(l); say(i, t, 2200); return t } }
  function ticker(t) { $('ticker').innerHTML = t }
  function nm(i) { return G.seats[i].you ? 'You' : G.seats[i].name }
  function logLine(html) { G.log.push(html); var d = el('div', '', html); $('logList').prepend(d) }

  function hudTable() {
    var v = G.v;
    $('hudRound').innerHTML = '<span class="lab">Round</span>' + v.round;
    $('hudTC').innerHTML = '<div class="mini">' + A.cardFace(v.table) + '</div><div><span class="lab">Table card</span>' + RNAME[v.table].toUpperCase() + ' <small style="opacity:.7">+ Jokers</small></div>';
    $('hudTC').style.display = 'flex';
  }

  /* ---------------- flying cards ---------------- */
  function fly(from, to, opt) {
    opt = opt || {};
    var f = el('div', 'fly', '<div class="b">' + A.cardBack() + '</div>' + (opt.face ? '<div class="f">' + A.cardFace(opt.face) + '</div>' : ''));
    var w0 = from.w, h0 = from.h, w1 = to.w, h1 = to.h;
    f.style.width = w0 + 'px'; f.style.height = h0 + 'px';
    $('fx').appendChild(f);
    var r0 = opt.rot0 || 0, r1 = opt.rot1 != null ? opt.rot1 : (Math.random() * 40 - 20);
    var flip0 = opt.faceUp0 ? 180 : 0, flip1 = opt.faceUp1 ? 180 : 0;
    var arc = opt.arc != null ? opt.arc : -60;
    var mid = { x: (from.cx + to.cx) / 2, y: (from.cy + to.cy) / 2 + arc };
    var sx = w1 / w0, sy = h1 / h0;
    var kf = [
      { transform: 'translate(' + (from.cx - w0 / 2) + 'px,' + (from.cy - h0 / 2) + 'px) rotate(' + r0 + 'deg) rotateY(' + flip0 + 'deg)' },
      { transform: 'translate(' + (mid.x - w0 / 2) + 'px,' + (mid.y - h0 / 2) + 'px) rotate(' + ((r0 + r1) / 2) + 'deg) rotateY(' + ((flip0 + flip1) / 2) + 'deg) scale(' + ((1 + sx) / 2 * 1.08) + ',' + ((1 + sy) / 2 * 1.08) + ')', offset: 0.5 },
      { transform: 'translate(' + (to.cx - w0 / 2) + 'px,' + (to.cy - h0 / 2) + 'px) rotate(' + r1 + 'deg) rotateY(' + flip1 + 'deg) scale(' + sx + ',' + sy + ')' }
    ];
    var an = f.animate(kf, { duration: (opt.dur || 380) / speed, easing: 'cubic-bezier(.35,.1,.25,1)', fill: 'forwards' });
    return new Promise(function (res) { an.onfinish = function () { if (!opt.keep) f.remove(); res(f) } });
  }
  function pileBox() { var p = box($('pile')); return { x: p.cx - 35, y: p.cy - 49, w: 70, h: 98, cx: p.cx, cy: p.cy } }
  function seatHandBox(i) {
    var st = G.seats[i];
    if (st.you) return { x: L.handX - 54, y: L.handY - 151, w: 108, h: 151, cx: L.handX, cy: L.handY - 75 };
    if (st.bottom) { var ab = box($('me').querySelector('.av')); return { x: ab.cx - 22, y: ab.y, w: 44, h: 62, cx: ab.cx, cy: ab.y + 30 } }
    var b = box(st.el);
    return { x: b.cx - 22, y: b.y + b.h * 0.72, w: 44, h: 62, cx: b.cx, cy: b.y + b.h * 0.8 };
  }
  function addPileCard() {
    var c = el('div', 'pcard', A.cardBack());
    var ox = Math.random() * 90 - 45, oy = Math.random() * 50 - 25, rot = Math.random() * 70 - 35;
    c.style.transform = 'translate(' + ox + 'px,' + oy + 'px) rotate(' + rot + 'deg)';
    $('pile').appendChild(c); G.pileEls.push(c);
    return c;
  }

  /* ---------------- your hand ---------------- */
  function myHand() { var p = G.v && G.v.players[G.me]; return p && p.hand ? p.hand : [] }
  function sortHand(h) {
    var t = G.v.table, ord = function (c) { return c.r === t ? 0 : c.r === 'J' ? 1 : 2 + 'KQA'.indexOf(c.r) };
    return h.slice().sort(function (a, b) { return ord(a) - ord(b) });
  }
  function renderHand() {
    var hand = $('hand'), keep = {};
    [].slice.call(hand.children).forEach(function (c) { keep[c.dataset.id] = c });
    var cards = P(G.me).alive ? sortHand(myHand()) : [];
    var ids = {};
    cards.forEach(function (c, k) {
      ids[c.id] = 1;
      var e = keep[c.id];
      if (!e) { e = el('div', 'hcard', A.cardFace(c.r) + '<span class="key">' + (k + 1) + '</span>'); e.dataset.id = c.id; hand.appendChild(e) }
      e.querySelector('.key').textContent = k + 1;
      e.dataset.k = k;
    });
    Object.keys(keep).forEach(function (id) { if (!ids[id]) keep[id].remove() });
    layoutHand();
  }
  function layoutHand() {
    if (!G || !L) return;
    var cs = [].slice.call($('hand').children), n = cs.length;
    cs.sort(function (a, b) { return a.dataset.k - b.dataset.k });
    cs.forEach(function (c, k) {
      var off = k - (n - 1) / 2, rot = off * 5, x = L.handX + off * L.handGap - 54, y = L.handY - 151 + Math.abs(off) * 6;
      if (G.sel[c.dataset.id]) y -= 30;
      c.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + rot + 'deg)';
      c.classList.toggle('sel', !!G.sel[c.dataset.id]);
      c.style.zIndex = k;
    });
  }

  // redraw everything from the view without animation (reconnects, late joins)
  function syncFromView() {
    var v = G.v; if (!v) return;
    clearFx();
    $('pile').innerHTML = ''; G.pileEls = []; G.lastEls = [];
    if (v.table) {
      hudTable();
      $('tcard').innerHTML = A.cardFace(v.table) + '<div class="lbl">TABLE: ' + RNAME[v.table].toUpperCase() + '</div>'; $('tcard').style.opacity = 1;
      v.pile.forEach(function (p, k) { for (var c = 0; c < p.count; c++) { var e = addPileCard(); if (k === v.pile.length - 1) { e.classList.add('lastplay'); G.lastEls.push(e) } } });
    }
    G.seats.forEach(function (st, i) { updateNP(i); if (P(i).alive) ex(i, 'neutral') });
    if (G.me >= 0 && !P(G.me).alive) $('me').classList.add('out');
    if (G.me < 0 && !P(0).alive) $('me').classList.add('out');
    renderHand();
  }

  /* ---------------- event animations ---------------- */
  async function doEvents(ev, id) {
    for (var k = 0; k < ev.length; k++) {
      chk(id);
      var e = ev[k];
      if (e.t === 'round') await animRound(e, id);
      else if (e.t === 'turn') setTurn(e.seat);
      else if (e.t === 'play') await animPlay(e, id);
      else if (e.t === 'call') await animCall(e, id);
      else if (e.t === 'reveal') await animReveal(e, id);
      else if (e.t === 'pull') await animEat(e, id);
      else if (e.t === 'roundEnd') { G.seats.forEach(function (st, i) { updateNP(i) }) }
      else if (e.t === 'think') think(e);
      else if (e.t === 'forfeit') { updateNP(e.seat); ticker('<b>' + esc(nm(e.seat)) + '</b> left the table'); }
      else if (e.t === 'sync') syncFromView();
      else if (e.t === 'over') await gameOver(e.winner, id);
    }
  }

  function setTurn(i) {
    stopTimer();
    G.seats.forEach(function (st, k) {
      updateNP(k); setRing(k, 0);
      if (st.el) st.el.classList.toggle('turnglow', k === i);
    });
  }

  function think(e) {
    var st = G.seats[e.seat]; if (!st) return;
    ex(e.seat, 'think');
    if (e.nervous) st.svg.classList.add('nervous');
    startTimer(e.seat, e.ms / 1000);
    if (e.tell) setTimeout(function () { st.svg.classList.add('tell'); setTimeout(function () { st.svg.classList.remove('tell') }, 1600) }, e.ms * 0.25 / speed);
    setTimeout(function () { if (!G || G.seats[e.seat] !== st) return; st.svg.classList.remove('nervous'); if (P(e.seat).alive) ex(e.seat, 'neutral') }, e.ms / speed);
  }

  async function animRound(e, id) {
    var v = G.v;
    G.pileEls.forEach(function (c) { c.style.opacity = 0; c.style.transform += ' scale(.6)' });
    await sleep(300); $('pile').innerHTML = ''; G.pileEls = []; G.lastEls = [];
    G.sel = {}; $('hand').innerHTML = '';
    G.seats.forEach(function (st, i) { if (P(i).alive) ex(i, 'neutral'); updateNP(i) });
    ticker('<b>Round ' + e.round + '</b> · ' + esc(nm(e.starter)) + (G.seats[e.starter].you ? ' start' : ' starts'));
    logLine('<b class="gold">Round ' + e.round + '</b> · table card ' + RNAME[e.table]);
    AU.play('shuffle');
    var tc = $('tcard');
    tc.style.opacity = 0;
    stamp('Round ' + e.round, 'Table card: <b>' + RNAME[e.table] + '</b> · Jokers are wild', 'gold');
    var bigTo = { x: W / 2 - 75, y: H * 0.42 - 105, w: 150, h: 210, cx: W / 2, cy: H * 0.45 };
    await sleep(500); chk(id);
    var tcb = box(tc);
    var f = await fly({ x: W / 2 - 40, y: -150, w: 80, h: 112, cx: W / 2, cy: -60 }, bigTo, { face: e.table, faceUp1: true, rot1: 0, dur: 600, keep: true, arc: 0 });
    AU.play('flip');
    await sleep(900); chk(id);
    unstamp();
    var an = f.animate([{ transform: getComputedStyle(f).transform }, { transform: 'translate(' + (tcb.cx - 75) + 'px,' + (tcb.cy - 105) + 'px) rotateY(180deg) scale(' + (tcb.w / 150) + ',' + (tcb.h / 210) + ')' }], { duration: 450 / speed, easing: 'ease-in-out', fill: 'forwards' });
    await new Promise(function (r) { an.onfinish = r });
    tc.innerHTML = A.cardFace(e.table) + '<div class="lbl">TABLE: ' + RNAME[e.table].toUpperCase() + '</div>'; tc.style.opacity = 1; f.remove();
    hudTable();
    var n = G.n, order = []; for (var k = 0; k < n; k++) { var j = (e.starter + k) % n; if (P(j).alive) order.push(j) }
    var dealt = {}; order.forEach(function (j) { dealt[j] = 0 });
    var pb = pileBox();
    for (var r = 0; r < 5; r++) {
      for (var q = 0; q < order.length; q++) {
        (function (j) {
          AU.play('deal');
          fly(pb, seatHandBox(j), { dur: 300, arc: -40 }).then(function () {
            dealt[j]++;
            var np = G && G.seats[j] && G.seats[j].np.querySelector('.cc'); if (np) np.innerHTML = '<i></i>' + dealt[j];
          });
        })(order[q]);
        await sleep(55);
      }
    }
    await sleep(350); chk(id);
    renderHand();
    [].slice.call($('hand').children).forEach(function (h, k) { h.animate([{ transform: h.style.transform + ' rotateY(90deg)' }, { transform: h.style.transform }], { duration: 300, delay: k * 60 }) });
    AU.play('flip');
    G.seats.forEach(function (st, i) { updateNP(i) });
    await sleep(400);
  }

  async function animPlay(e, id) {
    var i = e.seat, st = G.seats[i], table = G.v.table;
    G.lastEls.forEach(function (c) { c.classList.remove('lastplay') });
    G.lastEls = [];
    say(i, NUM[e.count] + ' ' + RNAME[table] + '!', 1700, 'claim');
    ticker('<b>' + esc(nm(i)) + '</b> ' + (st.you ? 'claim' : 'claims') + ' <b class="gold">' + NUM[e.count] + ' ' + RNAME[table] + '</b>' + (e.left ? '' : ' · no cards left'));
    logLine(esc(nm(i)) + ' claimed <b>' + NUM[e.count] + ' ' + RNAME[table] + '</b>' + (e.left ? '' : ' (last cards)'));
    var srcs = [];
    if (st.you && G.flyFrom) srcs = G.flyFrom;
    else for (var k = 0; k < e.count; k++) srcs.push(seatHandBox(i));
    if (st.you) renderHand();
    var pb = pileBox(), ps = [];
    srcs.forEach(function (src, k) {
      ps.push(sleep(k * 90).then(function () {
        AU.play('flick');
        return fly(src, pb, { dur: 420, arc: -70 }).then(function () { if (!G) return; var c = addPileCard(); c.classList.add('lastplay'); G.lastEls.push(c); AU.play('place') });
      }));
    });
    await Promise.all(ps); chk(id);
    G.flyFrom = null;
    updateNP(i);
    if (st.kind === 'bot' && Math.random() < 0.3) ex(i, 'smug');
    await sleep(350);
    if (st.kind === 'bot') ex(i, 'neutral');
  }

  function stamp(big, small, color) {
    var s = $('stampEl');
    s.className = 'stamp ' + (color || 'red');
    s.innerHTML = '<div class="big">' + big + '</div>' + (small ? '<div class="small">' + small + '</div>' : '');
    void s.offsetWidth; s.classList.add('on');
  }
  function unstamp() { var s = $('stampEl'); s.classList.remove('on'); s.classList.add('off') }
  function shake() { var s = $('stage'); var t = s.style.transform; s.animate([{ transform: t }, { transform: t + ' translate(-8px,3px)' }, { transform: t + ' translate(9px,-3px)' }, { transform: t + ' translate(-6px,2px)' }, { transform: t + ' translate(4px,-1px)' }, { transform: t }], { duration: 420 }) }

  async function animCall(e, id) {
    var i = e.seat;
    G.lastCaller = i;
    setTurn(-1);
    ex(i, 'shout'); ex(e.accused, 'shock');
    if (G.seats[i].you) G.mine.calls++;
    var said = line(i, 'call');
    AU.speak(said || rnd(['Jhooth!', 'Liar!', 'Jhoothaa!']), G.seats[i].key);
    AU.play('slam'); shake();
    stamp('LIAR!', '<b>' + esc(nm(i)) + '</b>' + (G.seats[i].you ? ' call out ' : ' calls out ') + '<b>' + esc(nm(e.accused)) + '</b>', 'red');
    ticker('<b>' + esc(nm(i)) + '</b> ' + (G.seats[i].you ? 'call' : 'calls') + ' LIAR on ' + esc(nm(e.accused)));
    AU.duck(true);
    await sleep(1300); chk(id);
    unstamp();
  }

  async function animReveal(e, id) {
    var table = G.v.table, cards = e.cards.map(function (r) { return { r: r } });
    var n = cards.length, gap = 132, startX = W / 2 - (n - 1) * gap / 2, cy = H * 0.44;
    var rvs = [];
    G.lastEls.forEach(function (pc) { pc.style.opacity = 0 });
    var ps = cards.map(function (c, k) {
      var src = G.lastEls[k] ? box(G.lastEls[k]) : pileBox();
      var to = { x: startX + k * gap - 59, y: cy - 82, w: 118, h: 165, cx: startX + k * gap, cy: cy };
      return fly(src, to, { dur: 450, arc: -30, rot1: 0 }).then(function () {
        var rv = el('div', 'rv', '<div class="b">' + A.cardBack() + '</div><div class="f">' + A.cardFace(c.r) + '<div class="mark ' + (LC.isTrue(c, table) ? 'ok">✓' : 'no">✗') + '</div></div>');
        rv.style.left = to.x + 'px'; rv.style.top = to.y + 'px';
        $('fx').appendChild(rv); rvs[k] = rv;
      });
    });
    await Promise.all(ps); chk(id);
    await sleep(250);
    for (var k = 0; k < rvs.length; k++) {
      rvs[k].classList.add('flip'); AU.play('flip');
      await sleep(380);
      rvs[k].classList.add('marked', LC.isTrue(cards[k], table) ? 'glowok' : 'glowno'); AU.play('pop');
      await sleep(180);
    }
    chk(id);
    var caller = G.lastCaller, liar = G.v.last ? G.v.last.by : e.loser;
    if (e.lie) {
      AU.play('sting', true);
      stamp('JHOOTH!', '<b>' + esc(nm(liar)) + '</b>' + (G.seats[liar].you ? ' were' : ' was') + ' bluffing', 'red low');
      ex(liar, 'sad'); line(liar, 'caught'); ex(caller, 'happy');
      if (G.seats[caller].you) G.mine.good++;
      logLine('→ ' + esc(nm(caller)) + ' called LIAR: <b class="red">JHOOTH</b> (' + e.cards.map(rk).join(' ') + ')');
    } else {
      AU.play('sting', false);
      stamp('SACH!', '<b>' + esc(nm(liar)) + '</b> told the truth', 'green low');
      ex(liar, 'happy'); line(liar, 'truth');
      ex(caller, 'shock'); setTimeout(function () { line(caller, 'wrong') }, 700);
      logLine('→ ' + esc(nm(caller)) + ' called LIAR: <b class="green">SACH</b> (' + e.cards.map(rk).join(' ') + ')');
    }
    G.seats.forEach(function (st, k) { if (st.kind === 'bot' && k !== e.loser && P(k).alive && Math.random() < 0.35) setTimeout(function () { say(k, rnd(REACT), 1400, 'emoji') }, 400 + Math.random() * 800) });
    await sleep(1700); chk(id);
    unstamp();
    rvs.forEach(function (r) { r.style.transition = 'opacity .3s'; r.style.opacity = 0; setTimeout(function () { r.remove() }, 350) });
    await sleep(300);
  }
  function rk(r) { return r === 'J' ? 'Joker' : RNAME[r] }

  async function animEat(e, id) {
    var i = e.seat, st = G.seats[i], before = e.n - 1, left = 6 - before;
    var ov = $('eat');
    ov.className = '';
    ov.innerHTML = '<div class="who">' + (st.you ? 'Khao, beta!' : esc(st.name) + ', khao!') + '</div><div class="odds">Golgappa #' + e.n + ' · mirchi chance <b>' + (left <= 2 ? '100%' : '2 in ' + left) + '</b></div>' +
      '<div class="big">' + A.character(st.key, st.fit) + '</div><div class="bigplate">' + A.plate() + '<div class="katori big">' + A.katori() + '</div></div><div class="result"></div>';
    var big = ov.querySelector('.big .ch'); big.setAttribute('data-ex', 'think'); big.classList.add('nervous');
    var bp = ov.querySelector('.bigplate'), ggs = [];
    for (var g = 0; g < left; g++) {
      var back = Math.min(3, left), row = g < back ? 0 : 1, inRow = row ? left - back : back, k = row ? g - back : g;
      var gg = el('div', 'gg', A.golgappa(56));
      gg.style.left = (128 - 28 + (k - (inRow - 1) / 2) * 58) + 'px'; gg.style.top = (row ? 66 : 30) + 'px';
      bp.appendChild(gg); ggs.push(gg);
    }
    ov.classList.add('show');
    AU.duck(true);
    await sleep(1000); chk(id);
    // pick one, dip it in the pani, bring it to the mouth
    var pick = ggs[ggs.length - 1], pb = box(pick), kb = box(ov.querySelector('.katori')), mb = box(big);
    var mouth = { x: mb.cx, y: mb.y + mb.h * 0.55 };
    pick.style.zIndex = 30;
    var dip = pick.animate([
      { transform: 'translate(0,0)' },
      { transform: 'translate(' + (kb.cx - pb.cx) + 'px,' + (kb.cy - pb.cy - 34) + 'px) scale(1.05)', offset: 0.35 },
      { transform: 'translate(' + (kb.cx - pb.cx) + 'px,' + (kb.cy - pb.cy - 6) + 'px) scale(1)', offset: 0.55 },
      { transform: 'translate(' + (kb.cx - pb.cx) + 'px,' + (kb.cy - pb.cy - 40) + 'px) scale(1.05)', offset: 0.75 },
      { transform: 'translate(' + (mouth.x - pb.cx) + 'px,' + (mouth.y - pb.cy) + 'px) scale(.7)' }
    ], { duration: 1500 / speed, easing: 'ease-in-out', fill: 'forwards' });
    setTimeout(function () { AU.play('splash') }, 700 / speed);
    setTimeout(function () { AU.play('whoosh') }, 1100 / speed);
    await new Promise(function (r) { dip.onfinish = r }); chk(id);
    pick.style.opacity = 0;
    big.classList.remove('nervous'); big.setAttribute('data-ex', 'chew'); AU.play('crunch');
    await sleep(400);
    ov.classList.add('beat'); AU.play('heartbeat', 3, 0.62);
    await sleep(1950); chk(id);
    ov.classList.remove('beat');
    var res = ov.querySelector('.result');
    if (e.dead) {
      big.setAttribute('data-ex', 'fire'); AU.play('fire');
      setTimeout(function () { AU.speak(rnd(['Mirchiii! Paani!', 'Aaaah! Paani do!', 'Bahut teekha!']), st.key) }, 500);
      var fl = $('flashEl'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); shake();
      res.className = 'result hot show'; res.innerHTML = 'MIRCHIII!!<small>' + (st.you ? 'You\'re out!' : esc(st.name) + ' is out!') + '</small>';
      if (st.kind === 'bot') setTimeout(function () { say(i, rnd(LINES[st.key].out), 2000) }, 200);
      await sleep(1700); chk(id);
      ov.classList.add('dying'); AU.play('out');
      await sleep(1600);
    } else {
      big.setAttribute('data-ex', 'relief'); AU.play('phew');
      AU.speak(rnd(['Phew!', 'Bach gaye!', 'Hehe!']), st.key);
      res.className = 'result safe show'; res.innerHTML = rnd(['Phew!', 'Bach gaye!', 'Thanda tha!']) + '<small>' + rnd(['Normal wala tha.', 'Safe... for now.', 'The mirchi waits.']) + '</small>';
      await sleep(1500);
    }
    chk(id);
    if (st.you) G.mine.eaten++;
    ov.className = ''; ov.innerHTML = '';
    AU.duck(false);
    updateNP(i);
    logLine('&nbsp;&nbsp;' + esc(nm(i)) + ' ate golgappa #' + e.n + ': ' + (e.dead ? '<b class="red">MIRCHI, out!</b>' : 'safe'));
    if (e.dead) {
      ex(i, 'out');
      if (st.bottom) $('me').classList.add('out');
      if (st.you && G.mode === 'local') $('ff').style.display = 'block';
      ticker('🌶️ <b>' + esc(nm(i)) + '</b> ' + (st.you ? 'are' : 'is') + ' out! ' + G.v.players.filter(function (p) { return p.alive }).length + ' left at the table');
    } else {
      ex(i, 'relief'); line(i, 'safe');
      ticker(esc(nm(i)) + ' survived golgappa #' + e.n);
      setTimeout(function () { if (G && G.seats[i] === st && P(i).alive) ex(i, 'neutral') }, 1800);
    }
  }

  /* ---------------- timers and your turn ---------------- */
  function startTimer(i, secs, onEnd) {
    var t0 = performance.now(), dur = secs * 1000 / speed, lastTick = -1, id = G.id;
    stopTimer();
    G.timer = { raf: 0 };
    (function tick() {
      if (!G || G.id !== id) return;
      var p = Math.min(1, (performance.now() - t0) / dur);
      setRing(i, 1 - p);
      var leftS = Math.ceil((dur - (performance.now() - t0)) / 1000);
      if (onEnd && leftS <= 5 && leftS !== lastTick && leftS > 0) { lastTick = leftS; AU.play('tick') }
      if (p >= 1) { if (onEnd) onEnd(); return }
      G.timer.raf = requestAnimationFrame(tick);
    })();
  }
  function stopTimer() { if (G && G.timer) cancelAnimationFrame(G.timer.raf) }

  function humanTurn() {
    var o = G.v.options; if (!o) return;
    var id = G.id;
    G.sel = {}; layoutHand();
    $('hand').classList.remove('locked');
    ticker(o.mustCall ? 'Everyone else is out of cards: <b>you must call LIAR</b>' : '<b>Your turn</b> · play 1–' + o.maxPlay + ' cards as ' + RNAME[G.v.table] + (o.canCall ? ' or call LIAR on ' + esc(nm(G.v.last.by)) : ''));
    ex(G.me, 'think');
    AU.play('yourturn');
    G.human = { o: o };
    updateControls();
    if (G.opts.timer) startTimer(G.me, G.opts.timer, function () {
      if (!G || G.id !== id || !G.human) return;
      var a = autoAction(o);
      if (a.type === 'play') { G.sel = {}; G.sel[a.cards[0]] = 1 }
      ticker('Time up!');
      submit(a);
    });
    else setRing(G.me, 1);
  }
  function autoAction(o) {
    if (!o.canPlay) return { type: 'call' };
    var h = myHand(); return { type: 'play', cards: [h[Math.floor(Math.random() * h.length)].id] };
  }
  function submit(a) {
    if (!G || !G.human) return;
    if (a.type === 'play') {
      G.flyFrom = a.cards.map(function (cid) { var h = $('hand').querySelector('[data-id="' + cid + '"]'); return h ? box(h) : seatHandBox(G.me) });
      G.mine.plays++;
      var lie = a.cards.some(function (cid) { var c = myHand().find(function (x) { return x.id === cid }); return c && !LC.isTrue(c, G.v.table) });
      if (lie) G.mine.lies++;
    }
    G.human = null; stopTimer(); setRing(G.me, 0); ex(G.me, 'neutral');
    $('hand').classList.add('locked'); updateControls();
    if (G.onAction) G.onAction(a);
  }
  function updateControls() {
    var h = G && G.human, n = G ? Object.keys(G.sel).length : 0, table = G && G.v && G.v.table;
    var bp = $('btnPlay'), bl = $('btnLiar');
    bp.disabled = !(h && h.o.canPlay && n >= 1 && n <= h.o.maxPlay);
    bl.disabled = !(h && h.o.canCall);
    bp.innerHTML = (n ? 'PLAY ' + n : 'PLAY') + '<small>' + (table ? (n ? 'claim ' + NUM[n] + ' ' + RNAME[table] : 'as ' + RNAME[table]) : '') + '</small>';
    bl.innerHTML = 'LIAR!<small>' + (h && h.o.canCall ? 'call out ' + esc(nm(G.v.last.by)) : 'jhooth pakdo') + '</small>';
    $('hint').textContent = h ? (h.o.mustCall ? 'You must call!' : n ? '' : 'Pick 1–' + h.o.maxPlay + ' cards to play') : '';
  }

  /* ---------------- game over ---------------- */
  async function gameOver(w, id) {
    var st = G.seats[w];
    stopTimer();
    stats.games++; if (G.mode !== 'local') stats.online++;
    var newly = null;
    if (st && st.you) {
      stats.wins++; stats.streak++; stats.best = Math.max(stats.best, stats.streak);
      var had = unlocked(st.key); stats.cw[st.key] = (stats.cw[st.key] || 0) + 1;
      if (!had && unlocked(st.key)) { newly = st.key; settings.fit[st.key] = true; save('lc-settings', settings) }
    } else stats.streak = 0;
    save('lc-stats', stats);
    $('ff').style.display = 'none'; speed = 1;
    if (st) { ex(w, 'win'); line(w, 'win') }
    AU.play('win');
    confetti();
    await sleep(1200); chk(id);
    var m = G.mine;
    $('overBody').innerHTML = '<div class="winner">' + (st ? A.character(st.key, st.fit).replace('data-ex="neutral"', 'data-ex="win"') : '') + '</div>' +
      '<h2>' + (st ? (st.you ? 'You win! 🏆' : esc(st.name) + ' wins!') : 'Game over') + '</h2>' +
      '<div class="tag">' + (st ? (st.you ? 'Golgappa champion of the shaadi.' : st.kind === 'bot' ? rnd(LINES[st.key].win) : 'Shaadi ka asli champion!') : '') + '</div>' +
      '<table><tr><td>Rounds played</td><td>' + (G.v ? G.v.round : 0) + '</td></tr><tr><td>Your bluffs</td><td>' + m.lies + ' of ' + m.plays + ' plays</td></tr>' +
      '<tr><td>Your LIAR calls</td><td>' + m.good + ' right of ' + m.calls + '</td></tr><tr><td>Golgappas you ate</td><td>' + m.eaten + '</td></tr>' +
      '<tr><td>All-time wins</td><td>' + stats.wins + ' of ' + stats.games + (stats.streak > 1 ? ' · 🔥 ' + stats.streak + ' in a row' : '') + '</td></tr></table>' +
      (newly ? '<div class="unlock"><div class="up">' + A.character(newly, true) + '</div><div><b>Unlocked!</b><span>' + A.INFO[newly].name + ': ' + A.INFO[newly].fit + '</span><small>It\'s on now. Switch looks on the home screen.</small></div></div>' :
        (st && st.you && !unlocked(st.key) ? '<div class="unlock soon">👘 ' + (UNLOCK - (stats.cw[st.key] || 0)) + ' more win as ' + A.INFO[st.key].name + ' unlocks the shaadi look</div>' : ''));
    var host = G.mode !== 'guest';
    $('btnAgain').style.display = host ? '' : 'none';
    $('overWait').style.display = host ? 'none' : 'block';
    $('btnMenu').textContent = G.mode === 'local' ? 'Menu' : 'Back to lobby';
    show('over');
  }
  function confetti() {
    var cols = ['#f5c542', '#ff6a3d', '#e84a8a', '#4cc574', '#5ba9d6', '#fff'];
    for (var k = 0; k < 90; k++) {
      var c = el('div', 'confetti'); c.style.left = Math.random() * W + 'px'; c.style.background = rnd(cols);
      $('fx').appendChild(c);
      var an = c.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(' + (Math.random() * 200 - 100) + 'px,' + (H + 60) + 'px) rotate(' + (Math.random() * 900) + 'deg)' }], { duration: 2200 + Math.random() * 1800, delay: Math.random() * 900, easing: 'cubic-bezier(.3,.2,.6,1)' });
      an.onfinish = (function (c) { return function () { c.remove() } })(c);
    }
  }

  /* =====================================================================
     HOST DRIVER: runs the real game. Used for vs-bots and for online hosting.
     seats: [{name, key, kind:'me'|'bot'|'remote', peer?, token?}]
     ===================================================================== */
  var HOST = null;
  function hostGame(seats, opts, net) {
    var s = LC.newGame(seats.map(function (r, i) { return { id: 'p' + i, name: r.name, bot: r.kind === 'bot' } }));
    var me = seats.findIndex(function (r) { return r.kind === 'me' });
    var roster = publicRoster(seats);
    var H = HOST = { s: s, seats: seats, opts: opts, net: net, pending: null, alive: true };
    clientStart(roster, me, opts, net ? 'host' : 'local');
    var gid = G.id;
    G.onAction = function (a) { if (H.pending && H.pending.seat === me) H.pending.resolve(a) };
    seats.forEach(function (r, i) {
      if (r.kind === 'remote' && r.peer) net.send(r.peer, { t: 'start', roster: roster, seat: i, opts: opts });
    });
    function send(ev) {
      seats.forEach(function (r, i) {
        if (r.kind === 'me') pushPacket({ ev: ev, v: LC.view(s, i) });
        else if (r.kind === 'remote' && r.peer && net) net.send(r.peer, { t: 'pk', ev: ev, v: LC.view(s, i) });
      });
      if (net && LOBBY && LOBBY.specs.length) { var sv = LC.view(s, -1); LOBBY.specs.forEach(function (x) { if (x.peer) net.send(x.peer, { t: 'pk', ev: ev, v: sv }) }) }
    }
    H.watch = function (x) { net.send(x.peer, { t: 'start', roster: publicRoster(seats), seat: -1, opts: opts }); net.send(x.peer, { t: 'pk', ev: [{ t: 'sync' }], v: LC.view(s, -1) }) };
    H.send = send;
    H.resync = function (i) { var r = seats[i]; if (r.peer) { net.send(r.peer, { t: 'start', roster: publicRoster(seats), seat: i, opts: opts }); net.send(r.peer, { t: 'pk', ev: [{ t: 'sync' }], v: LC.view(s, i) }) } };
    function live() { return HOST === H && G && G.id === gid }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms / speed) }) }

    async function botMove(i) {
      var r = seats[i], v = LC.view(s, i);
      var d = BOT.decide(v, LC, A.INFO[r.key].persona, opts.level);
      var ms = d.action.type === 'call' ? 1300 + Math.random() * 900 : 900 + Math.random() * 1300;
      send([{ t: 'think', seat: i, ms: ms, tell: d.action.type === 'play' && BOT.showsTell(d.lying), nervous: s.players[i].pulls >= 3 }]);
      await wait(ms);
      return d.action;
    }
    function waitHuman(i) {
      return new Promise(function (resolve) {
        var r = seats[i], done = false, timers = [];
        function fin(a) { if (done) return; done = true; timers.forEach(clearTimeout); H.pending = null; resolve(a) }
        H.pending = { seat: i, resolve: fin };
        if (r.kind === 'remote') {
          // a dead connection hands the turn to a bot; a slow player gets the turn timer plus grace
          (function watch() { timers.push(setTimeout(function () { if (done) return; if (!r.peer) { r.botNow = true; botMove(i).then(fin) } else watch() }, 8000)) })();
          if (opts.timer) timers.push(setTimeout(function () { fin(LC.timeoutAction(s)) }, (opts.timer + 5) * 1000));
        }
      });
    }

    (async function loop() {
      try {
        await wait(400);
        send(LC.startRound(s, Math.floor(Math.random() * seats.length))); await idle();
        while (live()) {
          if (s.phase === 'over') break;
          if (s.phase === 'roundEnd') { await wait(600); if (!live()) return; send(LC.nextRound(s)); await idle(); continue }
          var i = s.turn, r = seats[i], a;
          if (r.kind === 'bot' || (r.kind === 'remote' && r.botNow)) a = await botMove(i);
          else a = await waitHuman(i);
          if (!live()) return;
          var res = LC.act(s, i, a);
          if (!res.ok) { if (r.kind === 'remote' && r.peer) net.send(r.peer, { t: 'pk', ev: [], v: LC.view(s, i) }); continue }
          send(res.ev); await idle();
        }
        H.alive = false;
        // people who left during the game give up their seat
        if (LOBBY) {
          LOBBY.seats = LOBBY.seats.filter(function (x) { return x.kind !== 'remote' || x.peer });
          // watchers take the free seats for the next game (bots make room)
          LOBBY.specs.forEach(function (x) {
            if (!x.peer) return;
            if (LOBBY.seats.length >= 6) { var b = LOBBY.seats.slice().reverse().find(function (y) { return y.kind === 'bot' }); if (!b) return; LOBBY.seats.splice(LOBBY.seats.indexOf(b), 1) }
            x.kind = 'remote'; x.key = freeKey(x.key, takenKeys()); LOBBY.seats.push(x);
          });
          LOBBY.specs = [];
          LOBBY.inGame = false; broadcastLobby();
        }
      } catch (e) { console.error(e) }
    })();
    return H;
  }
  function publicRoster(seats) { return seats.map(function (r) { return { name: r.name, key: r.key, fit: !!r.fit, kind: r.kind === 'bot' ? 'bot' : 'human' } }) }

  /* =====================================================================
     ONLINE: lobby (host side), guest side
     ===================================================================== */
  var NET = null, LOBBY = null, GUEST = null;
  var CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function newCode() { var c = ''; for (var i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return c }
  function myName() { return (settings.name || '').trim() || A.INFO[settings.char].name }

  function freeKey(want, taken) {
    if (want && taken.indexOf(want) < 0) return want;
    return A.ORDER.find(function (k) { return taken.indexOf(k) < 0 });
  }
  function takenKeys(except) { return LOBBY.seats.filter(function (s) { return s !== except }).map(function (s) { return s.key }) }

  async function createRoom() {
    AU.init();
    leaveOnline();
    showMsg('Opening a room...');
    var code, net, tries = 0;
    while (!net && tries++ < 4) {
      code = newCode();
      try { net = await window.LC_NET.host(code, 5) } catch (e) { if (e.code !== 'taken') { showMsg('Could not open a room (' + e.code + '). Check your internet and try again.', true); return } }
    }
    if (!net) { showMsg('Could not open a room. Try again.', true); return }
    NET = net;
    LOBBY = { code: code, seats: [{ kind: 'me', name: myName(), key: settings.char, fit: myFit() }], specs: [], opts: { timer: settings.timer, level: settings.level, theme: curTheme }, inGame: false };
    net.onJoin(function () {});
    net.onMsg(hostMsg);
    net.onLeave(function (peer) {
      var sp = LOBBY && LOBBY.specs.find(function (x) { return x.peer === peer });
      if (sp) { LOBBY.specs.splice(LOBBY.specs.indexOf(sp), 1); return }
      var s = LOBBY && LOBBY.seats.find(function (x) { return x.peer === peer });
      if (!s) return;
      if (HOST && HOST.alive && HOST.seats.indexOf(s) >= 0) {
        s.peer = null; s.away = true;
        var i = HOST.seats.indexOf(s);
        if (G && G.seats[i]) { G.seats[i].away = true; updateNP(i) }
        broadcast({ t: 'note', text: s.name + ' disconnected. A bot will play for them until they return.' });
        toast(esc(s.name) + ' disconnected');
      } else { LOBBY.seats.splice(LOBBY.seats.indexOf(s), 1); broadcastLobby() }
    });
    LOBBY.seen = {};
    LOBBY.hb = setInterval(function () {
      if (!NET || !NET.isHost) return;
      NET.send(null, { t: 'ping' });
      var now = Date.now();
      NET.peers().forEach(function (p) { if (!LOBBY.seen[p]) LOBBY.seen[p] = now; else if (now - LOBBY.seen[p] > 9000) { delete LOBBY.seen[p]; NET.drop(p) } });
    }, 2500);
    hideMsg();
    showLobby();
    broadcastLobby();
  }
  function broadcast(m) { if (NET && NET.isHost) NET.send(null, m) }
  function lobbyPublic() {
    return { t: 'lobby', code: LOBBY.code, opts: LOBBY.opts, inGame: LOBBY.inGame, watching: LOBBY.specs.map(function (x) { return x.name }), seats: LOBBY.seats.map(function (s) { return { name: s.name, key: s.key, fit: !!s.fit, kind: s.kind === 'bot' ? 'bot' : 'human', host: s.kind === 'me', away: !!s.away, peer: s.peer || null } }) };
  }
  function broadcastLobby() { if (!LOBBY) return; var m = lobbyPublic(); broadcast(m); renderLobby(m, true) }

  function hostMsg(peer, m) {
    if (!LOBBY || !m || !m.t) return;
    if (LOBBY.seen) LOBBY.seen[peer] = Date.now();
    if (m.t === 'pong') return;
    var s = LOBBY.seats.find(function (x) { return x.peer === peer });
    if (m.t === 'hello') {
      var name = String(m.name || 'Guest').slice(0, 16);
      // a returning player gets their seat back
      var back = LOBBY.seats.find(function (x) { return x.kind === 'remote' && x.token && x.token === m.token });
      if (back) {
        back.peer = peer; back.away = false; back.botNow = false;
        if (HOST && HOST.alive && HOST.seats.indexOf(back) >= 0) {
          var i = HOST.seats.indexOf(back);
          if (G && G.seats[i]) { G.seats[i].away = false; updateNP(i) }
          HOST.resync(i);
          broadcast({ t: 'note', text: back.name + ' is back!' }); toast(esc(back.name) + ' is back');
        } else broadcastLobby();
        return;
      }
      var oldSpec = LOBBY.specs.find(function (x) { return x.token && x.token === m.token });
      if (LOBBY.inGame && HOST && HOST.alive) {
        var w = oldSpec || { peer: peer, token: m.token, name: name, key: m.key, fit: !!m.fit };
        w.peer = peer; if (!oldSpec) LOBBY.specs.push(w);
        HOST.watch(w); toast('👀 ' + esc(name) + ' is watching'); broadcast({ t: 'note', text: name + ' is watching and joins the next game' });
        return;
      }
      if (LOBBY.seats.length >= 6) {
        var bot = LOBBY.seats.slice().reverse().find(function (x) { return x.kind === 'bot' });
        if (!bot) { NET.drop(peer, { t: 'full' }); return }
        LOBBY.seats.splice(LOBBY.seats.indexOf(bot), 1);
      }
      LOBBY.seats.push({ kind: 'remote', peer: peer, token: m.token, name: name, key: freeKey(m.key, takenKeys()), fit: !!m.fit });
      AU.play('pop'); toast(esc(name) + ' joined');
      broadcastLobby();
    } else if (!s) return;
    else if (m.t === 'pick' && !LOBBY.inGame) { s.key = freeKey(m.key, takenKeys(s)); s.fit = !!m.fit && s.key === m.key; broadcastLobby() }
    else if (m.t === 'name' && !LOBBY.inGame) { s.name = String(m.name || s.name).slice(0, 16); broadcastLobby() }
    else if (m.t === 'act') { if (HOST && HOST.pending && HOST.seats[HOST.pending.seat] === s) HOST.pending.resolve(m.a) }
    else if (m.t === 'react') { var i2 = HOST ? HOST.seats.indexOf(s) : -1; if (i2 >= 0) relayReact(i2, String(m.e).slice(0, 40)) }
    else if (m.t === 'bye') { NET.drop(peer); var idx = LOBBY.seats.indexOf(s); if (idx >= 0 && !(HOST && HOST.alive)) { LOBBY.seats.splice(idx, 1); broadcastLobby() } }
  }
  function relayReact(i, e) {
    showReact(i, e);
    if (HOST) HOST.seats.forEach(function (r) { if (r.kind === 'remote' && r.peer) NET.send(r.peer, { t: 'react', seat: i, e: e }) });
  }
  function showReact(i, e) {
    if (!G || !G.seats[i]) return;
    var emoji = REACT.indexOf(e) >= 0;
    say(i, e, emoji ? 1500 : 2200, emoji ? 'emoji' : 'taunt');
    AU.play('taunt');
  }

  function hostStart() {
    if (!LOBBY || LOBBY.seats.length < 2) return;
    LOBBY.inGame = true;
    LOBBY.seats.forEach(function (s) { s.botNow = false });
    broadcastLobby();
    hostGame(LOBBY.seats, LOBBY.opts, NET);
  }

  async function joinRoom(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (code.length !== 4) { showMsg('Room codes have 4 letters.', true); return }
    AU.init();
    leaveOnline();
    showMsg('Joining room ' + code + '...');
    try { NET = await window.LC_NET.join(code) }
    catch (e) { NET = null; showMsg(e.code === 'no_room' ? 'No room called ' + code + '. Check the code with your friend.' : 'Could not connect (' + e.code + '). Try again.', true); return }
    GUEST = { code: code, lostAt: 0, seen: Date.now() };
    GUEST.wd = setInterval(function () {
      if (!GUEST) return;
      var quiet = Date.now() - GUEST.seen;
      if (quiet > 10000 && !GUEST.lostAt) { GUEST.lostAt = Date.now(); showMsg('Connection lost. Reconnecting...') }
      if (GUEST.lostAt && Date.now() - GUEST.lostAt > 25000) { showMsg('Lost the room. The host may have left.', true); leaveOnline(true) }
    }, 1000);
    NET.onMsg(guestMsg);
    NET.onLost(function () { if (GUEST && !GUEST.lostAt) { GUEST.lostAt = Date.now(); showMsg('Connection lost. Reconnecting...') } });
    NET.onBack(function () { if (GUEST) { GUEST.lostAt = 0; GUEST.seen = Date.now() } hideMsg(); hello() });
    hello();
  }
  function hello() { if (NET) NET.send(null, { t: 'hello', name: myName(), key: settings.char, fit: myFit(), token: TOKEN }) }
  function guestMsg(m) {
    if (!m || !m.t) return;
    if (GUEST) { GUEST.seen = Date.now(); if (GUEST.lostAt && m.t !== 'closed') { GUEST.lostAt = 0; hideMsg() } }
    if (m.t === 'ping') { NET.send(null, { t: 'pong' }); return }
    if (m.t === 'lobby') { hideMsg(); GUEST.lobby = m; if (!G) { applyTheme(m.opts.theme); showLobby() } renderLobby(m, false) }
    else if (m.t === 'start') {
      hideMsg();
      clientStart(m.roster, m.seat, m.opts, 'guest');
      G.onAction = function (a) { NET.send(null, { t: 'act', a: a }) };
      if (m.seat < 0) toast('👀 Game in progress. You\'re watching and join the next game.');
    }
    else if (m.t === 'pk') pushPacket({ ev: m.ev, v: m.v });
    else if (m.t === 'react') showReact(m.seat, m.e);
    else if (m.t === 'note') toast(esc(m.text));
    else if (m.t === 'busy') { showMsg('A game is in progress in this room. Wait for it to finish and join again.', true); leaveOnline(true) }
    else if (m.t === 'full') { showMsg('That room is full (6 players).', true); leaveOnline(true) }
    else if (m.t === 'closed') { showMsg('The host closed the room.', true); leaveOnline(true) }
    else if (m.t === 'kicked') { showMsg('The host removed you from the room.', true); leaveOnline(true) }
  }

  function leaveOnline(keepMsg) {
    if (NET) { try { NET.send(null, { t: NET.isHost ? 'closed' : 'bye' }) } catch (e) {} var n = NET; setTimeout(function () { try { n.leave() } catch (e) {} }, 150) }
    if (LOBBY && LOBBY.hb) clearInterval(LOBBY.hb);
    if (GUEST && GUEST.wd) clearInterval(GUEST.wd);
    NET = null; LOBBY = null; GUEST = null; HOST = null;
    if (G) { stopTimer(); G.id = -1; G = null }
    if (!keepMsg) hideMsg();
  }

  /* ---------------- lobby screen ---------------- */
  function showLobby() { show('lobby') }
  function renderLobby(m, isHost) {
    $('lobCode').textContent = m.code;
    var link = location.origin + location.pathname + '?room=' + m.code;
    $('lobLink').value = link;
    $('lobWa').href = 'https://wa.me/?text=' + encodeURIComponent("Aaja Liar's Call khelne! 🌶️ Room " + m.code + ' · ' + link);
    var grid = $('lobSeats'); grid.innerHTML = '';
    for (var k = 0; k < 6; k++) {
      var s = m.seats[k];
      var slot = el('div', 'slot' + (s ? '' : ' empty'));
      if (s) {
        var you = isHost ? s.host : isMine(m, k);
        slot.innerHTML = '<div class="pic">' + A.character(s.key, s.fit) + '</div><div class="nm">' + esc(s.name) + '</div><div class="tg">' + (s.host ? '<span class="t host">Host</span>' : '') + (you ? '<span class="t you">You</span>' : '') + (s.kind === 'bot' ? '<span class="t bot">Bot</span>' : '') + (s.away ? '<span class="t away">Offline</span>' : '') + '</div>';
        if (isHost && !s.host && !m.inGame) {
          var x = el('button', 'x', '✕'); x.title = s.kind === 'bot' ? 'Remove bot' : 'Remove player';
          x.onclick = (function (idx) { return function () { removeSeat(idx) } })(k);
          slot.appendChild(x);
        }
      } else if (isHost && !m.inGame) {
        slot.innerHTML = '<button class="add">+ Add bot</button>';
        slot.querySelector('.add').onclick = addBot;
      } else slot.innerHTML = '<div class="wait">Waiting...</div>';
      grid.appendChild(slot);
    }
    // my character strip
    var taken = m.seats.map(function (s) { return s.key });
    var myIdx = isHost ? 0 : m.seats.findIndex(function (s, i) { return isMine(m, i) });
    var myKey = myIdx >= 0 ? m.seats[myIdx].key : settings.char;
    var strip = $('lobPick'); strip.innerHTML = '';
    A.ORDER.forEach(function (k) {
      var b = el('button', 'mini' + (k === myKey ? ' sel' : '') + (taken.indexOf(k) >= 0 && k !== myKey ? ' taken' : ''), A.character(k, !!(settings.fit[k] && unlocked(k))));
      b.title = A.INFO[k].name;
      b.onclick = function () {
        if (taken.indexOf(k) >= 0 && k !== myKey) return;
        settings.char = k; save('lc-settings', settings); AU.play('pop');
        var f2 = !!(settings.fit[k] && unlocked(k));
        if (isHost) { LOBBY.seats[0].key = k; LOBBY.seats[0].fit = f2; broadcastLobby() } else NET.send(null, { t: 'pick', key: k, fit: f2 });
      };
      strip.appendChild(b);
    });
    $('lobHostOpts').style.display = isHost ? '' : 'none';
    $('lobStart').style.display = isHost ? '' : 'none';
    $('lobGuestWait').style.display = isHost ? 'none' : 'block';
    $('lobGuestWait').textContent = m.inGame ? 'Game in progress...' : 'Waiting for the host to start the game...';
    $('lobWatch').textContent = m.watching && m.watching.length ? '👀 Watching: ' + m.watching.join(', ') : '';
    if (isHost) {
      segL('lobTimer', [[0, 'Off'], [15, '15s'], [30, '30s'], [45, '45s']], 'timer');
      segL('lobLevel', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], 'level');
      segL('lobTheme', Object.keys(A.THEMES).map(function (k) { return [k, A.THEMES[k].emoji + ' ' + A.THEMES[k].name] }), 'theme');
      var btn = $('lobStart');
      btn.disabled = m.seats.length < 2 || m.inGame;
      btn.innerHTML = m.seats.length < 2 ? 'Need 2+ players' : 'START GAME<small>' + m.seats.length + ' at the table</small>';
    } else {
      $('lobInfo').textContent = 'Table: ' + (A.THEMES[m.opts.theme] || A.THEMES.wedding).name + ' · Turn timer: ' + (m.opts.timer ? m.opts.timer + 's' : 'off') + ' · Bots: ' + m.opts.level;
      if (m.opts.theme && m.opts.theme !== curTheme) applyTheme(m.opts.theme);
    }
  }
  // guests recognise themselves by peer id (the host includes it)
  function isMine(m, k) { return !!(NET && !NET.isHost && m.seats[k] && m.seats[k].peer === NET.id) }
  function segL(id, vals, key) {
    var s = $(id); s.innerHTML = '';
    vals.forEach(function (v) {
      var b = el('button', LOBBY.opts[key] === v[0] ? 'on' : '', v[1]);
      b.onclick = function () { LOBBY.opts[key] = v[0]; settings[key] = v[0]; save('lc-settings', settings); AU.play('click'); if (key === 'theme') applyTheme(v[0]); broadcastLobby() };
      s.appendChild(b);
    });
  }
  function addBot() {
    if (!LOBBY || LOBBY.seats.length >= 6) return;
    var key = freeKey(null, takenKeys());
    LOBBY.seats.push({ kind: 'bot', name: A.INFO[key].name, key: key, fit: Math.random() < 0.35 });
    AU.play('pop'); broadcastLobby();
  }
  function removeSeat(k) {
    var s = LOBBY.seats[k]; if (!s || s.kind === 'me') return;
    if (s.kind === 'remote' && s.peer) { var p = s.peer; LOBBY.seats.splice(k, 1); NET.drop(p, { t: 'kicked' }, true) }
    else LOBBY.seats.splice(k, 1);
    broadcastLobby();
  }

  /* =====================================================================
     SCREENS
     ===================================================================== */
  var SCREENS = ['home', 'online', 'botsetup', 'lobby', 'howto', 'over', 'pause'];
  function show(name) {
    SCREENS.forEach(function (k) { $(k).classList.toggle('show', k === name) });
    document.body.classList.toggle('menu', !!name && name !== 'howto' && name !== 'pause' && name !== 'over');
  }
  function showMsg(t, isErr) { var m = $('msg'); m.innerHTML = '<div class="box' + (isErr ? ' err' : '') + '">' + esc(t) + (isErr ? '<button class="btn ghost" id="msgOk">OK</button>' : '<div class="spin"></div>') + '</div>'; m.classList.add('show'); if (isErr) $('msgOk').onclick = function () { hideMsg(); goHome() } }
  function hideMsg() { $('msg').classList.remove('show') }
  function toast(html) { var t = el('div', 'toast', html); $('toasts').appendChild(t); setTimeout(function () { t.classList.add('bye'); setTimeout(function () { t.remove() }, 400) }, 2600) }

  function goHome() {
    leaveOnline(true);
    clearFx(); clearTable();
    document.body.classList.remove('spectating');
    applyTheme(settings.theme || 'wedding');
    buildHome(); show('home');
  }

  /* ---------------- home ---------------- */
  var homeIdx = 0;
  function buildHome() {
    homeIdx = Math.max(0, A.ORDER.indexOf(settings.char));
    var car = $('homeCast'); car.innerHTML = '';
    A.ORDER.forEach(function (k, i) {
      var b = el('button', 'castme', A.character(k, !!(settings.fit[k] && unlocked(k))));
      b.onclick = function () { setHomeChar(i) };
      car.appendChild(b);
    });
    setHomeChar(homeIdx, true);
    $('homeName').value = settings.name || '';
    $('homeName').placeholder = A.INFO[settings.char].name;
    var st = $('homeStats');
    st.innerHTML = '<div><b>' + stats.games + '</b><span>games</span></div><div><b>' + stats.wins + '</b><span>wins</span></div><div><b>' + (stats.games ? Math.round(stats.wins / stats.games * 100) : 0) + '%</b><span>win rate</span></div><div><b>' + (stats.best || 0) + '</b><span>best streak</span></div>';
  }
  function setHomeChar(i, quiet) {
    homeIdx = (i + 6) % 6;
    var k = A.ORDER[homeIdx];
    settings.char = k; save('lc-settings', settings);
    var bs = [].slice.call($('homeCast').children);
    bs.forEach(function (b, j) {
      var d = ((j - homeIdx + 9) % 6) - 3;            // -3..2 relative to the centre
      var ad = Math.abs(d), gap = portrait ? 118 : 170;
      b.style.transform = 'translateX(' + (d * gap) + 'px) scale(' + (d === 0 ? 1.28 : 0.82 - ad * 0.07) + ')';
      b.style.opacity = ad >= 3 ? 0 : 1 - ad * 0.18;
      b.style.zIndex = 10 - ad;
      b.style.pointerEvents = ad >= 3 ? 'none' : 'auto';
      b.classList.toggle('sel', d === 0);
      b.querySelector('.ch').setAttribute('data-ex', d === 0 ? 'happy' : 'neutral');
    });
    renderFit(k);
    $('homeWho').innerHTML = '<b>' + A.INFO[k].name + '</b><span>' + ({ careful: 'Careful player', sneaky: 'Sneaky player', reckless: 'Reckless player' })[A.INFO[k].persona] + ' · tell: ' + A.INFO[k].tell + '</span>';
    $('homeName').placeholder = A.INFO[k].name;
    if (!quiet) { AU.init(); AU.play('pop') }
  }

  function renderFit(k) {
    var box2 = $('homeFit'), n = stats.cw[k] || 0;
    if (unlocked(k)) {
      box2.innerHTML = '<span class="lab">Look</span><div class="seg"><button class="' + (settings.fit[k] ? '' : 'on') + '" data-f="0">Classic</button><button class="' + (settings.fit[k] ? 'on' : '') + '" data-f="1">👘 ' + A.INFO[k].fit + '</button></div>';
      box2.querySelectorAll('button').forEach(function (b) {
        b.onclick = function () { settings.fit[k] = b.dataset.f === '1'; save('lc-settings', settings); AU.play('pop'); var cur = homeIdx; buildHome(); setHomeChar(cur, true) };
      });
    } else box2.innerHTML = '<div class="locked">🔒 <b>' + A.INFO[k].fit + '</b> · win ' + (UNLOCK - n) + ' more game' + (UNLOCK - n > 1 ? 's' : '') + ' as ' + A.INFO[k].name + '</div>';
  }

  function startLocal() {
    AU.init(); AU.play('pop'); AU.startMusic();
    leaveOnline(true);
    var n = settings.n, mine = settings.char;
    var others = A.ORDER.filter(function (k) { return k !== mine }).sort(function () { return Math.random() - 0.5 });
    var seats = [{ kind: 'me', name: myName(), key: mine, fit: myFit() }].concat(others.slice(0, n - 1).map(function (k) { return { kind: 'bot', name: A.INFO[k].name, key: k, fit: Math.random() < 0.35 } }));
    hostGame(seats, { timer: settings.timer, level: settings.level, theme: curTheme }, null);
  }

  function seg(id, vals, key) {
    var s = $(id); s.innerHTML = '';
    vals.forEach(function (v) {
      var val = Array.isArray(v) ? v[0] : v, lab = Array.isArray(v) ? v[1] : v;
      var b = el('button', settings[key] === val ? 'on' : '', String(lab));
      b.onclick = function () { settings[key] = val; save('lc-settings', settings); AU.init(); AU.play('click'); if (key === 'theme') applyTheme(val); seg(id, vals, key) };
      s.appendChild(b);
    });
  }

  /* ---------------- input ---------------- */
  function bind() {
    $('hand').addEventListener('click', function (ev) {
      var c = ev.target.closest('.hcard'); if (!c || !G || !G.human || !G.human.o.canPlay) return;
      var id = c.dataset.id;
      if (G.sel[id]) delete G.sel[id];
      else { if (Object.keys(G.sel).length >= G.human.o.maxPlay) return; G.sel[id] = 1 }
      AU.play('click'); layoutHand(); updateControls();
    });
    $('btnPlay').onclick = function () { if (!G || !G.human || this.disabled) return; submit({ type: 'play', cards: Object.keys(G.sel) }) };
    $('btnLiar').onclick = function () { if (!G || !G.human || this.disabled) return; submit({ type: 'call' }) };
    // home
    $('homePrev').onclick = function () { setHomeChar(homeIdx - 1) };
    $('homeNext').onclick = function () { setHomeChar(homeIdx + 1) };
    $('homeName').addEventListener('input', function () { settings.name = this.value.slice(0, 16); save('lc-settings', settings) });
    $('goOnline').onclick = function () { AU.init(); AU.play('click'); AU.startMusic(); show('online'); setTimeout(function () { $('joinCode').focus() }, 50) };
    $('goBots').onclick = function () { AU.init(); AU.play('click'); AU.startMusic(); seg('optN', [2, 3, 4, 5, 6], 'n'); seg('optL', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], 'level'); seg('optT', [[0, 'Off'], [15, '15s'], [30, '30s'], [45, '45s']], 'timer'); seg('optTheme', Object.keys(A.THEMES).map(function (k) { return [k, A.THEMES[k].emoji + ' ' + A.THEMES[k].name] }), 'theme'); show('botsetup') };
    $('goHow').onclick = function () { AU.init(); show('howto') };
    $('btnStart').onclick = startLocal;
    document.querySelectorAll('.back').forEach(function (b) { b.onclick = function () { AU.play('click'); goHome() } });
    // online
    $('btnCreate').onclick = createRoom;
    $('btnJoin').onclick = function () { joinRoom($('joinCode').value) };
    $('joinCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') joinRoom(this.value) });
    $('joinCode').addEventListener('input', function () { this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) });
    $('lobStart').onclick = hostStart;
    $('lobLeave').onclick = function () { AU.play('click'); goHome() };
    $('lobCopy').onclick = function () {
      var t = $('lobLink').value;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Invite link copied') }, function () { $('lobLink').select(); try { document.execCommand('copy'); toast('Invite link copied') } catch (e) {} });
    };
    // over / pause / help
    $('btnAgain').onclick = function () { show(null); if (G && G.mode === 'host') hostStart(); else startLocal() };
    $('btnMenu').onclick = function () {
      if (G && G.mode === 'host') { stopTimer(); G.id = -1; G = null; HOST = null; LOBBY.inGame = false; clearFx(); clearTable(); show('lobby'); broadcastLobby() }
      else if (G && G.mode === 'guest' && GUEST) { stopTimer(); G.id = -1; G = null; clearFx(); clearTable(); show('lobby'); if (GUEST.lobby) renderLobby(GUEST.lobby, false) }
      else goHome();
    };
    $('btnHowBack').onclick = function () { show(G && G.id > 0 && !$('home').classList.contains('show') ? null : 'home') };
    $('btnPause').onclick = function () { show('pause') };
    $('btnResume').onclick = function () { show(null) };
    $('btnQuit').onclick = function () { goHome() };
    $('btnHelp').onclick = function () { show('howto') };
    $('btnLog').onclick = function () { $('logPanel').classList.toggle('show') };
    $('ticker').onclick = function () { $('logPanel').classList.toggle('show') };
    $('ff').onclick = function () { speed = speed === 1 ? 3 : 1; this.textContent = speed === 1 ? '⏩ Fast forward' : '▶ Normal speed' };
    var mus = $('btnMusic'), sfx = $('btnSfx');
    function sync() { mus.classList.toggle('off', !AU.isOn('music')); sfx.classList.toggle('off', !AU.isOn('sfx')) }
    sfx.onclick = function () { AU.init(); AU.toggle('sfx'); sync() };
    var fs = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
    document.querySelectorAll('.btnFull').forEach(function (b) {
      if (!fs) { b.style.display = 'none'; return }
      b.onclick = function () {
        if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else { var pr = fs.call(document.documentElement); if (pr && pr.catch) pr.catch(function () {}) }
      };
    });
    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; $('btnInstall').style.display = '' });
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone;
    if (ios) $('btnInstall').style.display = '';
    $('btnInstall').onclick = function () {
      if (deferred) { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; $('btnInstall').style.display = 'none' }) }
      else showMsg('On iPhone: tap the Share button in Safari, then "Add to Home Screen". Liar\'s Call will open full screen like an app.', true);
    };
    window.addEventListener('appinstalled', function () { $('btnInstall').style.display = 'none'; toast('Installed! Open Liar\'s Call from your home screen') });
    mus.onclick = function () { AU.init(); var on = AU.toggle('music'); if (on) AU.startMusic(); sync() };
    sync();
    // reactions + taunts
    var rb = $('react');
    function react(e) {
      if (!G) return;
      if (G.mode === 'guest') { if (NET) NET.send(null, { t: 'react', e: e }); return }
      if (G.mode === 'host') { relayReact(G.me, e); return }
      showReact(G.me, e);
      setTimeout(function () { if (!G) return; var others = G.seats.filter(function (st, k) { return st.kind === 'bot' && P(k).alive }); if (others.length && Math.random() < 0.5) { var o = rnd(others); say(o.i, rnd(REACT), 1400, 'emoji') } }, 600);
    }
    REACT.forEach(function (r) { var b = el('button', '', r); b.onclick = function () { react(r) }; rb.appendChild(b) });
    var tb = el('button', 'tauntbtn', '💬'); tb.title = 'Quick taunts'; rb.appendChild(tb);
    var tp = $('tauntPanel');
    TAUNTS.forEach(function (t) { var b = el('button', '', t); b.onclick = function () { tp.classList.remove('show'); react(t) }; tp.appendChild(b) });
    tb.onclick = function () { tp.classList.toggle('show') };
    document.addEventListener('keydown', function (ev) {
      if (ev.target && ev.target.tagName === 'INPUT') return;
      if (!G || !G.human) return;
      if (ev.key >= '1' && ev.key <= '9') { var c = $('hand').querySelector('.hcard[data-k="' + (ev.key - 1) + '"]'); if (c) c.click() }
      else if (ev.key === 'Enter') $('btnPlay').click();
      else if (ev.key === 'l' || ev.key === 'L') $('btnLiar').click();
    });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(computeLayout, 120) });
    window.addEventListener('pagehide', function () { if (NET) { try { if (!NET.isHost) NET.send(null, { t: 'bye' }); NET.leave() } catch (e) {} } });
  }

  function howtoCards() {
    $('howCards').innerHTML = ['K', 'Q', 'A', 'J'].map(function (r) { return '<div>' + A.cardFace(r) + '</div>' }).join('') + '<div class="hg">' + A.golgappa(74) + '</div>';
  }

  window.addEventListener('DOMContentLoaded', function () {
    computeLayout(); bind(); buildHome(); howtoCards(); show('home');
    if ('serviceWorker' in navigator && location.protocol === 'https:' && !/claude\.ai|claudeusercontent/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(function () {});
    var q = new URLSearchParams(location.search).get('room');
    if (q) { show('online'); $('joinCode').value = q.toUpperCase().slice(0, 4); $('onlineHint').textContent = 'You were invited to room ' + q.toUpperCase() + '. Pick your character on the home screen or just hit Join.' }
    window.__LC = { get G() { return G }, get HOST() { return HOST }, get LOBBY() { return LOBBY }, get NET() { return NET }, speedUp: function (x) { speed = x }, createRoom: createRoom, joinRoom: joinRoom, addBot: addBot, hostStart: hostStart };
  });
})();
