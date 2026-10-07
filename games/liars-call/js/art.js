/* Liar's Call: all art as SVG strings. Characters share one face rig so the
   game can switch expressions with data-ex and play tells with a .tell class. */
(function (root) {
  'use strict';
  var OL = '#3a2416';                     // outline colour
  var SW = 'stroke="' + OL + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  var uid = 0;

  /* ---------------- shading helpers ---------------- */
  // soft light from the top-left, darker towards the jaw
  function shade(cx, cy, rx, ry) {
    var id = 'fs' + (uid++);
    return '<defs><radialGradient id="' + id + '" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#5a2a10" stop-opacity=".12"/><stop offset="1" stop-color="#5a2a10" stop-opacity=".32"/></radialGradient></defs>' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (rx - 1.5) + '" ry="' + (ry - 1.5) + '" fill="url(#' + id + ')" pointer-events="none"/>';
  }
  // cloth: lit shoulders, darker towards the table
  function cloth(d) {
    var id = 'cl' + (uid++);
    return '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2=".25" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs>' +
      '<path d="' + d + '" fill="url(#' + id + ')" pointer-events="none"/>';
  }
  function hairShine(d) { return '<path d="' + d + '" stroke="#fff" stroke-opacity=".28" stroke-width="3" fill="none" stroke-linecap="round"/>' }

  /* ---------------- shared face parts ---------------- */
  function eyes(cx, cy, gap, r, opt) {
    opt = opt || {};
    var lx = cx - gap, rx = cx + gap, ry = r * (opt.tall || 1.1), out = '';
    out += '<g class="eyes" style="transform-origin:' + cx + 'px ' + cy + 'px">';
    [lx, rx].forEach(function (x) {
      out += '<ellipse cx="' + x + '" cy="' + cy + '" rx="' + r + '" ry="' + ry + '" fill="#fff" ' + SW + '/>';
    });
    out += '<g class="pupils">';
    [lx, rx].forEach(function (x) {
      out += '<circle cx="' + x + '" cy="' + (cy + 1) + '" r="' + (r * 0.62) + '" fill="' + (opt.iris || '#6b3d1f') + '"/>' +
             '<circle cx="' + x + '" cy="' + (cy + 1) + '" r="' + (r * 0.34) + '" fill="#1a0f08"/>' +
             '<circle cx="' + (x + r * 0.22) + '" cy="' + (cy - r * 0.18) + '" r="' + (r * 0.2) + '" fill="#fff"/>' +
             '<circle cx="' + (x - r * 0.2) + '" cy="' + (cy + r * 0.3) + '" r="' + (r * 0.09) + '" fill="#fff" opacity=".8"/>';
    });
    out += '</g>';
    // upper lids give the eyes weight
    [lx, rx].forEach(function (x) { out += '<path d="M' + (x - r * 1.05) + ' ' + (cy - ry * 0.25) + ' Q' + x + ' ' + (cy - ry * 1.35) + ' ' + (x + r * 1.05) + ' ' + (cy - ry * 0.25) + '" stroke="' + OL + '" stroke-width="3.2" fill="none" stroke-linecap="round"/>' });
    if (opt.lashes) [lx, rx].forEach(function (x, i) {
      var d = i ? 1 : -1;
      out += '<path d="M' + (x + d * r * 0.9) + ' ' + (cy - ry * 0.5) + ' l' + (d * 6) + ' -5 M' + (x + d * r * 0.5) + ' ' + (cy - ry * 0.95) + ' l' + (d * 4) + ' -6" ' + SW + ' fill="none"/>';
    });
    // X eyes, shown when out
    out += '<g class="xeyes">';
    [lx, rx].forEach(function (x) {
      out += '<path d="M' + (x - r * 0.7) + ' ' + (cy - r * 0.7) + ' L' + (x + r * 0.7) + ' ' + (cy + r * 0.7) + ' M' + (x + r * 0.7) + ' ' + (cy - r * 0.7) + ' L' + (x - r * 0.7) + ' ' + (cy + r * 0.7) + '" stroke="#2a1a10" stroke-width="4" stroke-linecap="round"/>';
    });
    out += '</g></g>';
    return out;
  }

  function brows(cx, cy, gap, w, thick, color) {
    var c = color || OL;
    function one(x, side, cls) {
      return '<path class="' + cls + '" style="transform-origin:' + x + 'px ' + cy + 'px" d="M' + (x - w / 2) + ' ' + (cy + 2) + ' Q' + x + ' ' + (cy - 5) + ' ' + (x + w / 2) + ' ' + (cy + 2) + '" stroke="' + c + '" stroke-width="' + thick + '" stroke-linecap="round" fill="none"/>';
    }
    return '<g class="brows">' + one(cx - gap, -1, 'brow bl') + one(cx + gap, 1, 'brow br') + '</g>';
  }

  // every mouth the rig can show; CSS picks one from data-ex
  function mouths(mx, my, w, lip) {
    lip = lip || '#8a2b20';
    var h = w / 2, o = '';
    o += '<g class="m m-neutral"><path d="M' + (mx - h * 0.7) + ' ' + my + ' Q' + mx + ' ' + (my + 5) + ' ' + (mx + h * 0.7) + ' ' + my + '" ' + SW + ' fill="none"/></g>';
    o += '<g class="m m-smile"><path d="M' + (mx - h) + ' ' + (my - 3) + ' Q' + mx + ' ' + (my + 14) + ' ' + (mx + h) + ' ' + (my - 3) + '" ' + SW + ' fill="none"/></g>';
    o += '<g class="m m-grin"><path d="M' + (mx - h) + ' ' + (my - 4) + ' Q' + mx + ' ' + (my + 24) + ' ' + (mx + h) + ' ' + (my - 4) + ' Z" fill="' + lip + '" ' + SW + '/>' +
         '<path d="M' + (mx - h * 0.8) + ' ' + (my - 2) + ' L' + (mx + h * 0.8) + ' ' + (my - 2) + ' L' + (mx + h * 0.7) + ' ' + (my + 3) + ' L' + (mx - h * 0.7) + ' ' + (my + 3) + ' Z" fill="#fff"/>' +
         '<ellipse cx="' + mx + '" cy="' + (my + 11) + '" rx="' + (h * 0.45) + '" ry="4" fill="#e0675a"/></g>';
    o += '<g class="m m-smirk"><path d="M' + (mx - h * 0.8) + ' ' + (my + 2) + ' Q' + (mx + h * 0.1) + ' ' + (my + 6) + ' ' + (mx + h) + ' ' + (my - 6) + '" ' + SW + ' fill="none"/></g>';
    o += '<g class="m m-o"><ellipse cx="' + mx + '" cy="' + (my + 4) + '" rx="' + (h * 0.5) + '" ry="' + (h * 0.65) + '" fill="#4a1410" ' + SW + '/><ellipse cx="' + mx + '" cy="' + (my + 4 + h * 0.35) + '" rx="' + (h * 0.3) + '" ry="' + (h * 0.18) + '" fill="#e0675a"/></g>';
    o += '<g class="m m-chew" style="transform-origin:' + mx + 'px ' + my + 'px"><ellipse cx="' + mx + '" cy="' + (my + 2) + '" rx="' + (h * 0.55) + '" ry="' + (h * 0.32) + '" fill="#4a1410" ' + SW + '/></g>';
    o += '<g class="m m-frown"><path d="M' + (mx - h * 0.8) + ' ' + (my + 6) + ' Q' + mx + ' ' + (my - 8) + ' ' + (mx + h * 0.8) + ' ' + (my + 6) + '" ' + SW + ' fill="none"/></g>';
    o += '<g class="m m-fire"><ellipse cx="' + mx + '" cy="' + (my + 6) + '" rx="' + (h * 0.8) + '" ry="' + (h * 0.9) + '" fill="#4a1410" ' + SW + '/>' + flames(mx, my + 8, w * 2.6) + '</g>';
    return '<g class="mouths">' + o + '</g>';
  }

  function flames(x, y, w) {
    var s = w / 60;
    return '<g class="flames" transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
      '<path class="fl1" d="M0 0 C-30 20 -38 50 -12 78 C-18 56 -2 52 0 40 C4 54 18 58 12 80 C40 52 30 20 0 0Z" fill="#ff5a1f"/>' +
      '<path class="fl2" d="M0 6 C-16 24 -20 44 -4 62 C-6 48 2 44 0 34 C6 46 12 50 6 64 C22 44 16 22 0 6Z" fill="#ffb21f"/>' +
      '<path class="fl3" d="M0 14 C-8 26 -8 38 0 48 C8 38 8 26 0 14Z" fill="#fff3a0"/></g>';
  }

  function fx(cx, cy, rx, ry, sx, sy) {
    // overlays: sweat drop, red face for fire, steam puffs at the ears, blush
    return '<ellipse class="redface" cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="#ff2a1a"/>' +
      '<path class="sweat" d="M' + sx + ' ' + sy + ' q-7 12 0 16 q7 -4 0 -16z" fill="#7fd0ff" stroke="#2f7fb0" stroke-width="2"/>' +
      '<g class="steam">' +
      '<circle class="st1" cx="' + (cx - rx - 6) + '" cy="' + (cy - 4) + '" r="9" fill="#fff"/>' +
      '<circle class="st2" cx="' + (cx + rx + 6) + '" cy="' + (cy - 4) + '" r="9" fill="#fff"/>' +
      '<circle class="st3" cx="' + (cx - rx - 14) + '" cy="' + (cy - 20) + '" r="7" fill="#fff"/>' +
      '<circle class="st4" cx="' + (cx + rx + 14) + '" cy="' + (cy - 20) + '" r="7" fill="#fff"/></g>';
  }

  function ears(cx, cy, rx, skin, shade) {
    return '<ellipse cx="' + (cx - rx + 2) + '" cy="' + cy + '" rx="9" ry="13" fill="' + skin + '" ' + SW + '/>' +
           '<ellipse cx="' + (cx + rx - 2) + '" cy="' + cy + '" rx="9" ry="13" fill="' + skin + '" ' + SW + '/>' +
           '<path d="M' + (cx - rx - 1) + ' ' + (cy - 4) + ' q4 4 0 8 M' + (cx + rx + 1) + ' ' + (cy - 4) + ' q-4 4 0 8" stroke="' + shade + '" stroke-width="2.5" fill="none"/>';
  }

  // a fan of card backs held in two mitten hands
  function cardFan(cx, cy, skin, cls) {
    var o = '<g class="' + (cls || 'fan') + '">';
    [-22, -8, 6, 20].forEach(function (a, i) {
      o += '<g transform="rotate(' + a + ' ' + cx + ' ' + (cy + 40) + ')"><rect x="' + (cx - 15) + '" y="' + (cy - 8) + '" width="30" height="44" rx="4" fill="#8c2433" ' + SW + '/>' +
           '<rect x="' + (cx - 10) + '" y="' + (cy - 3) + '" width="20" height="34" rx="2" fill="none" stroke="#f2c14e" stroke-width="2"/>' +
           '<circle cx="' + cx + '" cy="' + (cy + 14) + '" r="5" fill="#f2c14e"/></g>';
    });
    o += '<ellipse cx="' + (cx - 24) + '" cy="' + (cy + 36) + '" rx="14" ry="11" fill="' + skin + '" ' + SW + '/>' +
         '<ellipse cx="' + (cx + 24) + '" cy="' + (cy + 36) + '" rx="14" ry="11" fill="' + skin + '" ' + SW + '/>';
    return o + '</g>';
  }

  function wrap(key, inner, extraCls) {
    extraCls = extraCls || '';
    return '<svg class="ch ch-' + key + (extraCls ? ' ' + extraCls : '') + '" viewBox="0 0 220 260" xmlns="http://www.w3.org/2000/svg" data-ex="neutral">' + inner + '</svg>';
  }

  /* ---------------- the cast ---------------- */
  var CAST = {};

  CAST.sharma = function (fit) {
    var skin = '#e6a877', sh = '#c9865a', cx = 110, cy = 108;
    var o = '';
    // body: saffron kurta, wide
    o += '<path d="M8 262 C10 206 48 178 110 176 C172 178 210 206 212 262 Z" fill="' + (fit ? '#f4e4c1' : '#f2992e') + '" ' + SW + '/>';
    o += cloth('M8 262 C10 206 48 178 110 176 C172 178 210 206 212 262 Z');
    o += '<path d="M110 182 L110 250" stroke="#c46f12" stroke-width="3"/><circle cx="110" cy="200" r="3.5" fill="#fbe3a6" stroke="#c46f12" stroke-width="1.5"/><circle cx="110" cy="218" r="3.5" fill="#fbe3a6" stroke="#c46f12" stroke-width="1.5"/>';
    o += '<path d="M104 182 L104 246 M116 182 L116 246" stroke="#f5c542" stroke-width="2" stroke-dasharray="2 4"/>';   // embroidery
    o += '<path d="M60 222 c-6 -10 4 -20 12 -12 c6 6 -2 14 -8 10" stroke="#c46f12" stroke-width="2.5" fill="none"/><path d="M158 222 c6 -10 -4 -20 -12 -12 c-6 6 2 14 8 10" stroke="#c46f12" stroke-width="2.5" fill="none"/>';
    o += '<path d="M78 180 Q110 210 142 180" stroke="#f5c542" stroke-width="5" fill="none"/><path d="M80 182 Q110 208 140 182" stroke="#fff6c8" stroke-width="1.5" fill="none" stroke-dasharray="3 5"/>';           // gold chain
    if (fit) o += '<path d="M60 222 c-6 -10 4 -20 12 -12 c6 6 -2 14 -8 10 M158 222 c6 -10 -4 -20 -12 -12 c-6 6 2 14 8 10" stroke="#d4a017" stroke-width="3" fill="none"/><g fill="#d4a017" stroke="#9b6a00" stroke-width="1"><circle cx="110" cy="232" r="3.5"/><circle cx="110" cy="246" r="3.5"/></g>';
    o += '<rect x="88" y="150" width="44" height="34" rx="12" fill="' + skin + '" ' + SW + '/>';          // neck
    if (fit) o += '<path d="M86 178 Q110 190 134 178 L134 188 Q110 200 86 188Z" fill="#d4a017" ' + SW + '/>';  // sherwani collar
    o += ears(cx, cy + 4, 56, skin, sh);
    o += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="56" ry="54" fill="' + skin + '" ' + SW + '/>';
    o += shade(cx, cy, 56, 54);
    o += '<path d="M72 150 Q110 172 148 150" stroke="' + sh + '" stroke-width="3" fill="none"/>';          // double chin
    o += '<ellipse cx="94" cy="66" rx="16" ry="7" fill="#fff" opacity=".45"/>';                           // bald shine
    o += '<path d="M56 96 C52 74 60 64 66 62 C64 74 66 86 70 96 Z" fill="#6b5a52" ' + SW + '/>';          // side hair
    o += '<path d="M164 96 C168 74 160 64 154 62 C156 74 154 86 150 96 Z" fill="#6b5a52" ' + SW + '/>';
    if (fit) o += '<path d="M52 94 C46 54 76 30 110 30 C144 30 174 54 168 94 C152 76 132 70 110 70 C88 70 68 76 52 94Z" fill="#c62828" ' + SW + '/>' +
      '<path d="M58 80 C76 58 144 58 162 80 M62 66 C82 44 138 44 158 66 M74 46 C94 34 126 34 146 46" stroke="#f5c542" stroke-width="2.5" fill="none" opacity=".9"/>' +
      '<path d="M112 44 C106 24 120 10 128 2 C126 16 120 30 116 44Z" fill="#fffde7" ' + SW + '/><circle cx="112" cy="50" r="7" fill="#2fb36b" stroke="#f5c542" stroke-width="3"/>';  // safa + kalgi
    o += '<circle cx="110" cy="74" r="4" fill="#d6312b"/>';                                                // tika
    o += brows(cx, 86, 20, 26, 7, '#2a1a10');
    o += eyes(cx, 102, 20, 8);
    o += '<ellipse cx="80" cy="126" rx="10" ry="6" fill="#f08a7a" opacity=".55"/><ellipse cx="140" cy="126" rx="10" ry="6" fill="#f08a7a" opacity=".55"/>';
    o += '<path d="M104 104 Q100 120 106 124 Q112 126 116 122" fill="' + sh + '" ' + SW + '/>';           // nose
    o += mouths(cx, 142, 26);
    // handlebar moustache, tips twirl as the tell
    o += '<g class="stache"><path d="M110 128 C96 124 82 126 74 136 C86 134 98 138 110 134 C122 138 134 134 146 136 C138 126 124 124 110 128Z" fill="#1f1410" ' + SW + '/>' +
         '<g class="tipL" style="transform-origin:76px 134px"><path d="M76 134 C64 136 60 124 68 120 C66 128 72 130 76 130" fill="#1f1410" ' + SW + '/></g>' +
         '<g class="tipR" style="transform-origin:144px 134px"><path d="M144 134 C156 136 160 124 152 120 C154 128 148 130 144 130" fill="#1f1410" ' + SW + '/></g></g>';
    o += fx(cx, cy, 56, 54, 154, 70);
    o += cardFan(110, 214, skin);
    return wrap('sharma', o, fit ? 'fit' : '');
  };

  CAST.pinky = function (fit) {
    var skin = '#dc9c6c', sh = '#bb7a4c', cx = 110, cy = 110;
    var o = '';
    o += '<circle cx="110" cy="44" r="30" fill="#1f1714" ' + SW + '/>';                                  // bun
    o += '<circle cx="96" cy="30" r="6" fill="#fff" ' + SW + '/><circle cx="108" cy="24" r="6" fill="#fff" ' + SW + '/><circle cx="121" cy="27" r="6" fill="#fff" ' + SW + '/>'; // gajra
    o += '<path d="M20 262 C24 210 60 184 110 182 C160 184 196 210 200 262 Z" fill="' + (fit ? '#b71c1c' : '#e84a8a') + '" ' + SW + '/>'; // blouse/saree
    o += cloth('M20 262 C24 210 60 184 110 182 C160 184 196 210 200 262 Z');
    o += '<g class="pallu"><path d="M60 192 C96 206 150 240 176 262 L132 262 C110 240 80 214 52 200 Z" fill="' + (fit ? '#e53935' : '#ff7ab0') + '" ' + SW + '/>' +
         '<path d="M58 198 C92 212 140 244 160 262" stroke="#f5c542" stroke-width="6" fill="none"/>' +
         '<g fill="#ffd54a"><circle cx="84" cy="214" r="2.2"/><circle cx="104" cy="228" r="2.2"/><circle cx="124" cy="242" r="2.2"/><circle cx="96" cy="216" r="1.6"/><circle cx="116" cy="230" r="1.6"/><circle cx="136" cy="246" r="1.6"/></g></g>';
    o += '<rect x="92" y="152" width="36" height="34" rx="12" fill="' + skin + '" ' + SW + '/>';
    o += '<path d="M84 182 Q110 200 136 182" stroke="#f5c542" stroke-width="4" fill="none"/><circle cx="110" cy="196" r="5" fill="#2fb36b" stroke="#f5c542" stroke-width="2"/>'; // necklace
    o += ears(cx, cy + 6, 46, skin, sh);
    // jhumkas swing
    o += '<g class="jhL" style="transform-origin:64px 124px"><path d="M64 124 L64 132" stroke="#d9a520" stroke-width="3"/><path d="M56 134 Q64 124 72 134 Q64 146 56 134Z" fill="#f5c542" ' + SW + '/><circle cx="64" cy="147" r="3" fill="#f5c542"/></g>';
    o += '<g class="jhR" style="transform-origin:156px 124px"><path d="M156 124 L156 132" stroke="#d9a520" stroke-width="3"/><path d="M148 134 Q156 124 164 134 Q156 146 148 134Z" fill="#f5c542" ' + SW + '/><circle cx="156" cy="147" r="3" fill="#f5c542"/></g>';
    o += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="46" ry="52" fill="' + skin + '" ' + SW + '/>';
    o += shade(cx, cy, 46, 52);
    o += '<path d="M64 108 C60 64 84 52 110 52 C136 52 160 64 156 108 C150 84 132 70 110 70 C88 70 70 84 64 108Z" fill="#1f1714" ' + SW + '/>'; // hair
    o += '<path d="M110 54 L110 72" stroke="#d6312b" stroke-width="4"/>';                                 // sindoor
    if (fit) o += '<path d="M60 114 C52 58 80 38 110 38 C140 38 168 58 160 114" stroke="#e53935" stroke-width="9" fill="none" opacity=".92"/><path d="M60 114 C52 58 80 38 110 38 C140 38 168 58 160 114" stroke="#f5c542" stroke-width="2" stroke-dasharray="2 6" fill="none"/>' +
      '<path d="M110 52 L110 70" stroke="#f5c542" stroke-width="2"/><circle cx="110" cy="74" r="5.5" fill="#f5c542" stroke="#9b6a00" stroke-width="1.5"/><circle cx="110" cy="74" r="2.2" fill="#d81b60"/>';  // veil + maang tikka
    o += '<circle cx="110" cy="84" r="4.5" fill="#d6312b"/><circle cx="108.6" cy="82.6" r="1.4" fill="#fff" opacity=".8"/>';  // bindi
    o += hairShine('M76 92 C80 78 92 70 104 68');
    o += brows(cx, 90, 19, 20, 4, '#1f1714');
    o += eyes(cx, 104, 19, 8.5, { lashes: true });
    o += '<path d="M107 106 Q104 120 109 124 Q114 125 117 121" fill="' + sh + '" ' + SW + '/>';
    o += '<circle cx="119" cy="121" r="4" fill="none" stroke="#f5c542" stroke-width="2.5"/>';            // nath
    o += '<ellipse cx="84" cy="126" rx="9" ry="5" fill="#ff7a8a" opacity=".55"/><ellipse cx="136" cy="126" rx="9" ry="5" fill="#ff7a8a" opacity=".55"/>';
    o += mouths(cx, 138, 22, '#c2185b');
    o += '<path class="lip" d="M100 137 Q110 132 120 137 Q110 141 100 137Z" fill="#d81b60"/>';
    o += fx(cx, cy, 46, 52, 150, 76);
    o += cardFan(110, 216, skin);
    // the tell hand: comes up to fix the pallu
    o += '<g class="tellhand"><ellipse cx="62" cy="196" rx="15" ry="12" fill="' + skin + '" ' + SW + '/><path d="M50 204 Q62 212 74 204" stroke="#f5c542" stroke-width="3" fill="none"/><path d="M50 209 Q62 217 74 209" stroke="#e53935" stroke-width="3" fill="none"/></g>';
    return wrap('pinky', o, fit ? 'fit' : '');
  };

  CAST.bunty = function (fit) {
    var skin = '#d79a68', sh = '#b67a4a', cx = 110, cy = 116;
    var o = '';
    o += '<path d="M44 262 C46 220 72 198 110 196 C148 198 174 220 176 262 Z" fill="' + (fit ? '#ffd54a' : '#e53935') + '" ' + SW + '/>'; // t-shirt
    o += cloth('M44 262 C46 220 72 198 110 196 C148 198 174 220 176 262 Z');
    if (fit) o += '<path d="M62 262 C64 226 82 206 100 200 L110 236 L120 200 C138 206 156 226 158 262 Z" fill="#7b1fa2" ' + SW + '/><g fill="#f5c542"><circle cx="104" cy="246" r="3"/><circle cx="104" cy="258" r="3"/></g><path d="M126 222 l12 0" stroke="#f5c542" stroke-width="3"/>';
    else o += '<path d="M110 214 l6 13 14 1 -11 9 4 14 -13 -8 -13 8 4 -14 -11 -9 14 -1z" fill="#ffd54a" stroke="#c49000" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M52 236 L66 222 M58 244 L72 230 M168 236 L154 222 M162 244 L148 230" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"/>';
    o += '<rect x="96" y="168" width="28" height="32" rx="10" fill="' + skin + '" ' + SW + '/>';
    o += ears(cx, cy + 6, 50, skin, sh);
    o += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="52" ry="54" fill="' + skin + '" ' + SW + '/>';
    o += shade(cx, cy, 52, 54);
    // spiky hair
    o += '<path d="M58 106 C54 80 62 62 76 58 L72 44 L88 54 L92 36 L104 52 L114 32 L120 52 L134 38 L136 56 L150 48 L146 64 C160 72 166 88 162 106 C152 86 136 76 110 76 C86 76 68 86 58 106Z" fill="#1f1714" ' + SW + '/>';
    o += brows(cx, 92, 21, 18, 4.5, '#1f1714');
    o += eyes(cx, 110, 21, 11, { tall: 1.15 });
    o += '<path d="M107 114 Q105 124 110 127 Q115 127 117 124" fill="' + sh + '" ' + SW + '/>';
    o += '<ellipse cx="80" cy="132" rx="10" ry="6" fill="#ff7a6a" opacity=".5"/><ellipse cx="140" cy="132" rx="10" ry="6" fill="#ff7a6a" opacity=".5"/>';
    o += '<g transform="rotate(-20 142 124)"><rect x="132" y="119" width="20" height="9" rx="4" fill="#f6c89a" stroke="#c48a5a" stroke-width="1.5"/><circle cx="139" cy="123.5" r=".9" fill="#c48a5a"/><circle cx="145" cy="123.5" r=".9" fill="#c48a5a"/></g>';
    o += hairShine('M80 70 L88 60 M98 58 L104 46 M118 56 L122 42');
    o += mouths(cx, 144, 26);
    o += '<rect class="tooth" x="104" y="141" width="6" height="7" fill="#fff" stroke="' + OL + '" stroke-width="1.5"/>';
    o += fx(cx, cy, 52, 54, 154, 80);
    // lollipop in his left hand
    o += '<g class="lolly"><path d="M178 170 L170 232" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M178 170 L170 232" stroke="' + OL + '" stroke-width="1.5" fill="none" opacity=".4"/>' +
         '<circle cx="180" cy="158" r="20" fill="#ff5fa2" ' + SW + '/><path d="M180 158 m-12 0 a12 12 0 1 1 24 0 a8 8 0 1 1 -16 0 a4 4 0 1 1 8 0" stroke="#fff" stroke-width="4" fill="none"/>' +
         '<ellipse cx="170" cy="236" rx="11" ry="9" fill="' + skin + '" ' + SW + '/></g>';
    o += cardFan(104, 222, skin, 'fan hidefan');
    return wrap('bunty', o, fit ? 'fit' : '');
  };

  CAST.gupta = function (fit) {
    var skin = '#c98b5c', sh = '#a46c40', cx = 110, cy = 108;
    var o = '';
    o += '<path d="M40 262 C42 214 70 192 110 190 C150 192 178 214 180 262 Z" fill="' + (fit ? '#1f3a68' : '#9fd3f0') + '" ' + SW + '/>';
    o += cloth('M40 262 C42 214 70 192 110 190 C150 192 178 214 180 262 Z');
    if (fit) o += '<path d="M110 196 L110 262" stroke="#0f2140" stroke-width="2.5"/><g fill="#f5c542" stroke="#9b6a00" stroke-width="1"><circle cx="110" cy="208" r="3.2"/><circle cx="110" cy="222" r="3.2"/><circle cx="110" cy="236" r="3.2"/><circle cx="110" cy="250" r="3.2"/></g>' +
      '<path d="M94 188 L126 188 L124 198 L96 198Z" fill="#1f3a68" stroke="#f5c542" stroke-width="2"/><path d="M140 226 l16 0 l-4 -9 l-4 6 l-4 -7 z" fill="#ff7043" stroke="' + OL + '" stroke-width="1.5"/>';
    else {
      // checks
      o += '<g stroke="#5ba9d6" stroke-width="2" opacity=".8"><path d="M70 205 L70 262 M90 196 L90 262 M130 196 L130 262 M150 205 L150 262 M46 222 L174 222 M42 242 L178 242"/></g>';
      o += '<path d="M110 200 L102 210 L106 252 L110 258 L114 252 L118 210 Z" fill="#7b2cbf" ' + SW + '/><path d="M104 222 L116 214 M105 236 L117 228" stroke="#c39bff" stroke-width="3"/>';  // tie
      o += '<path d="M96 192 L110 214 L124 192" fill="#fff" ' + SW + '/>';                                  // collar
      o += '<rect x="138" y="226" width="20" height="18" fill="#7bbfe6" stroke="' + OL + '" stroke-width="2"/><path d="M144 216 L144 232" stroke="#1565c0" stroke-width="4" stroke-linecap="round"/>'; // pen
    }
    o += '<rect x="96" y="158" width="28" height="36" rx="10" fill="' + skin + '" ' + SW + '/>';
    o += ears(cx, cy + 6, 42, skin, sh);
    o += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="42" ry="60" fill="' + skin + '" ' + SW + '/>';
    o += shade(cx, cy, 42, 60);
    o += '<path d="M70 92 C68 62 90 48 116 50 C140 52 152 66 150 90 C138 70 112 64 84 74 C78 78 74 84 70 92Z" fill="#2a1f1a" ' + SW + '/>'; // comb-over
    o += '<path d="M88 64 Q112 56 140 70" stroke="#4a3a32" stroke-width="2" fill="none"/>' + hairShine('M96 62 Q114 56 132 62');
    o += '<circle cx="132" cy="140" r="2.2" fill="#5a3a22"/>';
    o += brows(cx, 88, 18, 18, 3.5, '#2a1f1a');
    o += eyes(cx, 104, 18, 7);
    // glasses: the tell pushes them up
    o += '<g class="specs"><circle cx="92" cy="104" r="15" fill="#dff3ff" fill-opacity=".35" stroke="#2a1a10" stroke-width="4"/><circle cx="128" cy="104" r="15" fill="#dff3ff" fill-opacity=".35" stroke="#2a1a10" stroke-width="4"/>' +
         '<path d="M107 102 Q110 98 113 102" stroke="#2a1a10" stroke-width="3" fill="none"/><path d="M77 102 L68 100 M143 102 L152 100" stroke="#2a1a10" stroke-width="3"/>' +
         '<path class="glint" d="M84 96 L92 92 M120 96 L128 92" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>';
    o += '<path d="M107 108 Q104 126 110 130 Q115 131 118 127" fill="' + sh + '" ' + SW + '/>';
    o += '<path d="M96 138 Q110 134 124 138" stroke="#2a1f1a" stroke-width="4" fill="none" stroke-linecap="round"/>'; // pencil moustache
    o += mouths(cx, 148, 20);
    o += fx(cx, cy, 42, 60, 146, 70);
    o += cardFan(110, 220, skin);
    return wrap('gupta', o, fit ? 'fit' : '');
  };

  CAST.dadi = function (fit) {
    var skin = '#c88a60', sh = '#a26a42', cx = 110, cy = 116;
    var o = '';
    // pallu over head, cream with maroon border
    o += '<path d="M48 262 C40 200 46 120 62 88 C76 54 144 54 158 88 C174 120 180 200 172 262 Z" fill="' + (fit ? '#6a1b9a' : '#f3ead8') + '" ' + SW + '/>';
    o += cloth('M48 262 C40 200 46 120 62 88 C76 54 144 54 158 88 C174 120 180 200 172 262 Z');
    o += '<path d="M56 262 C50 200 54 128 68 96 C82 66 138 66 152 96 C166 128 170 200 164 262" stroke="' + (fit ? '#f5c542' : '#8c1d2c') + '" stroke-width="7" fill="none"/>';
    o += '<path d="M56 262 C50 200 54 128 68 96 C82 66 138 66 152 96 C166 128 170 200 164 262" stroke="' + (fit ? '#c62828' : '#f5c542') + '" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round" fill="none"/>';
    o += '<path d="M70 262 C76 228 92 210 110 208 C128 210 144 228 150 262 Z" fill="' + (fit ? '#8e24aa' : '#efe2c8') + '" ' + SW + '/>'; // front
    if (fit) o += '<path d="M84 222 Q110 236 136 222" stroke="#f5c542" stroke-width="3" fill="none"/><circle cx="110" cy="232" r="4" fill="#2fb36b" stroke="#f5c542" stroke-width="2"/>';
    o += '<rect x="98" y="164" width="24" height="30" rx="9" fill="' + skin + '" ' + SW + '/>';
    o += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="42" ry="48" fill="' + skin + '" ' + SW + '/>';
    o += shade(cx, cy, 42, 48);
    o += '<path d="M70 108 C70 82 88 70 110 70 C132 70 150 82 150 108 C142 90 128 84 110 84 C92 84 78 90 70 108Z" fill="#e8e4df" ' + SW + '/>'; // white hair
    o += '<path d="M110 72 L110 86" stroke="#bdb6ae" stroke-width="2.5"/>';
    o += '<path d="M92 94 Q100 91 108 94 M112 94 Q120 91 128 94" stroke="' + sh + '" stroke-width="2" fill="none"/>'; // forehead lines
    o += brows(cx, 100, 17, 15, 3.5, '#d9d4cc');
    o += eyes(cx, 112, 17, 6.5);
    o += '<path d="M84 122 q4 4 8 2 M128 124 q4 2 8 -2 M88 140 q-3 6 0 10 M132 140 q3 6 0 10" stroke="' + sh + '" stroke-width="2" fill="none"/>'; // wrinkles
    o += '<path d="M107 114 Q104 128 110 131 Q115 132 118 128" fill="' + sh + '" ' + SW + '/>';
    o += '<circle cx="110" cy="96" r="3" fill="#d6312b"/>';
    o += '<circle cx="70" cy="128" r="3.5" fill="#f5c542" stroke="#9b6a00" stroke-width="1"/><circle cx="150" cy="128" r="3.5" fill="#f5c542" stroke="#9b6a00" stroke-width="1"/>';
    o += mouths(cx, 144, 20, '#b0201c');
    o += '<g class="paan"><ellipse cx="' + cx + '" cy="146" rx="9" ry="5" fill="#c2261f" opacity=".85"/></g>';
    o += fx(cx, cy, 42, 48, 144, 84);
    // walking stick
    o += '<g class="stick"><path d="M186 262 L186 150 C186 132 206 132 206 148" stroke="#7a4a22" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M186 262 L186 150 C186 132 206 132 206 148" stroke="' + OL + '" stroke-width="2" fill="none" opacity=".5"/></g>';
    o += cardFan(110, 222, skin);
    return wrap('dadi', o, fit ? 'fit' : '');
  };

  CAST.rocky = function (fit) {
    var skin = '#c68457', sh = '#a1653c', cx = 110, cy = 104;
    var o = '';
    // arms + biceps (flex as tell)
    o += '<g class="armL" style="transform-origin:40px 230px"><path d="M2 262 C0 222 14 196 40 190 C56 188 60 214 52 262Z" fill="' + skin + '" ' + SW + '/><path class="bicep" d="M14 222 Q30 200 46 216" stroke="' + sh + '" stroke-width="3" fill="none"/><path d="M22 240 c-4 -6 4 -10 6 -4 c2 -6 10 -2 6 4 l-6 6z" fill="#c62828" opacity=".8"/></g>';
    o += '<g class="armR" style="transform-origin:180px 230px"><path d="M218 262 C220 222 206 196 180 190 C164 188 160 214 168 262Z" fill="' + skin + '" ' + SW + '/><path class="bicep" d="M206 222 Q190 200 174 216" stroke="' + sh + '" stroke-width="3" fill="none"/></g>';
    o += '<path d="M30 262 C30 204 62 178 110 176 C158 178 190 204 190 262 Z" fill="' + (fit ? '#141414' : '#232323') + '" ' + SW + '/>';  // tight tee
    o += cloth('M30 262 C30 204 62 178 110 176 C158 178 190 204 190 262 Z');
    o += '<path d="M66 214 Q88 226 110 216 Q132 226 154 214" stroke="#444" stroke-width="3" fill="none"/>';  // pecs
    if (fit) o += '<path d="M30 262 C30 204 62 178 110 176 C158 178 190 204 190 262" stroke="#d4a017" stroke-width="4" fill="none" stroke-dasharray="6 4"/><path d="M110 184 L110 262" stroke="#d4a017" stroke-width="3"/>';
    else o += '<g transform="translate(110 238)"><path d="M-22 0 L-14 -8 L-14 8 Z M22 0 L14 -8 L14 8 Z" fill="#f5c542"/><rect x="-14" y="-3" width="28" height="6" rx="2" fill="#f5c542"/></g>';  // dumbbell print
    o += '<rect x="86" y="142" width="48" height="40" rx="14" fill="' + skin + '" ' + SW + '/>';
    o += '<path d="M80 178 Q110 206 140 178" stroke="#f5c542" stroke-width="7" fill="none"/>';
    if (fit) { var m = ''; for (var t = 0; t <= 1.0001; t += 1 / 14) { var mx = 66 + 88 * t, my = 178 + Math.sin(t * Math.PI) * 70; m += '<circle cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="7" fill="' + (Math.round(t * 14) % 2 ? '#ffb300' : '#ff6f00') + '" stroke="#b45309" stroke-width="1"/>' } o += '<g class="mala">' + m + '</g>' }
    o += ears(cx, cy + 6, 46, skin, sh);
    o += '<circle cx="64" cy="122" r="3.5" fill="#f5f5f5" stroke="' + OL + '" stroke-width="1.5"/>';      // stud
    o += '<path d="M64 104 C62 60 80 50 110 50 C140 50 158 60 156 104 C156 140 140 160 110 162 C80 160 64 140 64 104Z" fill="' + skin + '" ' + SW + '/>'; // square face
    o += shade(110, 106, 46, 56);
    o += '<path d="M70 128 C74 150 92 160 110 160 C128 160 146 150 150 128 C140 142 126 148 110 148 C94 148 80 142 70 128Z" fill="#5a4334" opacity=".35"/>'; // stubble
    o += '<path d="M64 90 C60 52 84 30 112 28 C126 22 150 26 146 40 C160 48 162 70 156 90 C150 70 134 62 110 62 C88 62 70 72 64 90Z" fill="#2a1a12" ' + SW + '/>'; // quiff
    o += hairShine('M84 40 C96 30 116 26 134 30');
    o += '<g class="shades"><rect x="76" y="40" width="30" height="14" rx="6" fill="#16343d" stroke="#f5c542" stroke-width="2.5"/><rect x="114" y="40" width="30" height="14" rx="6" fill="#16343d" stroke="#f5c542" stroke-width="2.5"/><path d="M106 46 L114 46" stroke="#f5c542" stroke-width="3"/><path d="M80 44 L92 44 M118 44 L130 44" stroke="#8fd3e8" stroke-width="2.5" stroke-linecap="round"/></g>';
    o += brows(cx, 84, 19, 22, 6, '#2a1a12');
    o += eyes(cx, 100, 19, 7.5);
    o += '<path d="M106 102 Q102 120 108 124 Q114 126 118 121" fill="' + sh + '" ' + SW + '/>';
    o += mouths(cx, 138, 24);
    o += fx(cx, cy + 4, 46, 56, 150, 66);
    o += cardFan(110, 222, skin);
    return wrap('rocky', o, fit ? 'fit' : '');
  };

  var INFO = {
    sharma: { name: 'Sharma Uncle', persona: 'careful', color: '#f2992e', tell: 'twirls his moustache', fit: 'Safa & sherwani' },
    pinky:  { name: 'Pinky Aunty', persona: 'sneaky', color: '#e84a8a', tell: 'fixes her pallu', fit: 'Bridal red & maang tikka' },
    bunty:  { name: 'Bunty', persona: 'reckless', color: '#e53935', tell: 'hides behind his cards', fit: 'Kurta & Nehru jacket' },
    gupta:  { name: 'Gupta Ji', persona: 'careful', color: '#5ba9d6', tell: 'pushes up his glasses', fit: 'Navy bandhgala' },
    dadi:   { name: 'Dadi', persona: 'sneaky', color: '#8c1d2c', tell: 'chews her paan faster', fit: 'Royal purple silk' },
    rocky:  { name: 'Rocky Bhaiya', persona: 'reckless', color: '#444', tell: 'flexes', fit: 'Dulha sherwani & mala' }
  };
  var ORDER = ['sharma', 'pinky', 'bunty', 'gupta', 'dadi', 'rocky'];

  /* ---------------- cards ---------------- */
  var RANK = {
    K: { label: 'RAJA', hi: 'राजा', col: '#9b1c2e' },
    Q: { label: 'RANI', hi: 'रानी', col: '#c2185b' },
    A: { label: 'IKKA', hi: 'इक्का', col: '#1d5fa8' },
    J: { label: 'JOKER', hi: 'जोकर', col: '#2e7d32' }
  };
  function emblem(r) {
    if (r === 'K') return '<g transform="translate(50 74)"><path d="M-26 10 L-30 -18 L-14 -4 L0 -24 L14 -4 L30 -18 L26 10 Z" fill="#f5c542" stroke="#9b6a00" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<rect x="-27" y="8" width="54" height="10" rx="3" fill="#e0a92a" stroke="#9b6a00" stroke-width="2.5"/><circle cx="0" cy="-24" r="4" fill="#d6312b"/><circle cx="-30" cy="-18" r="3.5" fill="#2fb36b"/><circle cx="30" cy="-18" r="3.5" fill="#2fb36b"/><circle cx="0" cy="13" r="3" fill="#d6312b"/></g>';
    if (r === 'Q') return '<g transform="translate(50 76)">' +
      '<path d="M0 -26 C10 -14 10 0 0 10 C-10 0 -10 -14 0 -26Z" fill="#f48fb1" stroke="#ad1457" stroke-width="2"/>' +
      '<path d="M-4 8 C-24 4 -30 -10 -26 -18 C-14 -14 -6 -4 -4 8Z" fill="#f8bbd0" stroke="#ad1457" stroke-width="2"/>' +
      '<path d="M4 8 C24 4 30 -10 26 -18 C14 -14 6 -4 4 8Z" fill="#f8bbd0" stroke="#ad1457" stroke-width="2"/>' +
      '<path d="M-30 14 Q0 26 30 14" stroke="#2e7d32" stroke-width="3" fill="none"/></g>';
    if (r === 'A') return '<g transform="translate(50 74)">' +
      '<path d="M0 30 C-2 10 -2 -6 0 -30" stroke="#5d4037" stroke-width="2" fill="none"/>' +
      '<ellipse cx="0" cy="-6" rx="17" ry="26" fill="#26a69a" stroke="#00695c" stroke-width="2"/>' +
      '<ellipse cx="0" cy="-8" rx="10" ry="15" fill="#1e88e5"/><ellipse cx="0" cy="-10" rx="5.5" ry="8" fill="#0d1b4a"/><ellipse cx="-1.5" cy="-13" rx="1.6" ry="2.4" fill="#fff"/>' +
      '<path d="M-17 -6 l-8 -4 M-17 4 l-8 2 M17 -6 l8 -4 M17 4 l8 2" stroke="#26a69a" stroke-width="2"/></g>';
    return '<g transform="translate(50 76)">' +
      '<path d="M-24 -6 C-26 -26 -8 -30 0 -14 C8 -30 26 -26 24 -6 Z" fill="#8e24aa" stroke="#4a148c" stroke-width="2"/>' +
      '<path d="M0 -14 L0 -6" stroke="#4a148c" stroke-width="2"/><circle cx="-24" cy="-8" r="4" fill="#f5c542"/><circle cx="24" cy="-8" r="4" fill="#f5c542"/>' +
      '<circle cx="0" cy="10" r="18" fill="#ffcc80" stroke="#8d5524" stroke-width="2"/>' +
      '<circle cx="-6" cy="6" r="2.5" fill="#2a1a10"/><circle cx="6" cy="6" r="2.5" fill="#2a1a10"/>' +
      '<path d="M-10 14 Q0 24 10 14" stroke="#8d5524" stroke-width="2.5" fill="#e53935"/><circle cx="0" cy="11" r="3" fill="#e53935"/></g>';
  }
  function cardFace(r) {
    var R = RANK[r], idx = r === 'J' ? '★' : r;
    return '<svg viewBox="0 0 100 140" class="cardsvg" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="2" y="2" width="96" height="136" rx="9" fill="#fff9ee" stroke="#c9a24a" stroke-width="3"/>' +
      '<rect x="8" y="8" width="84" height="124" rx="6" fill="none" stroke="' + R.col + '" stroke-width="1.5" stroke-dasharray="3 3" opacity=".6"/>' +
      '<text x="14" y="28" font-family="\'Baloo 2\',system-ui" font-weight="800" font-size="22" fill="' + R.col + '">' + idx + '</text>' +
      '<text x="0" y="0" font-family="\'Baloo 2\',system-ui" font-weight="800" font-size="22" fill="' + R.col + '" transform="translate(86 112) rotate(180)">' + idx + '</text>' +
      emblem(r) +
      '<text x="50" y="114" text-anchor="middle" font-family="\'Baloo 2\',system-ui" font-weight="800" font-size="15" fill="' + R.col + '" letter-spacing="1">' + R.label + '</text>' +
      '<text x="50" y="128" text-anchor="middle" font-family="\'Baloo 2\',system-ui" font-weight="600" font-size="11" fill="' + R.col + '" opacity=".75">' + R.hi + '</text></svg>';
  }
  function cardBack() {
    var petals = '';
    for (var i = 0; i < 12; i++) petals += '<ellipse cx="50" cy="52" rx="5" ry="14" fill="none" stroke="#f2c14e" stroke-width="1.6" transform="rotate(' + (i * 30) + ' 50 70)"/>';
    return '<svg viewBox="0 0 100 140" class="cardsvg" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="2" y="2" width="96" height="136" rx="9" fill="#7c1d2b" stroke="#f2c14e" stroke-width="3"/>' +
      '<rect x="9" y="9" width="82" height="122" rx="6" fill="#9b2a3a" stroke="#f2c14e" stroke-width="1.5"/>' +
      '<g opacity=".9">' + petals + '</g><circle cx="50" cy="70" r="15" fill="#7c1d2b" stroke="#f2c14e" stroke-width="2"/>' +
      '<text x="50" y="76" text-anchor="middle" font-family="\'Baloo 2\',system-ui" font-weight="800" font-size="15" fill="#f2c14e">LC</text>' +
      '<circle cx="18" cy="20" r="3" fill="#f2c14e"/><circle cx="82" cy="20" r="3" fill="#f2c14e"/><circle cx="18" cy="120" r="3" fill="#f2c14e"/><circle cx="82" cy="120" r="3" fill="#f2c14e"/></svg>';
  }

  /* ---------------- golgappa and plate ---------------- */
  // a puffed, crisp puri with a poked top showing aloo, chana and green pani
  function golgappa(size) {
    var u = uid++, g = 'ggs' + u, ao = 'ggo' + u, sh = 'ggh' + u, pn = 'ggp' + u;
    var sz = size || 40;
    return '<svg viewBox="0 0 60 60" width="' + sz + '" height="' + sz + '" xmlns="http://www.w3.org/2000/svg" class="ggsvg"><defs>' +
      '<radialGradient id="' + g + '" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="#fff2c6"/><stop offset=".25" stop-color="#f7cf74"/><stop offset=".62" stop-color="#e3a03c"/><stop offset=".88" stop-color="#b8701f"/><stop offset="1" stop-color="#8a4f14"/></radialGradient>' +
      '<radialGradient id="' + ao + '" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + sh + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4210" stop-opacity="0"/><stop offset=".6" stop-color="#7a4210" stop-opacity="0"/><stop offset="1" stop-color="#5a2e08" stop-opacity=".55"/></linearGradient>' +
      '<radialGradient id="' + pn + '" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#a5e36d"/><stop offset="1" stop-color="#3f8f2a"/></radialGradient></defs>' +
      '<ellipse cx="30" cy="52" rx="22" ry="5.5" fill="url(#' + ao + ')"/>' +                                   // contact shadow
      '<path d="M7 33 C6 18 17 9 30 9 C43 9 54 18 53 33 C52 45 42 52 30 52 C18 52 8 45 7 33Z" fill="url(#' + g + ')" stroke="#86501a" stroke-width="1.3"/>' +
      '<path d="M7 33 C6 18 17 9 30 9 C43 9 54 18 53 33 C52 45 42 52 30 52 C18 52 8 45 7 33Z" fill="url(#' + sh + ')"/>' +
      // blisters on the crisp shell
      '<g fill="#ffe7a3" opacity=".55"><ellipse cx="17" cy="30" rx="3" ry="2"/><ellipse cx="24" cy="41" rx="2.4" ry="1.6"/><ellipse cx="40" cy="38" rx="3.2" ry="2"/><ellipse cx="45" cy="27" rx="2" ry="1.4"/><ellipse cx="33" cy="45" rx="2" ry="1.3"/></g>' +
      '<g fill="none" stroke="#b8701f" stroke-width=".9" opacity=".7"><path d="M14 36 q3 2 6 0"/><path d="M35 42 q3 2 6 0"/><path d="M42 31 q2 1.5 4 0"/></g>' +
      // the poked hole with filling
      '<path d="M21 19 L24 15.5 L27 17.5 L30 14.5 L33 17 L37 15 L40 18.5 L39 22.5 C35 25 26 25 22 22.8 Z" fill="#4a250a" stroke="#86501a" stroke-width="1"/>' +
      '<ellipse cx="30.5" cy="21" rx="7.2" ry="2.6" fill="url(#' + pn + ')"/>' +
      '<circle cx="26.5" cy="19.6" r="1.8" fill="#e9c46a" stroke="#a5781e" stroke-width=".6"/><circle cx="33.5" cy="19.2" r="1.6" fill="#d9a441" stroke="#a5781e" stroke-width=".6"/><rect x="29" y="17.6" width="3" height="2.4" rx=".8" fill="#f3d27a"/>' +
      '<ellipse cx="32.5" cy="20.4" rx="2" ry=".7" fill="#fff" opacity=".6"/>' +
      // specular highlight
      '<ellipse cx="18" cy="21" rx="5" ry="3" fill="#fff" opacity=".55" transform="rotate(-30 18 21)"/><circle cx="14.5" cy="26" r="1.2" fill="#fff" opacity=".6"/></svg>';
  }
  // steel thali with rings and reflections
  function plateSVG() {
    var u = uid++, id = 'pl' + u, rim = 'plr' + u;
    return '<svg viewBox="0 0 120 80" class="platesvg" xmlns="http://www.w3.org/2000/svg"><defs>' +
      '<radialGradient id="' + id + '" cx="42%" cy="36%" r="72%"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#d9dfe3"/><stop offset=".8" stop-color="#a9b3ba"/><stop offset="1" stop-color="#7f8a92"/></radialGradient>' +
      '<linearGradient id="' + rim + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7f9"/><stop offset=".5" stop-color="#8d989f"/><stop offset="1" stop-color="#dfe5e9"/></linearGradient></defs>' +
      '<ellipse cx="60" cy="45" rx="58" ry="33" fill="#000" opacity=".28"/>' +
      '<ellipse cx="60" cy="41" rx="57" ry="34" fill="#6f7a82"/>' +
      '<ellipse cx="60" cy="38" rx="57" ry="34" fill="url(#' + rim + ')" stroke="#5f6a72" stroke-width="1.5"/>' +
      '<ellipse cx="60" cy="39" rx="47" ry="26.5" fill="url(#' + id + ')" stroke="#8d989f" stroke-width="1"/>' +
      '<ellipse cx="60" cy="40" rx="34" ry="18.5" fill="none" stroke="#fff" stroke-width="1" opacity=".55"/>' +
      '<ellipse cx="60" cy="40" rx="20" ry="10.5" fill="none" stroke="#9aa5ad" stroke-width=".8" opacity=".6"/>' +
      '<path d="M22 28 Q40 12 70 10" stroke="#fff" stroke-width="3" fill="none" opacity=".75" stroke-linecap="round"/></svg>';
  }
  // small steel katori of green pani with mint and a floating boondi
  function katori() {
    var u = uid++, st = 'kt' + u, pn = 'kp' + u;
    return '<svg viewBox="0 0 64 44" class="katorisvg" xmlns="http://www.w3.org/2000/svg"><defs>' +
      '<linearGradient id="' + st + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7e8991"/><stop offset=".3" stop-color="#f4f7f9"/><stop offset=".6" stop-color="#b9c2c8"/><stop offset="1" stop-color="#6f7a82"/></linearGradient>' +
      '<radialGradient id="' + pn + '" cx="40%" cy="40%" r="65%"><stop offset="0" stop-color="#b3ea7a"/><stop offset=".6" stop-color="#5fb33a"/><stop offset="1" stop-color="#2f7a1e"/></radialGradient></defs>' +
      '<ellipse cx="32" cy="40" rx="24" ry="4" fill="#000" opacity=".3"/>' +
      '<path d="M5 14 C6 30 16 39 32 39 C48 39 58 30 59 14 Z" fill="url(#' + st + ')" stroke="#5f6a72" stroke-width="1.3"/>' +
      '<ellipse cx="32" cy="14" rx="27" ry="8" fill="#c9d1d6" stroke="#5f6a72" stroke-width="1.3"/>' +
      '<ellipse cx="32" cy="14.6" rx="23.5" ry="6.2" fill="url(#' + pn + ')"/>' +
      '<path d="M22 13 c3 -4 8 -3 9 0 c-3 2 -7 2 -9 0z" fill="#2e7d32"/><path d="M27 12.6 l-4 0.6" stroke="#1b5e20" stroke-width=".7"/>' +
      '<circle cx="39" cy="15" r="1.8" fill="#e9b949" stroke="#a5781e" stroke-width=".5"/><circle cx="42.5" cy="13.2" r="1.4" fill="#e9b949" stroke="#a5781e" stroke-width=".5"/>' +
      '<ellipse cx="25" cy="16.5" rx="5" ry="1" fill="#fff" opacity=".5"/><path d="M10 20 Q12 30 20 35" stroke="#fff" stroke-width="2" fill="none" opacity=".6" stroke-linecap="round"/></svg>';
  }

  /* ---------------- backdrop: shaadi tent ---------------- */
  function bgWedding(W, H) {
    var o = '<svg class="bgsvg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">';
    o += '<defs><linearGradient id="bgw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b0f1e"/><stop offset=".55" stop-color="#6b1730"/><stop offset="1" stop-color="#2a0a14"/></linearGradient>' +
         '<radialGradient id="glow" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#ffb347" stop-opacity=".35"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs>';
    o += '<rect width="' + W + '" height="' + H + '" fill="url(#bgw)"/>';
    // tent stripes
    var n = Math.ceil(W / 80);
    for (var i = 0; i < n; i++) {
      var x = i * 80;
      o += '<path d="M' + x + ' 0 L' + (x + 80) + ' 0 L' + (x + 80) + ' ' + (H * 0.62) + ' Q' + (x + 40) + ' ' + (H * 0.66) + ' ' + x + ' ' + (H * 0.62) + ' Z" fill="' + (i % 2 ? '#a3182f' : '#d9622b') + '" opacity=".55"/>';
    }
    // swags on top
    for (i = 0; i < n; i++) {
      x = i * 80;
      o += '<path d="M' + x + ' 0 Q' + (x + 40) + ' 46 ' + (x + 80) + ' 0" fill="' + (i % 2 ? '#f2b134' : '#c2185b') + '" opacity=".85"/>';
    }
    o += '<rect width="' + W + '" height="' + H + '" fill="url(#glow)"/>';
    // marigold garlands hanging
    var g = '';
    [W * 0.06, W * 0.16, W * 0.84, W * 0.94].forEach(function (gx, k) {
      var len = H * (k % 2 ? 0.34 : 0.46);
      for (var y = 30; y < len; y += 13) g += '<circle cx="' + gx + '" cy="' + y + '" r="8" fill="' + ((y / 13) % 2 < 1 ? '#ff9800' : '#ffc107') + '"/>';
      g += '<path d="M' + (gx - 6) + ' ' + (len + 4) + ' l6 14 l6 -14z" fill="#e53935"/>';
    });
    o += '<g opacity=".95">' + g + '</g>';
    // fairy lights: three sagging strings
    var lights = '';
    [[0.08, 0.2], [0.03, 0.12], [0.14, 0.27]].forEach(function (yy, k) {
      var y0 = H * yy[0], sag = H * yy[1], pts = [];
      for (var t = 0; t <= 1.0001; t += 1 / 40) pts.push([t * W, y0 + Math.sin(t * Math.PI * (2 + k)) * 0 + 4 * sag * t * (1 - t) * (k === 1 ? 0.6 : 1)]);
      lights += '<path d="M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1) }).join(' L') + '" stroke="#2b1a10" stroke-width="1.5" fill="none" opacity=".7"/>';
      pts.forEach(function (p, j) {
        if (j % 2) return;
        var col = ['#ffd54f', '#ff8a65', '#fff59d', '#ffb74d'][(j / 2 + k) % 4];
        lights += '<circle class="bulb b' + ((j / 2 + k) % 3) + '" cx="' + p[0].toFixed(1) + '" cy="' + (p[1] + 5).toFixed(1) + '" r="4" fill="' + col + '"/>';
      });
    });
    o += '<g class="lights">' + lights + '</g>';
    o += '</svg>';
    return o;
  }


  /* ---------------- other table themes ---------------- */
  // deterministic sprinkle so the background never jumps on resize
  function prng(seed) { var a = seed >>> 0; return function () { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296 } }

  function bgDhaba(W, H) {
    var r = prng(7), o = '<svg class="bgsvg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">';
    o += '<defs><linearGradient id="dsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070b1f"/><stop offset=".55" stop-color="#1b2550"/><stop offset="1" stop-color="#3a2a3a"/></linearGradient>' +
      '<radialGradient id="dmoon" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fffbe6"/><stop offset=".55" stop-color="#fff3c0"/><stop offset="1" stop-color="#fff3c0" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="dglow" cx="50%" cy="60%" r="60%"><stop offset="0" stop-color="#ffb347" stop-opacity=".35"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs>';
    o += '<rect width="' + W + '" height="' + H + '" fill="url(#dsky)"/>';
    for (var i = 0; i < 90; i++) o += '<circle class="star s' + (i % 3) + '" cx="' + (r() * W).toFixed(0) + '" cy="' + (r() * H * 0.5).toFixed(0) + '" r="' + (0.6 + r() * 1.6).toFixed(1) + '" fill="#fff"/>';
    o += '<circle cx="' + (W * 0.84) + '" cy="' + (H * 0.16) + '" r="80" fill="url(#dmoon)"/><circle cx="' + (W * 0.84) + '" cy="' + (H * 0.16) + '" r="30" fill="#fffbe6"/>';
    // hills and the highway
    o += '<path d="M0 ' + (H * .5) + ' Q' + (W * .2) + ' ' + (H * .38) + ' ' + (W * .42) + ' ' + (H * .48) + ' T' + (W * .8) + ' ' + (H * .44) + ' T' + W + ' ' + (H * .5) + ' V' + H + ' H0Z" fill="#141a33"/>';
    o += '<rect y="' + (H * .58) + '" width="' + W + '" height="' + (H * .42) + '" fill="#231a22"/>';
    // a painted truck parked on the right
    var tx = W * 0.72, ty = H * 0.38;
    o += '<g transform="translate(' + tx + ' ' + ty + ')">' +
      '<rect x="0" y="0" width="230" height="120" rx="8" fill="#e65100"/><rect x="0" y="0" width="230" height="22" rx="8" fill="#1565c0"/>' +
      '<path d="M0 30 h230 M0 98 h230" stroke="#ffd54f" stroke-width="6"/><path d="M10 40 h210 v50 h-210z" fill="#2e7d32"/>' +
      '<text x="115" y="72" text-anchor="middle" font-family="\'Yatra One\',\'Baloo 2\',cursive" font-size="26" fill="#ffeb3b">HORN OK PLEASE</text>' +
      '<g fill="#ffeb3b">' + [20, 60, 100, 140, 180].map(function (x) { return '<circle cx="' + (x + 10) + '" cy="11" r="5"/>' }).join('') + '</g>' +
      '<path d="M230 30 h56 l30 40 v50 h-86z" fill="#ad1457"/><path d="M240 40 h40 l20 30 h-60z" fill="#90caf9"/>' +
      '<circle cx="60" cy="128" r="20" fill="#111"/><circle cx="60" cy="128" r="8" fill="#9e9e9e"/><circle cx="270" cy="128" r="20" fill="#111"/><circle cx="270" cy="128" r="8" fill="#9e9e9e"/>' +
      '<circle class="hl" cx="314" cy="104" r="6" fill="#fff8c4"/></g>';
    // tin roof eave with bulbs
    var eave = '';
    for (var x = 0; x < W; x += 22) eave += '<rect x="' + x + '" y="0" width="22" height="' + (H * .1) + '" fill="' + ((x / 22) % 2 ? '#8d8f94' : '#a7a9ad') + '"/>';
    o += eave + '<rect y="' + (H * .1) + '" width="' + W + '" height="10" fill="#5d4037"/>';
    o += '<g opacity=".25">' + [0.12, 0.33, 0.61].map(function (p) { return '<rect x="' + (W * p) + '" y="0" width="60" height="' + (H * .1) + '" fill="#8d4a1f"/>' }).join('') + '</g>';
    for (i = 0; i < 9; i++) {
      var bx = W * (0.06 + i * 0.11), by = H * .1 + 30 + (i % 2) * 14;
      o += '<path d="M' + bx + ' ' + (H * .1 + 10) + ' V' + by + '" stroke="#222" stroke-width="2"/><circle class="bulb b' + (i % 3) + '" cx="' + bx + '" cy="' + (by + 8) + '" r="9" fill="#ffe082"/>';
    }
    // the dhaba board
    o += '<g transform="translate(' + (W * .05) + ' ' + (H * .17) + ') rotate(-3)"><rect width="250" height="66" rx="8" fill="#ffd600" stroke="#b71c1c" stroke-width="5"/>' +
      '<text x="125" y="34" text-anchor="middle" font-family="\'Yatra One\',\'Baloo 2\',cursive" font-size="30" fill="#b71c1c">Highway Dhaba</text>' +
      '<text x="125" y="56" text-anchor="middle" font-family="\'Baloo 2\',sans-serif" font-weight="800" font-size="15" fill="#1b5e20">PURE DESI · 24 HRS · CHAI ✦ PARATHA</text></g>';
    // chai kettle on a stove with steam
    var kx = W * 0.06, ky = H * .44;
    o += '<g transform="translate(' + kx + ' ' + ky + ')"><rect x="-10" y="60" width="120" height="40" rx="6" fill="#37474f"/><ellipse cx="50" cy="60" rx="40" ry="6" fill="#ff7043" opacity=".8"/>' +
      '<path d="M18 58 C14 20 86 20 82 58Z" fill="#b0bec5" stroke="#455a64" stroke-width="3"/><path d="M82 34 C102 30 106 20 112 14" stroke="#455a64" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M30 26 Q50 6 70 26" stroke="#455a64" stroke-width="4" fill="none"/>' +
      '<g class="steam2"><circle cx="112" cy="4" r="8" fill="#fff" opacity=".5"/><circle cx="118" cy="-14" r="10" fill="#fff" opacity=".35"/><circle cx="112" cy="-34" r="12" fill="#fff" opacity=".2"/></g></g>';
    o += '<rect width="' + W + '" height="' + H + '" fill="url(#dglow)"/></svg>';
    return o;
  }

  function bgCanteen(W, H) {
    var o = '<svg class="bgsvg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">';
    o += '<defs><linearGradient id="cwall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f3e6"/><stop offset="1" stop-color="#cfe3cc"/></linearGradient>' +
      '<linearGradient id="cwin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#d7f1ff"/></linearGradient></defs>';
    o += '<rect width="' + W + '" height="' + H + '" fill="url(#cwall)"/>';
    o += '<rect y="' + (H * .52) + '" width="' + W + '" height="' + (H * .48) + '" fill="#2e7d6b"/><rect y="' + (H * .52) + '" width="' + W + '" height="8" fill="#1b5e50"/>';
    // windows with trees
    [0.04, 0.78].forEach(function (p) {
      var wx = W * p, wy = H * .14, ww = W * .18, wh = H * .3;
      o += '<rect x="' + wx + '" y="' + wy + '" width="' + ww + '" height="' + wh + '" fill="url(#cwin)" stroke="#6d4c41" stroke-width="8"/>';
      o += '<circle cx="' + (wx + ww * .3) + '" cy="' + (wy + wh * .75) + '" r="' + (ww * .22) + '" fill="#43a047"/><circle cx="' + (wx + ww * .62) + '" cy="' + (wy + wh * .7) + '" r="' + (ww * .28) + '" fill="#2e7d32"/>';
      o += '<path d="M' + (wx + ww / 2) + ' ' + wy + ' V' + (wy + wh) + ' M' + wx + ' ' + (wy + wh / 2) + ' H' + (wx + ww) + '" stroke="#6d4c41" stroke-width="5"/>';
    });
    // menu board
    var mx = W * .3, my = H * .12, mw = W * .4, mh = H * .3;
    o += '<rect x="' + mx + '" y="' + my + '" width="' + mw + '" height="' + mh + '" rx="6" fill="#1f3b2e" stroke="#8d6e63" stroke-width="9"/>';
    o += '<text x="' + (mx + mw / 2) + '" y="' + (my + 40) + '" text-anchor="middle" font-family="\'Yatra One\',\'Baloo 2\',cursive" font-size="32" fill="#fffde7">College Canteen</text>';
    var items = [['Cutting chai', '10'], ['Maggi', '40'], ['Samosa', '15'], ['Vada pav', '20'], ['Cold coffee', '35'], ['Egg roll', '45']];
    items.forEach(function (it, k) {
      var col = k % 2, row = Math.floor(k / 2), ix = mx + 30 + col * mw / 2, iy = my + 80 + row * 34;
      o += '<text x="' + ix + '" y="' + iy + '" font-family="\'Baloo 2\',sans-serif" font-weight="600" font-size="20" fill="#e8f5e9">' + it[0] + '</text><text x="' + (ix + mw / 2 - 60) + '" y="' + iy + '" text-anchor="end" font-family="\'Baloo 2\',sans-serif" font-weight="800" font-size="20" fill="#ffeb3b">₹' + it[1] + '</text>';
    });
    // notice board with posters
    var nx = W * .79, ny = H * .5;
    o += '<rect x="' + (W * .04) + '" y="' + (H * .56) + '" width="' + (W * .16) + '" height="' + (H * .2) + '" fill="#a1887f" stroke="#5d4037" stroke-width="5"/>' +
      '<rect x="' + (W * .05) + '" y="' + (H * .58) + '" width="' + (W * .07) + '" height="' + (H * .1) + '" fill="#ffeb3b" transform="rotate(-4 ' + (W * .08) + ' ' + (H * .6) + ')"/>' +
      '<text x="' + (W * .085) + '" y="' + (H * .64) + '" text-anchor="middle" font-family="\'Baloo 2\',sans-serif" font-weight="800" font-size="13" fill="#c62828" transform="rotate(-4 ' + (W * .08) + ' ' + (H * .6) + ')">TECH FEST</text>' +
      '<rect x="' + (W * .125) + '" y="' + (H * .6) + '" width="' + (W * .065) + '" height="' + (H * .09) + '" fill="#fff" transform="rotate(5 ' + (W * .15) + ' ' + (H * .64) + ')"/>' +
      '<text x="' + (W * .158) + '" y="' + (H * .65) + '" text-anchor="middle" font-family="\'Baloo 2\',sans-serif" font-weight="700" font-size="11" fill="#333" transform="rotate(5 ' + (W * .15) + ' ' + (H * .64) + ')">LOST: ID CARD</text>';
    // tube lights and ceiling fans
    [0.22, 0.78].forEach(function (p) { o += '<rect x="' + (W * p - 70) + '" y="10" width="140" height="10" rx="5" fill="#fff" stroke="#bdbdbd"/><rect x="' + (W * p - 70) + '" y="10" width="140" height="10" rx="5" fill="#fff" opacity=".9" filter="drop-shadow(0 0 8px #fff)"/>' });
    [0.38, 0.62].forEach(function (p) {
      var fx0 = W * p, fy0 = 46;
      o += '<path d="M' + fx0 + ' 0 V' + (fy0 - 6) + '" stroke="#757575" stroke-width="4"/><g class="fan" style="transform-origin:' + fx0 + 'px ' + fy0 + 'px">' +
        [0, 120, 240].map(function (a) { return '<ellipse cx="' + (fx0 + 52) + '" cy="' + fy0 + '" rx="50" ry="9" fill="#8d6e63" transform="rotate(' + a + ' ' + fx0 + ' ' + fy0 + ')"/>' }).join('') +
        '</g><circle cx="' + fx0 + '" cy="' + fy0 + '" r="12" fill="#616161"/>';
    });
    o += '</svg>';
    return o;
  }

  function bgDiwali(W, H) {
    var r = prng(11), o = '<svg class="bgsvg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">';
    o += '<defs><linearGradient id="wsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12062b"/><stop offset=".6" stop-color="#3b1a5c"/><stop offset="1" stop-color="#6b2b4a"/></linearGradient>' +
      '<radialGradient id="wglow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcc80"/><stop offset="1" stop-color="#ffcc80" stop-opacity="0"/></radialGradient></defs>';
    o += '<rect width="' + W + '" height="' + H + '" fill="url(#wsky)"/>';
    for (var i = 0; i < 60; i++) o += '<circle class="star s' + (i % 3) + '" cx="' + (r() * W).toFixed(0) + '" cy="' + (r() * H * 0.4).toFixed(0) + '" r="' + (0.6 + r() * 1.3).toFixed(1) + '" fill="#fff"/>';
    // fireworks: rings of sparks that burst and fade on a loop
    var cols = ['#ffd54f', '#ff5c8a', '#69f0ae', '#40c4ff', '#ff8a65'];
    for (i = 0; i < 6; i++) {
      var fx0 = W * (0.1 + 0.16 * i + r() * 0.06), fy0 = H * (0.1 + r() * 0.22), c = cols[i % cols.length], sp = '';
      for (var k = 0; k < 16; k++) { var a = k / 16 * Math.PI * 2; sp += '<line x1="' + fx0 + '" y1="' + fy0 + '" x2="' + (fx0 + Math.cos(a) * 46).toFixed(1) + '" y2="' + (fy0 + Math.sin(a) * 46).toFixed(1) + '" stroke="' + c + '" stroke-width="3" stroke-linecap="round" stroke-dasharray="6 40"/>' }
      o += '<g class="fw" style="transform-origin:' + fx0 + 'px ' + fy0 + 'px;animation-delay:' + (i * 0.7).toFixed(1) + 's">' + sp + '<circle cx="' + fx0 + '" cy="' + fy0 + '" r="4" fill="#fff"/></g>';
    }
    // city skyline with lit windows
    var sky = '', x = 0;
    while (x < W) {
      var bw = 50 + r() * 70, bh = H * (0.16 + r() * 0.2), by = H * 0.62 - bh;
      sky += '<rect x="' + x.toFixed(0) + '" y="' + by.toFixed(0) + '" width="' + bw.toFixed(0) + '" height="' + (bh + 40).toFixed(0) + '" fill="#1d1033"/>';
      for (var wy = by + 10; wy < H * 0.6; wy += 18) for (var wx = x + 8; wx < x + bw - 10; wx += 16) if (r() < 0.45) sky += '<rect x="' + wx.toFixed(0) + '" y="' + wy.toFixed(0) + '" width="7" height="9" fill="' + (r() < 0.5 ? '#ffcc80' : '#ffe082') + '" opacity=".85"/>';
      x += bw + 4;
    }
    o += sky;
    // terrace parapet with diyas
    var py = H * 0.6;
    o += '<rect y="' + py + '" width="' + W + '" height="' + (H - py) + '" fill="#4e2a3c"/><rect y="' + py + '" width="' + W + '" height="16" fill="#7a4a5c"/>';
    for (x = 30; x < W; x += 70) {
      o += '<circle cx="' + x + '" cy="' + (py - 6) + '" r="26" fill="url(#wglow)" opacity=".6"/>' +
        '<path d="M' + (x - 14) + ' ' + (py + 2) + ' Q' + x + ' ' + (py + 14) + ' ' + (x + 14) + ' ' + (py + 2) + 'Z" fill="#bf5b2a" stroke="#7a3412" stroke-width="2"/>' +
        '<path class="diya" style="transform-origin:' + x + 'px ' + (py + 1) + 'px" d="M' + x + ' ' + (py - 14) + ' C' + (x - 6) + ' ' + (py - 6) + ' ' + (x - 4) + ' ' + (py + 1) + ' ' + x + ' ' + (py + 1) + ' C' + (x + 4) + ' ' + (py + 1) + ' ' + (x + 6) + ' ' + (py - 6) + ' ' + x + ' ' + (py - 14) + 'Z" fill="#ffca28"/>';
    }
    // hanging star lanterns
    [0.12, 0.88].forEach(function (p, j) {
      var lx = W * p, ly = H * 0.24;
      o += '<path d="M' + lx + ' 0 V' + (ly - 30) + '" stroke="#ffcc80" stroke-width="2"/><g class="lantern" style="transform-origin:' + lx + 'px 0px">' +
        '<path d="M' + lx + ' ' + (ly - 34) + ' L' + (lx + 12) + ' ' + (ly - 10) + ' L' + (lx + 38) + ' ' + (ly - 6) + ' L' + (lx + 18) + ' ' + (ly + 12) + ' L' + (lx + 24) + ' ' + (ly + 38) + ' L' + lx + ' ' + (ly + 24) + ' L' + (lx - 24) + ' ' + (ly + 38) + ' L' + (lx - 18) + ' ' + (ly + 12) + ' L' + (lx - 38) + ' ' + (ly - 6) + ' L' + (lx - 12) + ' ' + (ly - 10) + 'Z" fill="' + (j ? '#ff5c8a' : '#ffb300') + '" stroke="#fff3c4" stroke-width="2.5"/>' +
        '<path d="M' + (lx - 10) + ' ' + (ly + 34) + ' v30 M' + lx + ' ' + (ly + 28) + ' v40 M' + (lx + 10) + ' ' + (ly + 34) + ' v30" stroke="' + (j ? '#ff5c8a' : '#ffb300') + '" stroke-width="2"/></g>';
    });
    // light strings
    var ls = '';
    for (i = 0; i <= 40; i++) { var t = i / 40, lx2 = t * W, ly2 = H * 0.05 + 4 * H * 0.1 * t * (1 - t); if (i % 2 === 0) ls += '<circle class="bulb b' + (i % 3) + '" cx="' + lx2.toFixed(0) + '" cy="' + ly2.toFixed(0) + '" r="4" fill="' + cols[i % 5] + '"/>' }
    o += ls + '</svg>';
    return o;
  }

  var THEMES = {
    wedding: { name: 'Shaadi tent', emoji: '💐', bg: bgWedding },
    dhaba: { name: 'Highway dhaba', emoji: '🚚', bg: bgDhaba },
    canteen: { name: 'College canteen', emoji: '🍜', bg: bgCanteen },
    diwali: { name: 'Diwali terrace', emoji: '🪔', bg: bgDiwali }
  };
  function backdrop(W, H, theme) { return (THEMES[theme] || THEMES.wedding).bg(W, H) }
  // the pattern printed on the table top
  function feltArt(theme) {
    var o = '<svg viewBox="0 0 200 200" preserveAspectRatio="none">';
    if (theme === 'dhaba') {
      o += '<g opacity=".18" stroke="#3e2410" stroke-width="1.2">';
      for (var y = 14; y < 200; y += 22) o += '<path d="M0 ' + y + ' H200"/>';
      o += '</g>';
    } else if (theme === 'canteen') {
      o += '<g fill="#fff" opacity=".18">';
      var r = prng(5); for (var i = 0; i < 70; i++) o += '<circle cx="' + (r() * 200).toFixed(1) + '" cy="' + (r() * 200).toFixed(1) + '" r="' + (0.6 + r()).toFixed(1) + '"/>';
      o += '</g>';
    } else if (theme === 'diwali') {
      var cols = ['#ff5c8a', '#ffd54f', '#69f0ae', '#40c4ff', '#ff8a65', '#b388ff'];
      o += '<g opacity=".75">';
      for (var ring = 0; ring < 3; ring++) for (var k = 0; k < 12; k++) {
        var a = k * 30 + ring * 15, rr = 26 + ring * 22;
        o += '<ellipse cx="100" cy="' + (100 - rr) + '" rx="' + (6 + ring * 2) + '" ry="' + (12 + ring * 3) + '" fill="' + cols[(k + ring) % 6] + '" transform="rotate(' + a + ' 100 100)"/>';
      }
      o += '<circle cx="100" cy="100" r="16" fill="#ffd54f"/><circle cx="100" cy="100" r="8" fill="#ff5c8a"/></g>';
    } else {
      o += '<g fill="none" stroke="#f5c542" stroke-width="1.2" opacity=".9"><circle cx="100" cy="100" r="30"/><circle cx="100" cy="100" r="46"/><circle cx="100" cy="100" r="70" stroke-dasharray="4 5"/>';
      for (var p = 0; p < 16; p++) o += '<ellipse cx="100" cy="42" rx="7" ry="16" transform="rotate(' + (p * 22.5) + ' 100 100)"/>';
      o += '</g>';
    }
    return o + '</svg>';
  }

  var ART = { CAST: CAST, INFO: INFO, ORDER: ORDER, RANK: RANK, character: function (k, fit) { return CAST[k](!!fit) },
    cardFace: cardFace, cardBack: cardBack, golgappa: golgappa, plate: plateSVG, katori: katori, backdrop: backdrop, feltArt: feltArt, THEMES: THEMES, flames: flames };
  if (typeof module !== 'undefined' && module.exports) module.exports = ART;
  else root.LCArt = ART;
})(this);
