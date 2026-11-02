# Sound Doodles

A browser party game for 2–8 friends: you get a prompt, you make the sound, your friends try to work it out.
Six modes (Classic, Gartic Sounds, Foley and Ranking start from 2 players; Duo Orchestra and Sound Detective need 4): **Classic** and **Gartic Sounds** (flagship), plus Duo Orchestra, Sound Detective, Five-Second Foley and Blind Ranking.
Six themes: Paper Playground (default), Midnight Studio, Neon Arcade, Sunset Lounge, plus the light and colourful Cloud Nine (sky blue, breezy) and Bubblegum Pop (pink, hearts, sparkle). No accounts needed.

## Run it

Requires Node 22.12+.

```bash
npm install
cp .env.example .env   # optional; defaults work locally
npm run dev            # http://localhost:3000
```

Production build:

```bash
npm run build && npm start
```

## Test it

```bash
npm test                 # 50 unit and socket tests
npx playwright install chromium   # first time only (tests use the Chrome channel)
npm run test:browser     # 18 browser tests: four sessions per mode, simulated microphones
node scripts/shots.mjs   # screenshots of every theme at 390, 768 and 1440 px into shots/
npm run dev              # then open /styleguide (or #/styleguide) to see every component in all six themes
```

## Audio extras

- **Music:** an optional, quiet synthesized loop (Audio settings, off by default). It fades out while anyone performs, records or replays a sound.
- **Announcer lines:** optional and sparse ("Your turn", "Time to guess", "Let's hear what happened"). The three mp3 files are included (generated with ElevenLabs, stock voice).
  To generate them with ElevenLabs (costs credits, run once, then listen and commit the files):
  `ELEVENLABS_API_KEY=... node scripts/generate-announcer.mjs` (a stock voice is picked for you)``. Use a stock or designed voice, never a cloned player voice.
- **Custom faces:** build your own character (8 bodies, 12 colours, 10 eyes, 8 mouths, 15 hats, 7 extras: about 1.5 million looks) with a live preview and a Surprise me button. Everyone in a room looks different. The face gallery is in the dev styleguide (`npm run dev`, then `/styleguide`).
- **Word library:** 1,399 family-friendly one-or-two-word words in 15 packs plus an opt-in 18+ Spicy pack of sounds you can perform (moans, slurps, smooches), packs you can mix,  an own-word mode for Gartic, and Skribbl-style word choices in Classic. See [docs/WORD-LIBRARY.md](docs/WORD-LIBRARY.md).
- **Gartic awards:** the host can enable a friendly awards vote after the reveal (funniest transformation, best sound, most unexpected, most accurate).

## Configuration

| Variable                                       | Purpose                                                                                                                                                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                                         | Server port (default 3000).                                                                                                                                                                                                   |
| `PUBLIC_ORIGIN`                                | Optional. Leave unset on normal hosting: the server accepts requests from its own site and refuses other sites. Set it only behind a proxy that changes the Host header, to your exact public URL (https, no trailing slash). |
| `ROOM_TTL_MINUTES`                             | Maximum room lifetime, 10–120 (default 120).                                                                                                                                                                                  |
| `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Optional TURN relay for live audio on restrictive networks.                                                                                                                                                                   |

## Hosting

The server holds all room state and recordings in memory, so run **one instance** (no horizontal scaling) on a host that supports WebSockets.
`Dockerfile` and `render.yaml` are included for Render; Railway and Fly.io also work with the Dockerfile.
Restarting the server clears every room.

Live audio in Classic and Duo uses WebRTC peer-to-peer. STUN alone fails on some corporate and mobile networks;
add a TURN relay (for example a free-tier TURN service) through the `TURN_*` variables for dependable play.

## Speed

Every button waits for one round trip to the server, so the delay you feel is mostly distance to the host. The header shows a live ping (green under 120 ms, amber
under 300 ms, red above). `node scripts/latency-probe.mjs <url>` measures connect time, transport and a "ready" press from any machine. Measured on the live Render
site from here: about 250 ms per press; the game itself answers in about 1 ms locally.

- Connections go straight to WebSocket (no slow HTTP polling first), and flag-style controls (Ready, mode and settings, watching) update instantly on your screen.
- **Lite effects** (Sound & motion) turns off blurs and moving backgrounds; older touch phones start in it automatically.
- On Render, choose the **region closest to your players** (for India, Singapore). A service's region cannot be changed after it is created, so make a new service to move it.
  The free plan also sleeps when idle, which adds about a minute to the first visit.

## Privacy

Recordings are kept in server memory only. Unsubmitted uploads are deleted after 2 minutes, submitted clips are deleted
with the room (at most 2 hours, or 10 minutes after everyone leaves). Clips are served only to players who are allowed to hear them.
Classic rounds are never recorded.

More detail: [UI overhaul, tokens and changelog](docs/UI-OVERHAUL.md), [architecture](docs/ARCHITECTURE.md), [test report](docs/TEST-REPORT.md), [audio assets](public/audio/MANIFEST.md).
