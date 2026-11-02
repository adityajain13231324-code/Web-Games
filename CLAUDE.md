# Notes for Claude Code

- This repo holds several independent browser games, one per folder in `games/`. Before working on a game, read its `NOTES.md` (history, decisions, known issues) and `HOW_TO_RUN.md`.
- Keep each game self-contained. Don't share code between game folders.
- `pixel-peek` and `liars-call` are static sites hosted on Vercel (https://gamepixelpeek.vercel.app and https://liarscall.vercel.app): no build step, no server, no paid services. Keep them that way.
- `blackjack21` is also a static Vercel site (https://blackjack21-cardgame.vercel.app). Its standalone home is the `blackjack21` repo; `games/blackjack21` is a copy, so port changes in both.
- `ultimate-tic-tac-toe` is a static Vercel site too (Root Directory `games/ultimate-tic-tac-toe`, no build step; the hub expects https://bettertictactoe.vercel.app). Its tests: `node tests/test-rules.js`, `test-ai.js`, `test-tutorial.js`, and `ui-smoke.js` (needs Playwright).
- `apartment-07` runs with domain `apartment07.up.railway.app`
- `sound-doodles` is a Vite + React client with a Node/Socket.IO server, hosted on Render (https://sound-doodles.onrender.com, one instance, free plan sleeps when idle). Its standalone home is the `SOUND-DOODLES` repo; `games/sound-doodles` is a copy of its `main`, so port changes in both.
- `hub/` is the static landing page for all games (https://randomwebgames.vercel.app, Vercel with Root Directory `hub`; a copy also deploys to GitHub Pages). Keep the game cards, player counts and gameplay clips in sync with each game's `NOTES.md` (see `hub/NOTES.md`).
- Use only open-licensed or self-made art and sound. No copyrighted characters or logos beyond what the credits already cover.
- After changing a game, update its `NOTES.md` (done / planned / known bugs) so the notes stay the source of truth.
