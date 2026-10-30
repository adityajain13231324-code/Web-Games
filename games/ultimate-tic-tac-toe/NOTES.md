# Ultimate Tic Tac Toe: project notes

Last updated: 30 October 2026 (first version, built and added to the hub as channel 2). Read this before changing anything.

## What it is

Ultimate Tic Tac Toe in the browser: a 3×3 grid of small 3×3 boards. The cell you play inside a small board decides which small board your opponent must play in next. Win three small boards in a row to win the game.

- **Genre:** two-player abstract strategy. **Players:** 2 (same device, vs computer, or online with a friend).
- **Hosting:** static site, no build step, no server, no paid services. Meant for Vercel with Root Directory `games/ultimate-tic-tac-toe` (see HOW_TO_RUN.md). The hub links to https://ultimate-tictactoe-game.vercel.app (**that project has to be created; see Known issues**).
- **In the hub:** channel 2, shown as one of the two featured cards beside Pixel Peek.

## The rules (as implemented in `js/rules.js`)

1. Players are X (moves first) and O. A small board is open, won by X or O, or **drawn** (full, no line).
2. The cell index you play (0–8, row by row) is the small board your opponent must play in next.
3. If that board is **won or drawn**, the opponent has a **free move** in any open board.
4. Win three small boards in a row (rows, columns, diagonals). **Drawn boards count for nobody.**
5. If every board is decided and nobody has a line, the game is a **draw**.
6. Clicking a won board is refused ("That board is already won"), a full one too ("That board is full"). Reasons are checked in this order: closed board, wrong board, taken cell.
7. **Timer option "Lose turn":** when time runs out the turn passes and the opponent gets a free move (recorded as a move with `b = -1` in history, undo and replay). The other option plays a random legal move.

## How it is built

No framework, no modules: classic scripts in a fixed order that share one `window.UTTT` namespace. The pure files also load in Node (and in a Web Worker), which is how the tests reach them.

| File | Job | Pure / testable |
| --- | --- | --- |
| `js/rules.js` | State, legality and reasons, win / draw detection, make / unmake move, replay from a move list | yes (Node) |
| `js/ai.js` | Easy = random. Medium = one-move lookahead (win game, win board, block, don't hand over a free move or a winning reply). Hard = negamax with alpha-beta, move ordering, iterative deepening on a time budget (reaches depth 8–9 in about 0.9 s), evaluation on board ownership (centre > corner > edge), open-board line potential, big-board lines and who has a free move | yes (Node) |
| `js/ai-worker.js` | Runs the AI off the main thread so the UI never freezes; `game.js` falls back to the main thread (shorter budget) if workers are unavailable, e.g. from `file://` | |
| `js/tutorial-script.js` | The seven lessons as data plus a state builder | yes (Node) |
| `js/board.js` | The board DOM and every board animation; knows nothing about rules | |
| `js/game.js` | One match: turns, computer turns, timer, undo / redo, hints, pause, history, replay, scoreboard, results | |
| `js/app.js` | Menu, dialogs, settings controls, online room flow, first-visit tutorial | |
| `js/tutorial.js` | Spotlight overlay, guide box, scripted demo boards | |
| `js/net.js` | PeerJS transport only (host a room, join by code, JSON messages); the protocol is in `app.js` | |
| `js/audio.js` | Web Audio sound engine and the seven sound packs | |
| `js/fx.js` | Particle canvas (sparks, confetti, bubbles, leaves, pixels...) | |
| `js/themes.js`, `js/settings.js`, `js/stats.js`, `js/store.js` | Theme list, saved settings and theme switching, stats and achievements, localStorage wrapper | |
| `css/themes.css`, `css/game.css`, `css/fonts.css` | Tokens per theme, layout and components, local fonts | |

Saved in localStorage (prefix `uttt.`): `settings`, `sound`, `score` (per mode), `stats`, `tutorial` (`done` or `skipped`).

## Decisions worth remembering

- **Marks are SVG strokes with `pathLength="1"`**, so one `stroke-dasharray`/`dashoffset` animation draws any X or O. The dash is `1 2` (not `1 1`) so round caps don't leave a dot before the draw starts. Themes pick the shape set (clean, sketch, pixel).
- **Glow is drawn, not filtered.** The neon theme first used CSS `drop-shadow` on every mark and idled at about 1.5 fps in a software renderer; a wide, faint copy of each stroke underneath (`.halo`) looks nearly the same and idles at 60. Don't put `filter` back on marks.
- **Animate transform and opacity only** (the stroke draw-on is the one exception). The breathing glow on the board you must play in is a pseudo-element whose opacity and scale pulse.
- **A new move finishes pending animation steps, it doesn't cancel them** (`flush()` in `board.js`). Cancelling dropped the "board claimed" step when moves came quickly (found by the browser test).
- **Illegal cells stay clickable** (`aria-disabled`, not `disabled`) so the player gets the shake, the sound and the reason. Automation tools that refuse `aria-disabled` clicks need `force`.
- **Theme cross-fade:** the View Transitions API where it exists, else a 0.6 s CSS transition class. Both are skipped when animations are off.
- **Animations off** = the setting, or the system's reduced-motion preference when the setting was never touched. It also disables particles and the screen shake.
- **Score is per pairing:** it resets when the mode, names (or difficulty vs the computer) change, and carries across rematches and reloads. A rematch swaps who plays X.
- **Fonts are bundled** (OFL, see `fonts/LICENSES.txt`) so the game needs no CDN. The 16 px minimum on inputs stops iOS zooming on focus.

## Done

- [x] Local, vs computer (3 levels, worker, thinking dots, "hmm" on Hard) and online (room code, PeerJS).
- [x] Seven themes with live cross-fade, own sound pack, particles, board and mark style; saved.
- [x] All requested animations, illegal-move feedback (shake, sound, one non-stacking toast, flash of the legal boards), hover ghost, last-move marker, timer bar.
- [x] Interactive tutorial with spotlight, scripted demos and Skip on every step (remembered); "How to Play" replays it.
- [x] Undo / redo (local and vs computer), hints (3 per game), move history, full replay with step / scrub, turn timer (15 s / 30 s), scoreboard, stats and 8 achievements, custom names, X/O side, emoji symbols (presets or your own), pause / quit / restart with confirm, keyboard play and screen-reader labels, responsive layouts (phone portrait and landscape, tablet, desktop).
- [x] Tests: `test-rules.js` (15), `test-ai.js` (6), `test-tutorial.js` (6), `ui-smoke.js` (21 browser checks).

## Known issues / not done

- **The hub link is an assumption.** `ultimate-tic-tac-toe.vercel.app` and `ultimate-tictactoe.vercel.app` already belong to someone else, so the hub points at `ultimate-tictactoe-game.vercel.app` (it was unclaimed when checked). The Vercel project must be created with that name, or the links in `hub/index.html` and `hub/main.js` changed.
- **Online play:** tested with a mocked PeerJS in the browser test and once for real (two tabs, real PeerJS broker, real WebRTC). Not tested across two different networks or on real phones. No reconnect after a dropped connection (the other player is told their friend left), no chat, no spectators. It relies on PeerJS's free public broker and the free Open Relay TURN servers (best effort).
- **Sound was not listened to by ear.** The tests check that every sound plays in every theme and that the packs use different waveforms; whether they sound good needs a person with speakers.
- **Not tried on a real phone or iOS Safari.** Layouts were checked in emulated phones, a tablet and landscape. Needs a modern browser (uses `color-mix`, `inert`, `<dialog>`): roughly Chrome / Edge 111+, Safari 16.4+, Firefox 113+. Cells are about 38 px on a 390 px-wide phone (nine cells across), above the 24 px WCAG minimum but small.
- Hard is strong for a casual game, not unbeatable: depth-limited, no opening book, no transposition table.
- Undo / redo and hints are off in online games. The "Speed run" achievement counts both players' moves. Abandoned games are not counted in stats.
- The hub clip (`hub/media/ut.*`) is a scripted 36-move game recorded in the neon theme; retake it when the look changes.

## Ideas

- Installable app (manifest + service worker) like Blackjack 21.
- Reconnect, emotes or quick chat online; share a replay as a link.
- More computer personalities; a daily puzzle ("win in 3 from this position").
- Per-theme music, not just effects.
