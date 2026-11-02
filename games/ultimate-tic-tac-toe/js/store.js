/* Saved data (localStorage), wrapped so a blocked or full store never breaks the game. */
(function (root) {
  'use strict';
  const PREFIX = 'uttt.';
  const memory = {};

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw != null) return JSON.parse(raw);
    } catch (e) { /* private mode, blocked or corrupt: fall through */ }
    return key in memory ? memory[key] : fallback;
  }

  function set(key, value) {
    memory[key] = value;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* keep the in-memory copy */ }
  }

  (root.UTTT = root.UTTT || {}).store = { get, set };
})(window);
