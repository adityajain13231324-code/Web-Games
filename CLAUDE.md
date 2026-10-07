# Notes for Claude Code

- This repo holds several independent browser games, one per folder in `games/`. Before working on a game, read its `NOTES.md` (history, decisions, known issues) and `HOW_TO_RUN.md`.
- Keep each game self-contained. Don't share code between game folders.
- `pixel-peek` and `liars-call` are static sites deployed by dragging the folder onto Netlify Drop: no build step, no server, no paid services. Keep them that way.
- `apartment-07` runs with `node scripts/dev.mjs` (Vite on :5173, game server on :2567, both hot-reload). Run `pnpm check` and `pnpm test` after changes.
- Use only open-licensed or self-made art and sound. No copyrighted characters or logos beyond what the credits already cover.
- After changing a game, update its `NOTES.md` (done / planned / known bugs) so the notes stay the source of truth.
