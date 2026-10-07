# Pixel Peek: project notes

Last updated: 7 October 2026. The code in this folder is **v6 (the party edition)**, the version deployed at https://gamepixelpeek.vercel.app. Read this before changing anything.

## What the game is

**Pixel Peek** is an online picture-guessing party game for 2–8 players, each on their own device (laptop or phone).

- **Concept:** a hidden picture starts unrecognisable (pixelated, zoomed in, covered in tiles, and so on) and slowly comes into focus. Everyone races to type its name. The sooner you get it, the more points you score.
- **Genre:** quick multiplayer quiz / party game. It started as a game for the user and their best friend ("duo"), then grew to friend groups.
- **Hosting:** a static website (no server of its own) hosted on **Vercel** at https://gamepixelpeek.vercel.app. Players connect browser-to-browser with **PeerJS (WebRTC)**.

### How to play

1. One person picks a name and avatar, clicks **Create room** and shares the 4-letter code or invite link.
2. Up to 7 friends join with the code (**Join**). **Practice solo** also works.
3. The host picks picture packs (or a preset), rounds, seconds per picture and reveal style, then starts.
4. Each round, type guesses in the box and press Enter or **Guess**. Wrong guesses cost nothing; keep typing. **Skip** gives up on a picture.
5. After the last round, a podium shows the top 3 and every picture from the match.

### Scoring (since v4)

- **Everyone** who guesses the picture scores, not just the first person.
- Points depend on the timer when you guess: 100 at the start, dropping to 10 at the end.
- A round ends when everyone has guessed or skipped, or when time runs out.
- **Custom pics:** you can't guess your own. If nobody gets it, the owner gets 30 points.

### Controls

Keyboard: type a guess and press Enter. Mouse or touch for everything else. There's a ⛶ full-screen button and a sound toggle in the top bar.

## Tech overview

- `index.html`: the whole game (HTML, inline CSS and JS, plus the pack index). It's big (about 280 KB).
- `net.js`: a small room API over PeerJS. The host is the source of truth and guests mirror its state. It handles kick/ban, a guest limit, "bye" messages and reconnects. The room ID prefix is `pixelpeek-v4-`.
- `peerjs.min.js`: the bundled PeerJS library (third-party).
- `party.css`, `polish.css`, `improvements.css`: style layers added over versions.
- `packs/*.json`: 31 picture packs, lazy-loaded when needed. Each item is `{t: title, a: [aliases], s: svg string, b: background hint}`.
- `credits.html`, `asset-credits.json`, `new-picture-credits.json`, `licenses/`: attribution for every picture source. Noto Emoji (Apache 2.0), Simple Icons, OpenMoji, Tabler, Game-icons, MDI and others. The Indian Food art was drawn for the game (CC0).
- `README-previous.md`, `credits-previous.html`: leftovers from v3, kept for reference.
- `serve.cjs`: a tiny local web server, needed because the packs load with `fetch`.
- Browser storage keys: `pp-name`, `pp-av`, `pp-mute`, `pp-pics` (your custom pics).

## Done and working (v6)

- **Rooms of 2–8 players** (`MAX_PLAYERS=8`) with 4-letter codes and an invite link (`?room=CODE`).
- **Lobby.**
  - 8 seats with per-player colours, join/leave pop-ups and unique names ("Player 2").
  - Pack picker grouped into Logos, Gaming, Characters, Food, Everyday, World & nature, each group with "Select all / Clear".
  - Presets: Quick break, Party mix, Movie night, Gamer night, Logo expert, Desi special.
  - The page doesn't jump to the top when you click (a v3 fix).
- **Five reveal styles:** Pixels, Zoom, Tiles, Spotlight (a wandering beam that slowly widens) and Shuffle (scrambled, rotated pieces swap back into place). "Mixed" picks one per round.
- **2,480 pictures in 31 packs** (full list in `README.md`), including:
  - Emoji Riddles: Movies, Bollywood, TV & Anime, Video Games
  - an original Indian Food pack (35 dishes)
  - Noto emoji art for most packs
  - flags and country shapes
  - aliases for short forms ("ps5", "insta", "lotr", "ddlj", "golgappa")
- **Custom pics:** paste (Ctrl+V) or drop images, type the answer and aliases, and they sync to the other players in chunks.
- **Live leaderboard** with "✓ got it +85", "tried 'pizza'" and streaks, solved count, "X got it!" pop-ups, emoji reactions, and an end-of-round list of who scored.
- **Results:** a podium for the top 3 and every picture of the match with who got it.
- **Host tools:** kick a player (✕, tap twice) from the lobby or leaderboard; kicked players can't rejoin. Leave-match button (tap twice). If the host leaves, everyone sees "The host closed the room".
- **Connection handling:** heartbeat every 2 s. A closed tab says goodbye and leaves within about 1 s. A frozen or offline player is dropped after about 9–10 s and can rejoin with the code. Joining mid-match drops you into the current round.
- **No lockout after a wrong guess** (`LOCK_MS=0`). The user asked for "guess time 0" and it was read as removing the 3-second lockout. See open questions.
- **Fits one screen:** the picture resizes to the window height, plus a full-screen button.
- **Arcade look:** dark night-violet "cabinet", amber/teal player colours, Bungee display font, Figtree body text, JetBrains Mono numbers. Synth sound effects with mute, confetti, animations (pack cards bounce, scores count up, screens slide, green/red flashes).

## Version history (for context)

1. **claude.ai artifact:** 2 players over the claude.ai room API, about 265 then 1,591 pictures in 12 packs, arcade redesign, custom pics.
2. **Website version** (`pixel-peek-website.zip`, 6 Oct morning): PeerJS instead of the claude.ai room API, hosted on Netlify Drop.
3. **User's own upgrade:** the user expanded it with another tool to 66 packs (many template-drawn characters).
4. **v3:** bug fixes (scroll jump, blown-up SVGs with no size, stuck "Wait 3" label, custom-answer wipe), packs merged 66 → 32, long dashes removed from names, animations, even sampling across packs.
5. **v4 / party:** 8 players, new scoring (everyone scores by timer), Spotlight and Shuffle reveals, leaderboard, podium.
6. **v5:** pack quality overhaul. Removed about 1,100 "elementary" template pictures and replaced them with Noto art. Hand-drew 35 Indian dishes. Added emoji riddles and movie/TV/music logos. 2,480 pictures, 31 packs.
7. **v6** (this code): host kick, no wrong-guess lockout, fast disconnect detection, join fixes, fit-to-screen, full screen.

## Planned or discussed, not built

Ideas Claude suggested on 6 Oct. The user chose not to build most of them:

- Power-ups from streaks (Blur, Freeze, Peek, Steal, Shield) and bets before each round.
- New modes: Sabotage, Speed Run, Sudden Death, Split Vision, Co-op Challenge. **The user explicitly said "I don't want new modes"**, so don't add them unless asked.
- An "opponent is typing…" indicator, a "so close!" nudge for near-miss guesses, photo-finish moments.
- Original mascot characters and a game-show host character with reactions; unlockable cosmetics.
- Saved and named custom packs with export/import; difficulty tiers; match history and rivalry stats; a daily challenge.
- Spectator mode and lobby chat.

## Known bugs and limitations

- **No relay (TURN) server.** Some strict networks, such as college Wi-Fi or some mobile data, can block the browser-to-browser connection, leaving people stuck on "Joining room…". Workaround: a phone hotspot. A real fix is adding a TURN server to the PeerJS config.
- **The host's device runs the match.** If the host leaves, the match ends for everyone. The host should have the steadiest connection.
- **Multiplayer has only been tested with a stand-in.** Claude's tests used a mock PeerJS link between browser tabs, because the real PeerJS service wasn't reachable from the test machine. Real-world use by the user is the actual test.
- **Famous landmarks are simpler drawings.** No detailed open-licence versions exist.
- **Copyrighted characters can't be included** (Mario, Pikachu, Steve and so on). Use the custom pics feature for those.
- **Opening `index.html` directly from disk doesn't load the packs.** Use `serve.cjs` or any web server.

## Decisions and why

- **Static site plus PeerJS:** free hosting by drag-and-drop, with no server to maintain.
- **Host is the source of truth:** simple and good enough among friends. A dishonest host could cheat, which is acceptable for this game.
- **Only open-licence or self-made art,** with credits kept in `credits.html` and `licenses/`.
- **Noto emoji art over plain icons** for detail. The user complained the earlier pictures looked "elementary".
- **Packs merged into fewer, clearer packs** with no long dashes in names (user request).
- **Everyone scores, based on the timer,** so one fast player can't take every point (user request).
- **No wrong-guess lockout** (user request: "make the guess time 0").

## Ideas and requests not in the code yet

- Open question: if "guess time 0" actually meant the round timer or the 3-2-1 countdown, the user hasn't said so. Ask before changing it.
- The user said "we are done with this game now" after v6 (6 Oct, 23:06), then moved on to Liar's Call.
