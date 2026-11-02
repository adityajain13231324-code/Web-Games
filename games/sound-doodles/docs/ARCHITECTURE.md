# Architecture

- `server/index.js` Express + Socket.IO. Authenticated REST endpoints for recording upload/download (`/api/...`), `/api/ice` for STUN/TURN config,
  rate limits, origin checks, room cleanup loop (200 ms tick).
- `server/game.js` `Room` class: the server-authoritative state machine for all six modes (phases, deadlines, scoring, routing, voting).
  `Room.viewFor(playerId)` builds the per-player view, so secret prompts and hidden chain history never reach unauthorized clients.
- `server/prompts.js` 165 prompts (id, phrase, category, difficulty, aliases, components, hints, modes) and deterministic matching.
- `shared/modes.js` mode metadata shared by client and server.
- `src/main.jsx` React client (screens per phase). `src/components.jsx` avatar, recorder, audio player, Foley animations.
  `src/audio.js` microphone, recording, level meter, WebRTC mesh and effect cues.
- `src/App.jsx` shell, `src/screens/` one file per screen, `src/ui/` the UI kit, `src/theme.js` the theme engine.
  `src/styles/` holds tokens (one `[data-theme]` block per theme), stage backdrops, kit and screen styles. See `docs/UI-OVERHAUL.md`.

## Audio topology

Classic and Duo performers stream live to guessers over a WebRTC mesh; the server only relays signaling. Gartic Sounds, Foley,
Detective and Ranking upload short clips (max 10 s, Foley 5.5 s) that are fetched with a per-player token.

## Gartic routing

`routing(ids, rounds)` shuffles the owners once and rotates by one position per round, so every chain gets one new contributor per round,
nobody is handed their own previous contribution, and nobody repeats on a chain until everyone has contributed.
