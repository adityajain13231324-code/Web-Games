/* Runs the analysis engine off the main thread. Messages in:
     { id, cmd: 'analyze', state, opts }   -> { id, type: 'info', info } after every finished depth, then { id, type: 'done' }
     { id, cmd: 'review', moves, opts }    -> { id, type: 'position', i, info } for every position of the game, then { id, type: 'done' }
   To stop a search the page simply terminates the worker. */
importScripts('rules.js', 'engine.js');

const R = self.UTTT.rules, E = self.UTTT.engine;
const searcher = E.createSearcher();   // one table for the whole worker: neighbouring positions share it

self.onmessage = function (e) {
  const { id, cmd } = e.data;
  if (cmd === 'analyze') {
    searcher.analyze(e.data.state, e.data.opts, (info) => self.postMessage({ id, type: 'info', info }));
    self.postMessage({ id, type: 'done' });
  } else if (cmd === 'review') {
    let s = R.newGame();
    for (let i = 0; i <= e.data.moves.length; i++) {
      if (i > 0) { const m = e.data.moves[i - 1]; s = m.b < 0 ? R.pass(s) : R.play(s, m.b, m.c).state; }
      const info = searcher.analyze(s, e.data.opts);
      self.postMessage({ id, type: 'position', i, info });
    }
    self.postMessage({ id, type: 'done' });
  }
};
