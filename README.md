# Games

Browser games I'm building. Each one lives in its own folder under `games/`, with:

- `NOTES.md`: what the game is, what's done, what's planned, known bugs and the decisions behind it. **Read this first.**
- `HOW_TO_RUN.md`: how to open or play it locally.

| Game | What it is | Tech | Hosting | Play it |
| --- | --- | --- | --- | --- |
| [`games/pixel-peek`](games/pixel-peek) | 2–8 player picture-guessing party game | Static site, PeerJS | Vercel | [gamepixelpeek.vercel.app](https://gamepixelpeek.vercel.app) |
| [`games/liars-call`](games/liars-call) | Desi cartoon bluffing card game (Liar's Table style), 2–6 players + bots | Static site, PeerJS, PWA | Vercel | [liarscall.vercel.app](https://liarscall.vercel.app) |
| [`games/blackjack21`](games/blackjack21) | Classic casino blackjack, 1–6 players + dealer, bots with personalities, matching-bets rule | Static site, PWA | Vercel | [blackjack21-cardgame.vercel.app](https://blackjack21-cardgame.vercel.app) |
| [`games/apartment-07`](games/apartment-07) | 1–4 player co-op escape mystery | Vite + TypeScript + Phaser, Node + Colyseus server | Railway (Node + WebSockets) | [apartment07.up.railway.app](https://apartment07.up.railway.app) |

## Landing page

[`hub/`](hub) is the landing page that links to all four games: **[randomwebgames.vercel.app](https://randomwebgames.vercel.app)**. It's a static site (no build step). See `hub/HOW_TO_RUN.md` for hosting.
