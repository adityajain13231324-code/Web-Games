/* Runs the computer player off the main thread so the UI never freezes while it thinks. */
importScripts('rules.js', 'ai.js');

self.onmessage = function (e) {
  const { id, state, level, opts } = e.data;
  const move = self.UTTT.ai.choose(state, level, opts);
  self.postMessage({ id, move: { b: move.b, c: move.c } });
};
