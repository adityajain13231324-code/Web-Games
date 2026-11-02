# Sound Doodles: notes

- Browser party game for 2–8 friends: get a prompt, make the sound with your voice, friends guess. Six modes (Classic, Gartic Sounds, Duo Orchestra, Sound Detective, Five-Second Foley, Blind Ranking), six themes. See `README.md` for features, tests and configuration.
- Live at https://sound-doodles.onrender.com (Render, Docker, one instance; the free plan sleeps when idle, so the first visit can take about a minute).
- This folder is a copy of the standalone `SOUND-DOODLES` repo's `main` branch (copied 3 November 2026, without `node_modules`, `dist` or screenshots). Port changes in both.
- Not a static site: it needs Node 22.12+ and WebSockets (`npm install`, `npm run dev`). The hub only links to it; Vercel does not run it.
- Docs for the game itself are in `docs/` (architecture, test report, UI overhaul, word library).
