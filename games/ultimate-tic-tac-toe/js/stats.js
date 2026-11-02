/* Stats and achievements, saved locally. Wins and streaks only count games with one local player
   (vs computer or online); two players on one device count as games played and draws. */
(function (root) {
  'use strict';
  const store = root.UTTT.store;

  const ACHIEVEMENTS = [
    { id: 'first',    icon: '🥇', name: 'First win',      desc: 'Win a game against the computer or a friend online.' },
    { id: 'streak3',  icon: '🔥', name: 'On fire',        desc: 'Win 3 games in a row.' },
    { id: 'hard',     icon: '🧠', name: 'Brain beater',   desc: 'Beat the Hard computer.' },
    { id: 'speed',    icon: '⚡', name: 'Speed run',      desc: 'Win in 30 moves or fewer (both players counted).' },
    { id: 'comeback', icon: '🪃', name: 'Comeback',       desc: 'Win after being two small boards behind.' },
    { id: 'shutout',  icon: '🛡️', name: 'Shutout',        desc: 'Win without your opponent taking a single board.' },
    { id: 'draw',     icon: '🤝', name: 'Stalemate',      desc: 'Finish a game in a draw.' },
    { id: 'vet',      icon: '🎖️', name: 'Veteran',        desc: 'Play 10 games.' },
  ];

  const EMPTY = { played: 0, wins: 0, losses: 0, draws: 0, streak: 0, best: 0, fastest: 0, boards: 0, ach: {} };
  let data = Object.assign({}, EMPTY, store.get('stats', {}));
  data.ach = data.ach || {};

  /* info: { mode, level, result: 'win'|'loss'|'draw'|'played', moves, mine, theirs, deficit }
     Returns the achievements unlocked by this game. */
  function record(info) {
    data.played++;
    data.boards += info.mine || 0;
    if (info.result === 'draw') { data.draws++; data.streak = 0; }
    else if (info.result === 'win') {
      data.wins++; data.streak++; data.best = Math.max(data.best, data.streak);
      if (!data.fastest || info.moves < data.fastest) data.fastest = info.moves;
    } else if (info.result === 'loss') { data.losses++; data.streak = 0; }

    const earned = [];
    const give = (id) => { if (!data.ach[id]) { data.ach[id] = Date.now(); earned.push(ACHIEVEMENTS.find((a) => a.id === id)); } };
    if (info.result === 'win') {
      give('first');
      if (data.streak >= 3) give('streak3');
      if (info.mode === 'ai' && info.level === 'hard') give('hard');
      if (info.moves <= 30) give('speed');
      if (info.deficit >= 2) give('comeback');
      if (!info.theirs) give('shutout');
    }
    if (info.result === 'draw') give('draw');
    if (data.played >= 10) give('vet');
    store.set('stats', data);
    return earned;
  }

  root.UTTT.stats = {
    ACHIEVEMENTS, record,
    get data() { return data; },
    reset() { data = Object.assign({}, EMPTY, { ach: {} }); store.set('stats', data); },
  };
})(window);
