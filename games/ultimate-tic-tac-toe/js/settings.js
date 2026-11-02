/* Settings: loaded from and saved to localStorage, and the one place that applies a theme. */
(function (root) {
  'use strict';
  const U = root.UTTT, store = U.store, themes = U.themes;
  const reduceQuery = root.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersLight = root.matchMedia('(prefers-color-scheme: light)').matches;

  const DEFAULTS = {
    theme: prefersLight ? 'light' : 'neon',
    anim: null,                       // null = follow the system's reduced-motion setting
    level: 'medium', timer: 0, timeout: 'random', playAs: 'x',
    symbols: 'classic', custom: ['😀', '😎'],
    names: ['Player 1', 'Player 2'],
  };
  const data = Object.assign({}, DEFAULTS, store.get('settings', {}));
  if (!themes.LIST.some((t) => t.id === data.theme)) data.theme = DEFAULTS.theme;
  const listeners = [];

  const animOn = () => (data.anim == null ? !reduceQuery.matches : !!data.anim);

  function applyAnim() {
    const html = document.documentElement;
    html.classList.toggle('no-anim', !animOn());
    html.classList.toggle('anim-force', data.anim === true);
    U.fx.setEnabled(animOn());
  }

  function applyTheme(id) {
    const t = themes.byId(id);
    document.documentElement.dataset.theme = t.id;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t.meta;
    U.fx.setKind(t.fx);
    U.audio.setPack(t.pack);
  }

  /* Cross-fade between themes: the View Transitions API where it exists, else a short CSS transition. */
  function setTheme(id, quiet) {
    if (id === data.theme && document.documentElement.dataset.theme === id) return;
    data.theme = id; save();
    const change = () => { applyTheme(id); emit('theme'); };
    const html = document.documentElement;
    if (quiet || !animOn()) { change(); return; }
    U.audio.play('theme');
    if (document.startViewTransition) {
      try { document.startViewTransition(change); return; } catch (e) { /* fall through */ }
    }
    html.classList.add('theming');
    change();
    setTimeout(() => html.classList.remove('theming'), 650);
  }

  function emit(key) { listeners.forEach((f) => f(key)); }
  function save() { store.set('settings', data); }

  /* The X and O symbols currently chosen, as { kind: 'draw' } or { kind: 'emoji', glyph }. */
  function symbolPair() {
    if (data.symbols === 'classic') return [{ kind: 'draw' }, { kind: 'draw' }];
    if (data.symbols === 'custom') {
      const pick = (s, d) => Array.from(String(s || '').trim())[0] || d;
      return [{ kind: 'emoji', glyph: pick(data.custom[0], '😀') }, { kind: 'emoji', glyph: pick(data.custom[1], '😎') }];
    }
    const set = themes.SYMBOLS.find((s) => s.id === data.symbols);
    return set && set.glyphs ? set.glyphs.map((g) => ({ kind: 'emoji', glyph: g })) : [{ kind: 'draw' }, { kind: 'draw' }];
  }

  reduceQuery.addEventListener('change', () => { if (data.anim == null) { applyAnim(); emit('anim'); } });

  U.settings = {
    data, animOn, symbolPair, setTheme,
    set(key, value) { data[key] = value; save(); if (key === 'anim') applyAnim(); emit(key); },
    onChange(f) { listeners.push(f); },
    init() { applyTheme(data.theme); applyAnim(); },
  };
})(window);
