# Apartment 07 · Lost at Home

A browser-based cooperative escape mystery for 1–4 players. Phaser renders the apartment; a Colyseus server owns movement, locks, inventory and puzzle progress. No accounts or external AI calls are needed to play.

## Play online

**[Play Apartment 07](https://apartment07.up.railway.app)** — no installation or account required.

1. Click to come inside, customize your explorer and select **New apartment**.
2. Create a room and share its invitation link or six-letter code with up to three friends.
3. Friends open the same site and use **Join friends**, or follow the invite link.
4. The host selects **Begin the story**. Solve the apartment together and have everyone walk through the opened entrance. Solo works too.

The game runs on Railway, so the creator's laptop does not need to stay on. Sessions are held in server memory; a server restart or redeployment ends active games.

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

The live deployment serves the webpage, artwork, room API and WebSockets from one Railway service. Its deployment source is [adityajain13231324-code/apartment-07](https://github.com/adityajain13231324-code/apartment-07), on the main branch. The public domain targets port 8080, matching Railway's injected PORT. No VITE_SERVER_URL or CLIENT_ORIGIN setting is needed for this single-origin deployment. Keep one server replica because sessions live in memory.

This Web-Games folder remains the game catalog/source snapshot; changes here do not automatically update the live deployment. Publish runtime changes through the deployment repository. The deployed game was verified on 7 October 2026: HTTPS page and artwork, four-player joining, shared items, reconnecting, and a complete four-player escape through all seven doors to the reunion. The 30–40-minute pacing target still needs first-time human playtests.

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
