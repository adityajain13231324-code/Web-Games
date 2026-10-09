/* Blackjack 21: art. Everything is drawn in code (SVG and CSS), so there are no image files to load.
   BJArt.card(c)   -> HTML for a face-up card (classic 52-card deck, standard pip layouts)
   BJArt.back()    -> HTML for a face-down card
   BJArt.chip(v)   -> HTML for one chip of value v
   BJArt.stack(n)  -> HTML for piles of chips worth n
   BJArt.icon(n)   -> small line icons for the interface
   BJArt.dealer()  -> the dealer's portrait
   BJArt.init()    -> inserts the shared SVG definitions once */
(function (root) {
  'use strict';

  var PATHS = {
    S: '<path d="M50 4C50 4 8 38 8 62c0 14 11 22 22 22 8 0 14-4 17-10-1 10-5 18-13 22h32c-8-4-12-12-13-22 3 6 9 10 17 10 11 0 22-8 22-22C92 38 50 4 50 4z"/>',
    H: '<path d="M50 92C18 66 6 48 6 32 6 17 17 8 29 8c9 0 17 5 21 13 4-8 12-13 21-13 12 0 23 9 23 24 0 16-12 34-44 60z"/>',
    D: '<path d="M50 3L89 50 50 97 11 50z"/>',
    C: '<circle cx="50" cy="27" r="22"/><circle cx="25" cy="63" r="22"/><circle cx="75" cy="63" r="22"/><path d="M50 50L36 96h28z"/>'
  };
  var COLOR = { S: '#15171a', C: '#15171a', H: '#b3261e', D: '#b3261e' };
  var COLOR4 = { S: '#15171a', C: '#1f7a3d', H: '#b3261e', D: '#1f5fb3' };      // four-colour deck: easier to tell the suits apart
  var fourColour = false;
  var SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
  var SERIF = "'Cinzel','Playfair Display',Georgia,serif";

  function defs() {
    var out = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>';
    Object.keys(PATHS).forEach(function (s) { out += '<symbol id="s-' + s + '" viewBox="0 0 100 100">' + PATHS[s] + '</symbol>' });
    out += '<linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffefa"/><stop offset=".6" stop-color="#f6f1e4"/><stop offset="1" stop-color="#e9e2cf"/></linearGradient>';
    out += '<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6df9a"/><stop offset=".5" stop-color="#d4af37"/><stop offset="1" stop-color="#9a7418"/></linearGradient>';
    return out + '</defs></svg>';
  }
  function use(s, x, y, size, flip) {
    return '<use href="#s-' + s + '" x="' + (x - size / 2) + '" y="' + (y - size / 2) + '" width="' + size + '" height="' + size + '"' +
      (flip ? ' transform="rotate(180 ' + x + ' ' + y + ')"' : '') + '/>';
  }

  // pip positions on a 100 x 140 card
  var L = { l: 31, c: 50, r: 69 }, T = 35, B = 105, M = 70;
  var PIPS = {
    '2': [[L.c, T], [L.c, B]],
    '3': [[L.c, T], [L.c, M], [L.c, B]],
    '4': [[L.l, T], [L.r, T], [L.l, B], [L.r, B]],
    '5': [[L.l, T], [L.r, T], [L.c, M], [L.l, B], [L.r, B]],
    '6': [[L.l, T], [L.r, T], [L.l, M], [L.r, M], [L.l, B], [L.r, B]],
    '7': [[L.l, T], [L.r, T], [L.c, 52], [L.l, M], [L.r, M], [L.l, B], [L.r, B]],
    '8': [[L.l, T], [L.r, T], [L.c, 52], [L.l, M], [L.r, M], [L.c, 88], [L.l, B], [L.r, B]],
    '9': [[L.l, T], [L.r, T], [L.l, 57], [L.r, 57], [L.c, M], [L.l, 83], [L.r, 83], [L.l, B], [L.r, B]],
    '10': [[L.l, T], [L.r, T], [L.c, 52], [L.l, 57], [L.r, 57], [L.l, 83], [L.r, 83], [L.c, 88], [L.l, B], [L.r, B]]
  };

  // court card ornaments: a crown for K and Q, a plume for J
  var ORN = {
    K: '<path d="M-17 12L-20-6-8 2 0-10 8 2 20-6 17 12z" fill="url(#gold)" stroke="#7a5a12" stroke-width="1.2" stroke-linejoin="round"/><circle cx="0" cy="-12" r="2.2" fill="#d4af37"/>',
    Q: '<path d="M-17 12L-19-4-9 4-4-6 0 4 4-6 9 4 19-4 17 12z" fill="url(#gold)" stroke="#7a5a12" stroke-width="1.2" stroke-linejoin="round"/><circle cx="-19" cy="-6" r="2.2" fill="#d4af37"/><circle cx="19" cy="-6" r="2.2" fill="#d4af37"/><circle cx="0" cy="-8" r="2.2" fill="#d4af37"/>',
    J: '<path d="M-16 12C-6 10 8 2 17-12 15 0 6 12-16 12z" fill="url(#gold)" stroke="#7a5a12" stroke-width="1.2" stroke-linejoin="round"/><path d="M-16 12L-8 6" stroke="#7a5a12" stroke-width="1.2" fill="none"/>'
  };

  var cache = {};
  function card(c) {
    var key = c.r + c.s + (fourColour ? '4' : '');
    if (cache[key]) return cache[key];
    var col = (fourColour ? COLOR4 : COLOR)[c.s], r = c.r, svg = '';
    svg += '<rect x=".75" y=".75" width="98.5" height="138.5" rx="8" fill="url(#paper)" stroke="#a79f88" stroke-width="1.2"/>';
    svg += '<g fill="' + col + '">';
    var fs = r === '10' ? 18 : 23;
    [false, true].forEach(function (flip) {
      svg += '<g' + (flip ? ' transform="rotate(180 50 70)"' : '') + '>' +
        '<text x="13" y="24" text-anchor="middle" font-family="' + SERIF + '" font-weight="700" font-size="' + fs + '">' + r + '</text>' +
        use(c.s, 13, 38, 13) + '</g>';
    });
    if (r === 'A') svg += use(c.s, 50, 70, 50);
    else if (r === 'J' || r === 'Q' || r === 'K') {
      svg += '</g><rect x="23" y="24" width="54" height="92" rx="3" fill="#fbf3dc" stroke="' + col + '" stroke-width="1.4"/>' +
        '<rect x="27" y="28" width="46" height="84" rx="2" fill="none" stroke="' + col + '" stroke-width=".7" opacity=".7"/>' +
        '<g transform="translate(50 46)">' + ORN[r] + '</g><g transform="translate(50 94) rotate(180)">' + ORN[r] + '</g>' +
        '<line x1="30" y1="70" x2="70" y2="70" stroke="' + col + '" stroke-width=".6" opacity=".6"/><g fill="' + col + '">' +
        '<text x="50" y="82" text-anchor="middle" font-family="' + SERIF + '" font-weight="800" font-size="40">' + r + '</text>' +
        use(c.s, 36, 60, 11) + use(c.s, 64, 60, 11);
    } else {
      PIPS[r].forEach(function (p) { svg += use(c.s, p[0], p[1], 24, p[1] > M) });
    }
    svg += '</g>';
    var html = '<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + r + ' of ' + SYMBOL[c.s] + '">' + svg + '</svg>';
    return (cache[key] = html);
  }
  function back() {
    return '<div class="cardback"><svg viewBox="0 0 100 140" preserveAspectRatio="none"><rect x="9" y="9" width="82" height="122" rx="4" fill="none" stroke="#d4af37" stroke-width="1.6"/>' +
      '<g fill="none" stroke="#d4af37" stroke-width="1" opacity=".85"><path d="M50 24L74 70 50 116 26 70z"/><path d="M50 40L63 70 50 100 37 70z"/><circle cx="50" cy="70" r="5"/></g></svg></div>';
  }

  function label(v) { return v >= 1000 ? (v / 1000) + 'K' : String(v) }
  function chip(v, extra) { return '<div class="chip c' + v + (extra ? ' ' + extra : '') + '"><i></i><span>' + label(v) + '</span></div>' }

  // piles of chips for an amount, grouped by value (biggest first); tall piles show a count
  function stack(amount, BJ) {
    var parts = BJ.chipsFor(amount), keys = Object.keys(parts).map(Number).sort(function (a, b) { return b - a }), out = '';
    keys.forEach(function (v) {
      var n = parts[v], shown = Math.min(n, 6), pile = '';
      for (var i = 0; i < shown; i++) pile += '<div class="chip c' + v + '" style="bottom:' + (i * 3) + 'px"><i></i><span>' + label(v) + '</span></div>';
      out += '<div class="pile" style="height:calc(var(--chip) + ' + ((shown - 1) * 3) + 'px)">' + pile + (n > shown ? '<b class="cnt">' + n + '</b>' : '') + '</div>';
    });
    return out;
  }

  var ICONS = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    log: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 1 1 3.7 2.4c-.8.4-1.2 1-1.2 1.9"/><circle cx="12" cy="17" r=".9" fill="currentColor"/>',
    crown: '<path d="M3 18l-1-11 5 4 5-7 5 7 5-4-1 11z" fill="currentColor" stroke="none"/><path d="M4 21h16"/>',
    chip: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
    cards: '<rect x="4" y="4" width="11" height="15" rx="2"/><path d="M17 7l3 1-3.5 12.5L13 20" />',
    sound: '<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="16.5" cy="16" r="2.5" fill="currentColor"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z" fill="currentColor" stroke="none"/>',
    play: '<path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".9" fill="currentColor"/>',
    spade: '<path d="M12 2s-8 7-8 12c0 3 2.200 4.500 4.500 4.500 1.600 0 2.800-.8 3.500-2-.2 2.500-1 4-2.500 5.500h5C14 22 13.200 20.500 13 18c.700 1.200 1.900 2 3.500 2 2.300 0 4.500-1.500 4.500-4.500 0-5-9-12-9-12z" fill="currentColor" stroke="none"/>'
  };
  function icon(n) { return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>' }

  function dealer(mood) { return portrait('dealer', mood) }

  /* ---------- character portraits: one small face rig, many looks ---------- */
  var CHARS = {
    dealer: { bg: ['#2f6b55', '#123127'], skin: '#e9bf98', hair: ['slick', '#1d1510'], eyes: 'dot', jacket: '#17191c', shirt: '#f6f3ec', tie: 'bow', tieC: '#b3261e', ex: ['stache'] },
    lou: { bg: ['#e8923f', '#8f4a12'], skin: '#d8a173', hair: ['curly', '#4a2a14'], eyes: 'dot', jacket: '#e2742d', shirt: '#fbe6b8', tie: 'chain', ex: ['blush', 'flowers'] },
    rouge: { bg: ['#9b2f78', '#3f0f30'], skin: '#f0c8a8', hair: ['bob', '#17100f'], eyes: 'dot', jacket: '#a31f2f', shirt: '#a31f2f', tie: 'none', ex: ['lipstick', 'earrings', 'pearls'] },
    pip: { bg: ['#2f77c4', '#10305a'], skin: '#efc9a4', hair: ['messy', '#c3c3ca'], eyes: 'round', jacket: '#7a5a3a', shirt: '#f2efe6', tie: 'bow', tieC: '#2b4f9a', ex: [] },
    tony: { bg: ['#9a6424', '#3a2008'], skin: '#b9825a', hair: ['bald', '#222'], eyes: 'shades', jacket: '#1a1a1d', shirt: '#e9e9e9', tie: 'tie', tieC: '#7a1d1d', ex: ['goatee', 'chain'] },
    penny: { bg: ['#cc5f88', '#5a1f36'], skin: '#f3cfb0', hair: ['ponytail', '#a5502a'], eyes: 'dot', jacket: '#efc94c', shirt: '#fff', tie: 'none', ex: ['freckles', 'sweat'] },
    sam: { bg: ['#566471', '#1b2126'], skin: '#8a5a3c', hair: ['fedora', '#3b3f45'], eyes: 'dot', jacket: '#2a2f35', shirt: '#d8d8d8', tie: 'tie', tieC: '#555', ex: [] },
    dot: { bg: ['#7650b4', '#2b1a4a'], skin: '#f1d2b8', hair: ['bun', '#dadae0'], eyes: 'cat', jacket: '#5a3a8a', shirt: '#5a3a8a', tie: 'none', ex: ['pearls', 'earrings', 'lipstick'] },
    ace: { bg: ['#22987a', '#0b3d2e'], skin: '#e9bf9a', hair: ['cap', '#1d6b3f'], brow: '#b5532a', eyes: 'dot', jacket: '#2f7a4b', shirt: '#f4efe4', tie: 'none', ex: ['freckles', 'sweat'] },
    p1: { bg: ['#caa43a', '#6b5412'], skin: '#e8b894', hair: ['short', '#1b1512'], eyes: 'dot', jacket: '#23385e', shirt: '#f4f1ea', tie: 'tie', tieC: '#b3261e', ex: [] },
    p2: { bg: ['#caa43a', '#6b5412'], skin: '#c98f65', hair: ['bob', '#3a2418'], eyes: 'dot', jacket: '#1f6f73', shirt: '#f4f1ea', tie: 'none', ex: ['earrings'] },
    p3: { bg: ['#caa43a', '#6b5412'], skin: '#7a4a2e', hair: ['curly', '#15100d'], eyes: 'dot', jacket: '#6e1f2f', shirt: '#f4f1ea', tie: 'bow', tieC: '#caa43a', ex: ['stache'] },
    p4: { bg: ['#caa43a', '#6b5412'], skin: '#f1cfb2', hair: ['slick', '#d8b45a'], eyes: 'round', jacket: '#555b61', shirt: '#f4f1ea', tie: 'tie', tieC: '#1f5fb3', ex: ['beard'] },
    p5: { bg: ['#caa43a', '#6b5412'], skin: '#d9a581', hair: ['ponytail', '#1b1512'], eyes: 'dot', jacket: '#5b3c88', shirt: '#f4f1ea', tie: 'none', ex: ['lipstick'] },
    p6: { bg: ['#caa43a', '#6b5412'], skin: '#f3cfb0', hair: ['bun', '#7a3b22'], eyes: 'cat', jacket: '#2d6a3e', shirt: '#f4f1ea', tie: 'none', ex: ['freckles'] }
  };
  var AVATARS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  var MOUTH = {
    neutral: '<path d="M26 40.500Q32 42.500 38 40.500" stroke="#6d2f22" stroke-width="1.800" fill="none" stroke-linecap="round"/>',
    happy: '<path d="M24.500 38.500Q32 49 39.500 38.500Z" fill="#5a1d14" stroke="#5a1d14" stroke-width="1.200" stroke-linejoin="round"/><path d="M27 39.500Q32 42 37 39.500" stroke="#fff" stroke-width="1.800" fill="none"/>',
    sad: '<path d="M26 43Q32 37.500 38 43" stroke="#6d2f22" stroke-width="1.800" fill="none" stroke-linecap="round"/>',
    smug: '<path d="M26 41Q33 43 39 37.500" stroke="#6d2f22" stroke-width="1.800" fill="none" stroke-linecap="round"/>',
    worried: '<path d="M26 41.500Q29 38.500 32 41.500Q35 44.500 38 41.500" stroke="#6d2f22" stroke-width="1.700" fill="none" stroke-linecap="round"/>'
  };
  function hairBack(h) {
    var s = h[0], c = h[1];
    if (s === 'bob') return '<path d="M14 48C10 18 21 7 32 7s22 11 18 41z" fill="' + c + '"/>';
    if (s === 'ponytail') return '<path d="M44 20C54 22 56 34 50 44 46 40 46 30 44 26z" fill="' + c + '"/>';
    if (s === 'bun') return '';
    return '';
  }
  function hairFront(h, skin) {
    var s = h[0], c = h[1];
    switch (s) {
      case 'slick': case 'short': return '<path d="M19 29C17 13 26 8 32 8s15 5 13 21C42 21 38 18 32 18s-10 3-13 11z" fill="' + c + '"/>' + (s === 'short' ? '<path d="M19 29C18 23 20 21 22 20" stroke="' + c + '" stroke-width="3" fill="none"/>' : '');
      case 'curly': return [[21, 17, 6], [28, 12, 7], [36, 12, 7], [43, 17, 6], [18, 25, 4.500], [46, 25, 4.500], [32, 15, 6]].map(function (k) { return '<circle cx="' + k[0] + '" cy="' + k[1] + '" r="' + k[2] + '" fill="' + c + '"/>' }).join('');
      case 'bob': return '<path d="M19 30C20 15 44 15 45 30 41 23 23 23 19 30z" fill="' + c + '"/>';
      case 'bun': return '<circle cx="32" cy="7" r="6" fill="' + c + '"/><path d="M19 29C17 14 26 9 32 9s15 5 13 20C42 21 38 18 32 18s-10 3-13 11z" fill="' + c + '"/>';
      case 'ponytail': return '<path d="M19 29C17 13 26 8 32 8s15 5 13 21C42 21 38 18 32 18s-10 3-13 11z" fill="' + c + '"/><circle cx="45" cy="21" r="3.200" fill="#e0556f"/>';
      case 'messy': return '<path d="M18 28L16 14 23 19 24 8 30 16 36 6 40 16 47 10 46 28C42 21 38 18 32 18s-10 3-14 10z" fill="' + c + '"/>';
      case 'cap': return '<path d="M17 26C16 10 48 10 47 26z" fill="' + c + '"/><path d="M17 26H53C53 29 46 30 17 28z" fill="' + c + '"/><path d="M17 26H53" stroke="rgba(0,0,0,.25)" stroke-width="1"/><path d="M19 29C20 26 22 25 24 25" stroke="#b5532a" stroke-width="2.500" fill="none"/>';
      case 'fedora': return '<ellipse cx="32" cy="23" rx="21" ry="4.500" fill="' + c + '"/><path d="M20 23C20 8 44 8 44 23z" fill="' + c + '"/><path d="M20 21H44" stroke="#14171a" stroke-width="3"/><ellipse cx="32" cy="24" rx="15" ry="2.200" fill="rgba(0,0,0,.28)"/>';
      case 'bald': return '<ellipse cx="27" cy="18" rx="4" ry="2.200" fill="rgba(255,255,255,.25)"/>';
    }
    return '';
  }
  function eyesSvg(style, mood, brow) {
    var o = '', happy = mood === 'happy';
    if (happy) o += '<path d="M21.500 30Q25 25.500 28.500 30M35.500 30Q39 25.500 42.500 30" stroke="#2a1a10" stroke-width="2" fill="none" stroke-linecap="round"/>';
    else if (style !== 'shades') o += '<ellipse cx="25" cy="29.500" rx="2.200" ry="' + (mood === 'smug' ? 1.200 : 2.400) + '" fill="#2a1a10"/><ellipse cx="39" cy="29.500" rx="2.200" ry="' + (mood === 'smug' ? 1.200 : 2.400) + '" fill="#2a1a10"/><circle cx="25.700" cy="28.700" r=".7" fill="#fff"/><circle cx="39.700" cy="28.700" r=".7" fill="#fff"/>';
    // brows
    var by = 24.500, b = brow;
    if (mood === 'sad' || mood === 'worried') o += '<path d="M21 25.500L28.500 23.500M43 25.500L35.500 23.500" stroke="' + b + '" stroke-width="2" stroke-linecap="round"/>';
    else if (mood === 'smug') o += '<path d="M21 24.500Q25 22.500 28.500 24" stroke="' + b + '" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M35.500 22.500Q39 21 43 22.500" stroke="' + b + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
    else if (style !== 'shades') o += '<path d="M21 ' + (happy ? 23.500 : by) + 'Q25 ' + (happy ? 21 : 22.500) + ' 28.500 ' + (happy ? 23.500 : by) + 'M35.500 ' + (happy ? 23.500 : by) + 'Q39 ' + (happy ? 21 : 22.500) + ' 43 ' + (happy ? 23.500 : by) + '" stroke="' + b + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
    if (style === 'round') o += '<circle cx="25" cy="29.500" r="5.200" fill="rgba(255,255,255,.18)" stroke="#2a2a2a" stroke-width="1.500"/><circle cx="39" cy="29.500" r="5.200" fill="rgba(255,255,255,.18)" stroke="#2a2a2a" stroke-width="1.500"/><path d="M30.200 29.500H33.800" stroke="#2a2a2a" stroke-width="1.500"/>';
    if (style === 'cat') o += '<path d="M19.500 26.500L30 28.500 28 33.500 20 33.500z" fill="rgba(255,255,255,.18)" stroke="#6a2a5a" stroke-width="1.500" stroke-linejoin="round"/><path d="M44.500 26.500L34 28.500 36 33.500 44 33.500z" fill="rgba(255,255,255,.18)" stroke="#6a2a5a" stroke-width="1.500" stroke-linejoin="round"/><path d="M30 29.500H34" stroke="#6a2a5a" stroke-width="1.500"/>';
    if (style === 'shades') o += '<rect x="19.500" y="26" width="11.500" height="7.500" rx="3" fill="#0b0b0d"/><rect x="33" y="26" width="11.500" height="7.500" rx="3" fill="#0b0b0d"/><path d="M31 28.500H33" stroke="#0b0b0d" stroke-width="1.500"/><path d="M21.500 27.500L25 27.500" stroke="rgba(255,255,255,.5)" stroke-width="1"/><path d="M35 27.500L38.500 27.500" stroke="rgba(255,255,255,.5)" stroke-width="1"/>';
    return o;
  }
  var facesCache = {};
  function portrait(key, mood) {
    mood = mood || 'neutral';
    var ck = key + ':' + mood; if (facesCache[ck]) return facesCache[ck];
    var c = CHARS[key] || CHARS.p1, hairC = c.hair[1], brow = c.brow || hairC, ex = c.ex || [], o = '', gid = 'pg-' + key;
    o += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c.bg[0] + '"/><stop offset="1" stop-color="' + c.bg[1] + '"/></linearGradient></defs>';
    o += '<rect width="64" height="64" fill="url(#' + gid + ')"/>';
    o += hairBack(c.hair);
    // shoulders, shirt, tie
    o += '<path d="M4 66C4 53 17 48 32 48s28 5 28 18z" fill="' + c.jacket + '"/>';
    if (ex.indexOf('flowers') >= 0) o += [[14, 58], [22, 62], [44, 60], [52, 57], [30, 64], [36, 61]].map(function (k) { return '<circle cx="' + k[0] + '" cy="' + k[1] + '" r="2.200" fill="#ffd27a" opacity=".85"/>' }).join('');
    if (c.shirt !== c.jacket || c.tie !== 'none') o += '<path d="M25 48L32 60 39 48z" fill="' + c.shirt + '"/>';
    o += '<path d="M25 48L32 60 20 52z" fill="rgba(0,0,0,.18)"/><path d="M39 48L32 60 44 52z" fill="rgba(0,0,0,.18)"/>';
    if (c.tie === 'bow') o += '<path d="M32 52L25 48.500V55.500zM32 52L39 48.500V55.500z" fill="' + (c.tieC || '#b3261e') + '"/><circle cx="32" cy="52" r="1.800" fill="' + (c.tieC || '#b3261e') + '" stroke="rgba(0,0,0,.25)" stroke-width=".6"/>';
    if (c.tie === 'tie') o += '<path d="M30.500 49H33.500L35 62 32 64 29 62z" fill="' + (c.tieC || '#b3261e') + '"/>';
    if (ex.indexOf('pearls') >= 0) o += [[24, 50.500], [27, 53], [30, 54.500], [34, 54.500], [37, 53], [40, 50.500]].map(function (k) { return '<circle cx="' + k[0] + '" cy="' + k[1] + '" r="1.500" fill="#f8f4ea"/>' }).join('');
    if (c.tie === 'chain' || ex.indexOf('chain') >= 0) o += '<path d="M24 50Q32 62 40 50" stroke="#e8c46a" stroke-width="2" fill="none"/><circle cx="32" cy="57.500" r="2.200" fill="#e8c46a"/>';
    // neck, ears, head
    o += '<rect x="28" y="41" width="8" height="9" rx="2" fill="' + c.skin + '"/><path d="M28 46Q32 49 36 46v-3h-8z" fill="rgba(0,0,0,.16)"/>';
    o += '<ellipse cx="19" cy="32" rx="2.400" ry="3.600" fill="' + c.skin + '"/><ellipse cx="45" cy="32" rx="2.400" ry="3.600" fill="' + c.skin + '"/>';
    if (ex.indexOf('earrings') >= 0) o += '<circle cx="19" cy="36.500" r="1.500" fill="#e8c46a"/><circle cx="45" cy="36.500" r="1.500" fill="#e8c46a"/>';
    o += '<ellipse cx="32" cy="29" rx="13" ry="15.500" fill="' + c.skin + '"/>';
    // cheeks, freckles, nose
    if (ex.indexOf('blush') >= 0 || mood === 'happy') o += '<circle cx="22.500" cy="36" r="2.800" fill="#e8806f" opacity=".35"/><circle cx="41.500" cy="36" r="2.800" fill="#e8806f" opacity=".35"/>';
    if (ex.indexOf('freckles') >= 0) o += [[24, 35], [27, 36.500], [22, 37], [40, 35], [37, 36.500], [42, 37]].map(function (k) { return '<circle cx="' + k[0] + '" cy="' + k[1] + '" r=".8" fill="#b5703f"/>' }).join('');
    o += '<path d="M32 30.500Q30.500 35.500 32.800 36" stroke="rgba(110,50,30,.5)" stroke-width="1.400" fill="none" stroke-linecap="round"/>';
    // mouth, facial hair
    o += ex.indexOf('lipstick') >= 0 ? MOUTH[mood].replace(/stroke="#6d2f22"/g, 'stroke="#c0182f"').replace('fill="#5a1d14"', 'fill="#8a1020"') : MOUTH[mood] || MOUTH.neutral;
    if (ex.indexOf('stache') >= 0) o += '<path d="M24.500 37.500Q28 34 32 37Q36 34 39.500 37.500Q36 39.800 32 38Q28 39.800 24.500 37.500z" fill="' + hairC + '"/>';
    if (ex.indexOf('goatee') >= 0) o += '<path d="M28.500 43Q32 48 35.500 43Q32 44.500 28.500 43z" fill="' + hairC + '"/><ellipse cx="32" cy="45" rx="3.600" ry="2.800" fill="' + hairC + '"/>';
    if (ex.indexOf('beard') >= 0) o += '<path d="M19.500 33Q20 46 32 47Q44 46 44.500 33Q41 40 32 40Q23 40 19.500 33z" fill="' + hairC + '"/>';
    o += eyesSvg(c.eyes, mood, brow);
    o += hairFront(c.hair, c.skin);
    if (ex.indexOf('sweat') >= 0 && (mood === 'worried' || mood === 'sad' || mood === 'neutral')) o += '<path d="M47 22Q49.500 26.500 47 28.500Q44.500 26.500 47 22z" fill="#8fd0ff" stroke="#fff" stroke-width=".5"/>';
    var html = '<svg class="face" viewBox="0 0 64 64" aria-hidden="true">' + o + '</svg>';
    return (facesCache[ck] = html);
  }

  function init() {
    if (document.getElementById('bj-sprite')) return;
    var d = document.createElement('div'); d.id = 'bj-sprite'; d.innerHTML = defs(); document.body.insertBefore(d, document.body.firstChild);
  }

  root.BJArt = { portrait: portrait, avatars: AVATARS, chars: CHARS, setFourColour: function (on) { fourColour = !!on }, card: card, back: back, chip: chip, stack: stack, icon: icon, dealer: dealer, init: init, SYMBOL: SYMBOL, COLOR: COLOR };
})(typeof window !== 'undefined' ? window : globalThis);
