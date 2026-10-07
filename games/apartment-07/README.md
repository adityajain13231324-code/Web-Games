# Apartment 07 · Lost at Home

A browser-based cooperative escape mystery for 1–4 players. Phaser renders the apartment; a Colyseus server owns movement, locks, inventory and puzzle progress. No accounts or external AI calls are needed to play.

## Run locally

Requires Node 22+ and pnpm 11. From this directory:

```sh
pnpm install --ignore-scripts
node scripts/dev.mjs
```

Open http://127.0.0.1:5173. Create an apartment, customize your explorer, and share its six-letter code. Solo uses the same server. On Windows, the included launcher uses the current Node executable and does not need npm on PATH.

Controls: WASD/arrows move, hold Shift to sprint, E inspects the closest reachable object, Tab opens the shared bag, J opens the notebook, Q pings your location, Escape closes a panel. All puzzle panels work with keyboard controls as well as mouse input. The tracing-sheet puzzle supports dragging or its accessible alignment button.

## Checks

```sh
pnpm check
pnpm test
pnpm test:network # requires the server running on port 2567
pnpm build
```

Engine tests cover both puzzle-branch orders with 1, 2 and 4 players, idempotent effects, wrong answers, prerequisites, collision/visibility, reachable interactions, hints and disconnect handling. Network tests use real WebSocket clients.

## Hosting

The frontend and server are deployed separately. Set `VITE_SERVER_URL` to the server's public HTTPS URL before building the frontend; publish `dist/` on a static host such as Vercel. The included Dockerfile builds the persistent Node/WebSocket server. Set `CLIENT_ORIGIN` to the frontend origin(s), and expose the server through HTTPS/WebSocket-capable hosting. Localhost invitation links only work on the same computer; public play with friends requires hosting both components. There is no paid hosting automatically provisioned by this project.

Private rooms have six-letter codes, a four-player capacity, two-minute disconnect reservations and a 20-minute empty-room lifetime. Server restarts clear sessions. Play one room across browsers on a single server instance; scaling to multiple instances needs shared room discovery/presence and is outside v1.

## Project layout

- `shared/`: public map geometry, avatar configuration, network interfaces, collision and sight.
- `server/`: private clue/answer content, authoritative rules and room lifecycle.
- `src/`: Phaser scene, layered character art, HTML interaction panels and sound.
- `public/art/`: title illustration, copied into the project for portable builds.
- `tests/`: rules, map and multiplayer integration checks.

Additional maps can reuse the room, interactable, puzzle and avatar interfaces. Apartment geometry and its private puzzle content are separate from rendering. A second map will need its own content and action handlers; there is intentionally no map editor or automatic puzzle generator in v1.

## Art and sound

The title illustration was generated with the built-in image-generation tool, then visually inspected and saved to `public/art/apartment-cover.png`. Prompt: detailed hand-painted apartment hallway on a rainy late afternoon, familiar child's bedroom through an ajar door, warm amber lamp, cool blue rain-streaked window light, subtle emergency LED; cinematic grounded domestic mystery; dark left space for menu; no people, horror, lettering or logos.

`public/art/furniture-atlas.png` was generated with the same tool and refined once: transparent 4×3 atlas, ordered bed / sofa / desk / bookshelf; plant / refrigerator / sink counter / washing machine; service console / suitcase / coffee table / sideboard. Consistent angled top-down view, realistic hand-painted domestic materials, muted warm colours, no labels or grid lines. Runtime frames account for slight generated grid drift and trim transparent margins. Floors, wall details and customizable avatar layers are original procedural canvas illustrations. All music, rain, thunder and feedback sounds are synthesized live with the Web Audio API in `src/audio.ts` — there are no audio files. Six tracks (Rain on the Window, Little Explorer, Quiet Hallway, Midnight Kitchen, Backup Power, Home Again) are built from chord progressions plus seeded melody generation; pick one from the home screen or the ♫ button in game.

Movement is predicted on the client for instant controls; the server validates every reported position (sprint-speed limit, no crossing walls or closed doors) and snaps the player back if a report is impossible. Fonts use Google Fonts with local serif/sans-serif fallbacks.

## Known scope

Desktop browser only. No combat, mobile controls, built-in voice chat, persistent saves, other maps, or procedural puzzle variations. The 30–40-minute duration is a design target and needs first-time human playtests; automated walkthrough speed does not establish human puzzle-solving time.
