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
node tests/test-engine.js     # the analysis engine: exact vs plain minimax, mates, MultiPV, time budget, depth beats shallow
node tests/test-ai.js         # the computer player: legal moves, wins, blocks, strength per level, time budget
node tests/test-tutorial.js   # every scripted tutorial move is legal and shows what its text says
```

Each prints `N passed, 0 failed`.

The browser test plays the real page in headless Chromium (tutorial and skip, illegal-move feedback, a full game, replay, rematch, undo/redo, hints, timer, keyboard, all themes, sound packs, the analysis board with a full game review, phone/tablet/landscape layouts, and online play with a mocked PeerJS). It serves the game itself:

```sh
npm i playwright          # once, anywhere; or use a global install
node tests/ui-smoke.js
```

The real PeerJS broker needs the internet, so it is not part of that test. To check it by hand: open the game in two tabs, **Play Online** in one → **Create a room**, enter the 4-letter code in the other → **Join**.

## Put it online

Vercel (same as the other games):

1. Vercel → **Add New → Project** → import this repo.
2. **Root Directory:** `games/ultimate-tic-tac-toe`. **Framework Preset:** Other. No build command.
3. The live game is https://bettertictactoe.vercel.app, deployed from the standalone repo `adityajain13231324-code/ultimate-tic-tac-toe`. The hub links to it from `hub/index.html` (card and reel panel) and `hub/main.js` (`CHANNELS`); change those if the address changes.

`vercel.json` already says there is no framework and no build step. Netlify, GitHub Pages or any static host work the same way; every path in the game is relative.

## Online play: when two players cannot connect

Online play is a direct browser-to-browser link (WebRTC through PeerJS). The two players' networks have to be able to reach each other; the game says which step failed:

- **"Could not reach the matchmaking server"**: a VPN, ad-blocker, or a school or work network blocks PeerJS's free broker. Try another network or switch the blocker off.
- **"Found the room, but your two networks could not open a direct link"**: the usual case when one player is on mobile data or a strict Wi-Fi. Same Wi-Fi, or one player's phone hotspot, almost always works. If it says the network "blocks the helper servers", that network allows no direct links at all.
- **"No room with that code"**: wrong letters, or the host closed the room.

For reliable play between different networks the game needs a TURN relay. The built-in one is a free shared server that can be slow or down. To add your own (free tiers exist at [metered.ca](https://www.metered.ca/tools/openrelay/) and Cloudflare Calls), create an account, copy its TURN host, username and credential into `js/ice-config.js`, and redeploy. Those values are visible to every visitor (normal for browser WebRTC), so use a free-tier account.

The browser console shows `[online] ...` lines (stages and ICE state) to help debug.

## Settings you might want to change

- Hints per game: `HINTS` at the top of `js/game.js`.
- How long the computer "thinks": `THINK_MS` in `js/game.js`; the Hard search budget is the `1000` passed to `AIC.ask` in `think()`.
- The public relay servers used when two players are behind strict networks: `ICE` in `js/net.js`.
