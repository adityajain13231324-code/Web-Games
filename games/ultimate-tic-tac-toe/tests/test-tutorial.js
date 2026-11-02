/* Checks that every scripted tutorial move is legal and that each lesson shows what its text says.
   Run: node tests/test-tutorial.js */
const R = require('../js/rules.js');
const T = require('../js/tutorial-script.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error('FAIL ' + name + '\n  ' + e.message); }
}
function ok(v, msg) { if (!v) throw new Error(msg || 'assertion failed'); }

function run(step) {
  let s = T.build(step.setup);
  const trace = [s];
  for (const [b, c] of step.moves) {
    const r = R.check(s, b, c);
    ok(r.ok, `illegal scripted move [${b},${c}]: ${r.reason}`);
    s = R.play(s, b, c).state;
    trace.push(s);
  }
  return trace;
}

test('every step has text and focus for each phase', () => {
  T.STEPS.forEach((st, i) => {
    for (let k = 0; k <= st.moves.length; k++) { ok(T.at(st.text, k), `step ${i} phase ${k} has no text`); ok(T.at(st.focus, k), `step ${i} phase ${k} has no focus`); }
  });
});

test('all scripted moves are legal', () => { T.STEPS.forEach(run); });

test('"you pick their board": the cell played decides the next board', () => {
  const t = run(T.STEPS[2]);
  ok(t[0].next === 0 && t[1].next === 4);
});

test('"win a small board": the last move wins the top-left board for X', () => {
  const t = run(T.STEPS[3]);
  ok(t[0].boards[0] === 0 && t[1].boards[0] === R.X);
});

test('"free move": the sent-to board is won, so O may play anywhere open', () => {
  const t = run(T.STEPS[4]);
  ok(t[0].boards[0] === R.X && t[0].next === -1 && t[0].turn === R.O);
  ok(R.legalBoards(t[0]).length === 8 && !R.legalBoards(t[0]).includes(0));
});

test('"win the game": the last move gives X three boards in a row', () => {
  const t = run(T.STEPS[5]);
  ok(t[0].winner === 0 && t[1].winner === R.X && t[1].line.join() === '0,1,2');
  ok(t[0].cells.filter((v) => v === 1).length === t[0].cells.filter((v) => v === 2).length, 'X and O counts should match with X to move');
  [0, 1, 2, 3, 4, 5, 6, 7, 8].forEach((b) => ok(t[0].boards[b] !== R.O, 'no stray O board'));
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
