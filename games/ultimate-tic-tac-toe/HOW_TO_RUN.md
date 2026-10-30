# How to run Ultimate Tic Tac Toe

A static site: plain HTML, CSS and JavaScript, no build step, no server of its own, no paid services.

## Play it locally

Serve the folder and open it (from `games/ultimate-tic-tac-toe`):

```sh
python3 -m http.server 8000
# or: npx serve .
```

Then go to http://localhost:8000.

Opening `index.html` straight from the disk also works for local 2-player and vs-computer (the computer then thinks on the main thread instead of a Web Worker, with a shorter time budget). Online play needs the internet either way.

## Run the tests

Needs Node 16+. From this folder:

```sh
node tests/test-rules.js      # the rules: free move, wins, drawn boards, a full drawn game, 3,000 random games
node tests/test-ai.js         # the computer player: legal moves, wins, blocks, strength per level, time budget
node tests/test-tutorial.js   # every scripted tutorial move is legal and shows what its text says
```

Each prints `N passed, 0 failed`.

The browser test plays the real page in headless Chromium (tutorial and skip, illegal-move feedback, a full game, replay, rematch, undo/redo, hints, timer, keyboard, all themes, sound packs, phone/tablet/landscape layouts, and online play with a mocked PeerJS). It serves the game itself:

```sh
npm i playwright          # once, anywhere; or use a global install
node tests/ui-smoke.js
```

The real PeerJS broker needs the internet, so it is not part of that test. To check it by hand: open the game in two tabs, **Play Online** in one → **Create a room**, enter the 4-letter code in the other → **Join**.

## Put it online

Vercel (same as the other games):

1. Vercel → **Add New → Project** → import this repo.
2. **Root Directory:** `games/ultimate-tic-tac-toe`. **Framework Preset:** Other. No build command.
3. Name the project **ultimate-tictactoe-game** so it deploys to https://ultimate-tictactoe-game.vercel.app, the address the hub links to. If you pick another name, update the link in `hub/index.html` (the card and the reel panel) and `hub/main.js` (`CHANNELS`).

`vercel.json` already says there is no framework and no build step. Netlify, GitHub Pages or any static host work the same way; every path in the game is relative.

## Settings you might want to change

- Hints per game: `HINTS` at the top of `js/game.js`.
- How long the computer "thinks": `THINK_MS` in `js/game.js`; the Hard search budget is the `1000` passed to `AIC.ask` in `think()`.
- The public relay servers used when two players are behind strict networks: `ICE` in `js/net.js`.
