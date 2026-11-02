/* Theme list: how each theme feels beyond its colours (see css/themes.css for the colours).
   style  = how X and O are drawn: clean | sketch | pixel
   glow   = draw a soft halo under the marks and win lines
   fx     = particle shape for bursts and confetti (see fx.js)
   pack   = sound pack (see audio.js)
   swatch = three colours for the picker */
(function (root) {
  'use strict';
  const LIST = [
    { id: 'neon',   name: 'Neon Cyberpunk', style: 'clean',  glow: true,  fx: 'spark',    pack: 'synth',  swatch: ['#07060f', '#19f3ff', '#ff3df2'], meta: '#07060f' },
    { id: 'paper',  name: 'Paper & Pencil', style: 'sketch', fx: 'scrap',    pack: 'pencil', swatch: ['#f6efdc', '#35343a', '#2556b3'], meta: '#f6efdc' },
    { id: 'dark',   name: 'Dark Minimal',   style: 'clean',  fx: 'dot',      pack: 'soft',   swatch: ['#0d0e11', '#e9ecf1', '#5ec4b6'], meta: '#0d0e11' },
    { id: 'arcade', name: 'Retro Arcade',   style: 'pixel',  fx: 'pixel',    pack: 'chip',   swatch: ['#0a0a1e', '#ff4d4d', '#35e0ff'], meta: '#0a0a1e' },
    { id: 'ocean',  name: 'Ocean Calm',     style: 'clean',  fx: 'bubble',   pack: 'bubble', swatch: ['#082e4d', '#ff9a76', '#d9f6ff'], meta: '#082e4d' },
    { id: 'forest', name: 'Forest',         style: 'clean',  fx: 'leaf',     pack: 'wood',   swatch: ['#10261a', '#f2b24c', '#8be28b'], meta: '#10261a' },
    { id: 'light',  name: 'Light',          style: 'clean',  fx: 'confetti', pack: 'bell',   swatch: ['#f7f9fe', '#2b6cff', '#ff7a1a'], meta: '#f7f9fe' },
  ];

  /* Symbol sets for X and O. 'classic' draws the theme's own X and O; the rest are emoji. */
  const SYMBOLS = [
    { id: 'classic', name: 'Classic X / O', glyphs: null },
    { id: 'starmoon', name: '⭐ and 🌙', glyphs: ['⭐', '🌙'] },
    { id: 'catdog', name: '🐱 and 🐶', glyphs: ['🐱', '🐶'] },
    { id: 'fireice', name: '🔥 and ❄️', glyphs: ['🔥', '❄️'] },
    { id: 'food', name: '🍕 and 🍔', glyphs: ['🍕', '🍔'] },
    { id: 'space', name: '🚀 and 👾', glyphs: ['🚀', '👾'] },
    { id: 'custom', name: 'Your own…', glyphs: null },
  ];

  const byId = (id) => LIST.find((t) => t.id === id) || LIST[0];
  (root.UTTT = root.UTTT || {}).themes = { LIST, SYMBOLS, byId };
})(window);
