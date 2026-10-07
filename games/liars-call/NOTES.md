# Liar's Call: project notes

Last updated: 7 October 2026. Read this before changing anything.

## What the game is

**Liar's Call** is a desi cartoon bluffing card game for 2–6 players, against bots or with friends online. It's our own version of the "Liar's Table" (Liar's Deck) mode from the game *Liar's Bar*. The rules idea is shared, but the name, characters, art and penalty theme are all original. The setting is the back-room taash table at a big fat Indian wedding, with uncles and aunties as the players.

- **Genre:** bluffing / social deduction card game.
- **Players:** 2–6. Bots fill empty seats.
- **Tagline:** "Jhooth bolo. Pakde mat jao. Golgappa khao. 🌶️"
- **Hosting:** a static site on Netlify Drop, like Pixel Peek. Online play goes browser-to-browser over PeerJS.

### Rules

1. Each round, every living player gets **5 cards**. A **table card** (King "Raja", Queen "Rani" or Ace "Ikka", never a Joker) is announced. Cards matching it, and **Jokers (wild)**, are truths; everything else is a lie.
2. **Deck size:**
   - 2–4 players alive: 20 cards (6 K, 6 Q, 6 A, 2 Jokers), 8 truths per round.
   - 5–6 players alive: 30 cards (9 K, 9 Q, 9 A, 3 Jokers), 12 truths per round.
   - The deck is picked fresh each round from the players still alive.
3. On your turn, either **play 1–3 cards face down** and claim they're all the table card, or **call "LIAR!"** on the previous player's play. You can't call on the first turn of a round.
4. Only the **latest** play can be called.
   - Any lie in it: the person who played it loses.
   - All truths: the caller loses.
5. **The loser eats a golgappa (Mirchi roulette).** Everyone has a plate of 6 golgappas, and **2 of them are spicy**. Their positions are secret and fixed for the whole game. Eat a spicy one and you breathe fire and you're out.
   - Odds by golgappa: 1st 2/6, 2nd 2/5, 3rd 2/4, 4th 2/3, 5th certain.
   - The user changed this from 1 spicy to 2 to make games shorter.
6. Every LIAR call ends the round. A caught liar starts the next round. If the caller was wrong, or the starter is out, the next living player starts.
7. **Edge cases:**
   - A player with no cards left is skipped.
   - If only one player still holds cards, they must call.
   - If the turn timer runs out: auto-play 1 random card, or auto-call if calling is forced.
8. Last player standing wins.

### Controls

- Tap or click cards to select them (or press keys **1–5**), then **PLAY** (Enter).
- **LIAR!** button (key **L**).
- Top bar:
  - 🥁 music
  - 🔊 sound effects
  - 📜 round log
  - ? how to play
  - ⛶ full screen
  - ☰ pause
- Emoji and 💬 taunt buttons at the bottom.
- Fast-forward (⏩) appears once you're out.

## Tech overview

The deployed site is plain HTML/CSS/JS with no build step. Files, in load order:

| File | What it does |
| --- | --- |
| `index.html` | All screens: home, online, bot setup, lobby, how to play, table, game over, pause |
| `css/fonts.css`, `fonts/*.woff2` | Baloo 2 (body) and Yatra One (display), stored locally |
| `css/game.css` | All styling: character rig, table, themes, responsive portrait layout |
| `js/peerjs.min.js` | PeerJS library (third-party) |
| `js/net.js` | `LC_NET`: one host plus up to 5 guests over PeerJS. Room codes, heartbeat, kick |
| `js/rules.js` | `LC`: the pure rules engine (no DOM, no timers). Seeded RNG; `act()` returns events; `view(seat)` hides other hands |
| `js/bots.js` | `LCBots`: card-counting bots with three personalities (Careful, Reckless, Sneaky) and Easy/Normal/Hard levels |
| `js/art.js` | `LCArt`: all art as SVG strings (6 characters on a shared face rig, outfits, cards, 3D golgappas, katori, backdrops for 4 themes, flames) |
| `js/audio.js` | `LCAudio`: Web Audio synth for dhol music and sound effects. Character voices are disabled (`speak` is a no-op) |
| `js/game.js` | Table client, host driver (bots + online host), guest driver, home, lobby, stats, outfits, install |
| `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` | Install-as-app support (PWA) |
| `tests/test-rules.js` | 69 rules-engine checks, including 10,000 random games (`node tests/test-rules.js`) |

Browser storage keys: `lc-settings`, `lc-stats`, `lc-token` (rejoin token), `lc-sound`.

`window.__LC` is a debug handle used by automated tests (`speedUp`, `createRoom`, `addBot`, …).

**About this folder.** The original build was a single 489 KB `index.html` with everything inlined. It was assembled by a `build.py` from separate source files that weren't kept. For this repo, that final file was split back into the files above. Each JS module was cut at its original boundary with no code changes, and the base64 fonts were saved as `.woff2` files. A full bot game was played on the split version with no errors.

The deployed site also had `manifest.webmanifest`, `sw.js` and icons, which were lost, so they were **recreated**. The icon is drawn from the game's own art: Sharma Uncle in his shaadi safa holding a golgappa. `sw.js` uses network-first caching. Bump `VERSION` in it when you deploy changes.

## Done and working

- **Full rules engine** with every edge case from the design doc, including the 2-of-6 spicy golgappas and the 20/30-card decks.
- **Bots:**
  - They count cards: a claim with more truths than can exist is always called.
  - They judge risk from their own and their target's remaining golgappas, and add personality noise.
  - Each character has a **tell** that shows about 60% of the time when bluffing, and sometimes when telling the truth:
    - Sharma twirls his moustache
    - Pinky fixes her dupatta
    - Bunty hides behind his cards
    - Gupta Ji pushes up his glasses
    - Dadi chews faster
    - Rocky flexes
- **The cast:**

  | Character | Look | Bot personality |
  | --- | --- | --- |
  | Sharma Uncle | Big belly, moustache | Careful |
  | Pinky Aunty | Gold jewellery, loud saree | Sneaky |
  | Bunty | Naughty kid with a lollipop | Reckless |
  | Gupta Ji | Glasses, calculator | Careful |
  | Dadi | Walking stick, paan | Sneaky |
  | Rocky Bhaiya | Gym bro | Reckless |

  Each character blinks, breathes, has expressions, iris eyes, shading and per-character details, plus Hinglish lines.
- **Table scene:**
  - 3D-style table with a plate of puffed 3D golgappas and a katori of pani per player, the table card face up, and face-down piles.
  - Animated deal, card flights, "LIAR!" stamp with screen shake, cards flipping with ✓/✗, JHOOTH!/SACH! verdicts.
  - A spotlight eating scene with heartbeat: the golgappa is dipped in pani, then it's "Phew!" or "MIRCHIII!!" with fire.
- **Four table themes**, picked by the host in the lobby or on the bot setup screen:
  - 💐 Shaadi tent
  - 🚚 Highway dhaba
  - 🍜 College canteen (MIT Manipal canteen vibe)
  - 🪔 Diwali terrace
- **Shaadi outfits:** win 2 games as a character to unlock their wedding look. Switch Classic/Shaadi on the home screen. Bots sometimes wear theirs. Friends see your outfit online.
- **Fonts and text polish:** Yatra One for the display text, commentator-style ticker ("Pinky Aunty claims Do Raja"), and buttons that say what they do ("claim Do Raja", "call out Rocky Bhaiya").
- **Home screen:**
  - Character carousel on a lit stage, showing each character's style and tell.
  - Name box, light-bulb marquee logo, and stats (games, wins, win rate, best streak).
  - Play with friends / Play vs bots / How to play.
- **Bot setup:** 2–6 players; bot level Easy/Normal/Hard; turn timer Off/15/30/45 s; theme.
- **Online rooms:**
  - 4-letter code, Copy link and WhatsApp invite buttons; `?room=CODE` opens the join screen.
  - 6-seat lobby where the host adds bots, kicks players, and sets the timer, bot level and theme. No two players can pick the same character.
  - Hands are secret: each player is sent only their own cards.
  - Heartbeat: a dropped player is replaced by a bot after about 9 s and gets the seat back if they return on the same tab.
  - Rematch, or everyone back to the lobby.
- **Spectators:** late joiners watch with hands hidden and get a seat in the next game. A bot steps aside if the room is full.
- **Install as app:** "Install app" button on Android/Chrome, Share → Add to Home Screen instructions on iPhone, opens full screen, works offline. Online rooms still need internet.
- **Extras:**
  - synced emoji and taunts ("Sach bol raha hoon!", "Mirchi ready hai?")
  - round log (📜 or tap the ticker)
  - BOT/OFFLINE labels on nameplates
  - confetti and stats on the game-over screen
  - keyboard shortcuts
  - fast-forward once you're out
- **Sound:** dhol background music and synthesised effects (cards, slam, crunch, heartbeat, fire, splash, your-turn, join).
- **Voices:** the character voice-overs ("Jhooth!", "Mirchiii! Paani!") were **removed at the user's request**. Sound effects stay.

## Planned or discussed, not built

- **Relay (TURN) server** for networks that block direct browser connections. About 20 minutes of work.
- **Host migration:** today, if the host leaves, the game ends for everyone.
- **Rejoin by name** after fully closing the tab (today only the same tab can reclaim a seat). Also a "low graphics" toggle for slow phones.
- **Variants from the design doc:**
  - **Devil card:** one secret card must be played alone; if it's called and revealed, everyone else eats.
  - **Chaos:** a caught lie makes everyone except the liar eat.
  - **Devil's Deal:** one forged card per game.
  - **Fast table.**
- **"Full Table" deal** (5/6/7 cards as players drop out). The user chose the classic 5 each.
- **Suggested but not picked by the user:**
  - Shaadi events: Baraat round, Power cut, Mehendi round
  - Masala powers: Peek, Chai break, Double mirchi
  - Room scoreboard across rematches
  - Shareable moment cards for WhatsApp/Instagram
  - Spectator predictions ("Jhooth or Sach?" votes)
  - Phone vibration
  - First-game tutorial with Dadi
  - Achievements ("Survived 4 golgappas")
  - Daily-challenge bots

## Known bugs and limitations

- **Never tested with real friends over the internet.** All online tests ran browser tabs over a stand-in for PeerJS. Strict college Wi-Fi or mobile data may block connections, leaving people stuck on "Joining room…". Workaround: a phone hotspot.
- **The host can technically cheat.** The host's browser holds every hand, so it can be peeked at with developer tools. Fine among friends; a proper fix needs a real server.
- **Host leaving ends the game** for everyone.
- **iPhones** only start sound after the first tap (normal iOS behaviour).
- **Recreated install files.** `manifest.webmanifest`, `sw.js` and the icons were rebuilt for this repo and may differ slightly from what is currently live on Netlify.
- **Original build tooling is gone:** `build.py`, `test-bots.js`, the separate source files and the mock-PeerJS multi-tab tests. `tests/test-rules.js` was rewritten for the repo.

## Decisions and why

- **Desi wedding cartoon style** (user's choice) to make the game unique: Indian uncles and aunties, "some fat, some kid, some weird".
- **Mirchi roulette** (golgappas with ghost-pepper pani) instead of a revolver, to fit the cartoon family vibe. The user later raised it to **2 spicy per plate** because games weren't ending ("change nothing else").
- **Max 6 players:** the deck grows to 30 cards at 5–6 players, because 6 × 5 = 30 and the classic deck has only 20.
- **Classic 5 cards each** (user's choice) over Claude's "Full Table" proposal.
- **Bots from day one,** so it can be played and tested solo.
- **Pure rules engine plus events:** the same engine runs local bot games and the online host, and the UI just animates the events.
- **Built from CSS 3D, SVG and canvas,** with no game engine, so it loads fast on phones.
- **Static site plus PeerJS,** reusing Pixel Peek's networking approach: free hosting with no server.
- **Original names and art only.** The name, characters and art of *Liar's Bar* belong to its studio (Curve Animation).
- **Voices removed, sound effects kept,** at the user's request. There was a mix-up first: the effects were removed by mistake, then restored.

## Ideas and requests not in the code yet

None outstanding. Everything the user picked (spectators, install as app, outfits, table themes; voices then removed) is built.

The design document is a Claude Doc titled "Liar's Call: Game Design Doc" in the user's claude.ai artifacts, with the full rules, edge cases, bots and variants.
