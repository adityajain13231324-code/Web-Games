# Blackjack 21: project notes and goal planner

Last updated: 8 October 2026 (sound, characters, matching bets and the home redesign are in; online rooms are next). Read this before changing anything. It is the plan, the rules and the status in one place; keep the checklists current as work lands.

## What the game is

**Blackjack 21** is a classic blackjack card game for 1–6 players plus a dealer, played around a green-felt table, with chips you bet and see. Bots fill empty seats so it is playable alone. It is a sister game to *Liar's Call* (same repo family, same "friends + bots" feel) but **not Indian-themed**: a classic card-room look and sound.

- **Genre:** casino card game, party-friendly. Play money only, no real money.
- **Players:** 1–6 humans or bots, one dealer.
- **Tagline:** "Pull up a chair. Beat the dealer. Stack the chips."
- **Hosting:** static site on **Vercel** from this repo (`blackjack21`), like Liar's Call and Pixel Peek: no build step, no server, no paid services. Online play (not built yet) goes browser-to-browser over PeerJS.
- **In the hub:** copied into the `Web-Games` repo as `games/blackjack21` (9 Oct 2026) and added to the hub as channel 4. The standalone `blackjack21` repo stays the deployed home (https://blackjack21-cardgame.vercel.app); keep both copies in sync.

## Goals

1. A smooth, good-looking, **classic** blackjack table that feels like sitting at a real one. ✔
2. **Chips you can see:** build your bet from chip stacks, watch it sit in your betting circle, see the dealer pay or collect. ✔
3. **Up to 6 players + dealer**, with **bots with personalities** (distinct styles and voices). ✔
4. **Its own music:** 10 original tracks that fit the casino theme, plus table sound effects. ✔
5. **Play with friends online** (room code, same approach as Liar's Call) and **solo against bots**. Solo ✔, online not built yet.
6. Works well on a phone in portrait, installable as an app. ✔ (install and offline are built; not yet tried on a real phone)
7. Follows the repo rules: original or open-licensed art and sound only, no copyrighted characters or logos. ✔

**Non-goals for now:** real money, accounts, a backend database, bluff/power-card variants (parked, see Ideas), native apps.

## The rules

Everything below is the default; the table setup screen changes the marked options.

1. **Shoe:** 6 standard 52-card decks (312 cards), shuffled. A cut card sits at 75%: when it comes out, the shoe is reshuffled before the next round. *Option:* 1, 2, 4, 6 or 8 decks.
2. **Chips:** you start with **1000**. Chips come in **10 / 50 / 100 / 500 / 1000**. Table limits **$10 to $1,000** per bet (option: $500 / $1,000 / $5,000). Bets are multiples of 10, which keeps 3:2 and insurance whole numbers (a 5 chip shows up in stacks, e.g. 3:2 on a 10 bet pays 15).
3. **Each round:**
   1. **Betting round** (see "Matching bets" below).
   2. **Deal:** one card to each player, dealer up card, second card to each player, dealer hole card face down.
   3. **Insurance** (dealer shows an Ace): optional side bet of half your bet, pays **2:1** if the dealer has blackjack.
   4. **Dealer peek** (dealer shows an Ace or a ten): if the dealer has blackjack, the round ends at once.
   5. **Players act, seat by seat, left to right** (timer 20 s, a timeout stands).
   6. **Dealer plays:** reveals the hole card, draws to 16 and **stands on all 17s** (option in the engine: hits soft 17). If every player busted or surrendered or has a natural, the dealer just reveals.
   7. **Settle:** chips are paid or collected; the shoe count updates; next round.
4. **Card values:** 2–10 face value, J/Q/K = 10, Ace = 1 or 11 (whichever is better without busting).
5. **Your options** (the classic six): **Hit**, **Stand**, **Double down** (two cards only; double the bet, get exactly one card), **Split** (two cards of equal value, K+Q counts; up to 4 hands; doubling after a split is allowed), **Surrender**, **Insurance**.
   - **Split aces** get one card each, and 21 on a split hand is not a blackjack (pays 1:1).
   - **Surrender (late):** on your first two cards (not after a hit or a split, and only after the dealer has checked for blackjack) you may give up the hand and get **half your bet back**. Option, on by default.
   - Doubling, splitting and insurance need enough chips; otherwise the button is greyed out.
6. **Payouts:** win **1:1**, **blackjack 3:2**, push returns the bet, bust loses the bet. Dealer blackjack vs your blackjack is a push.
7. **Out of chips:** a broke player may **rebuy 500 once** (option in the engine); after that they are out and spectate.
8. **How a game ends:** a fixed number of rounds (default **15**, option; or endless). **Most chips after the last round wins.** The standings screen shows chips plus your hands won, blackjacks, biggest win and peak stack.

### Matching bets (the user's rule, 8 Oct 2026)

"The highest bet decides the limit": if someone bets 500, everyone else has to bet 500 or fold out, and a player with only 300 must go all in. This is a poker-style betting round, and it is the default (switch to **Free bets** in the table setup for plain blackjack betting).

- Betting goes **one seat at a time, clockwise**. The **opener rotates** every round.
- The **opener** bets any amount from $10 up to the table maximum (limited by their stack).
- Every seat after must do one of:
  - **Call:** bet exactly the table bet (the highest bet so far);
  - **Raise:** bet more (capped by the table maximum and their stack, at most **2 raises per round**; the opening bet is not a raise). A raise sends everyone who already bet round again to match it or fold;
  - **All in:** if they cannot cover the table bet, they may only bet everything they have (rounded down to a multiple of 10) or fold;
  - **Fold:** sit this round out. No chips are lost.
- Because blackjack is played against the dealer, nobody wins pots from each other. A short-stack all-in simply plays a smaller bet; there are no side pots.
- Everybody who is dealt in ends on the same bet, except short stacks who went all in.
- Bots decide by style (see Bots): timid bots fold to big bets, gamblers call and raise, counters raise when the count is high.
- Timeout while betting = fold.

## Mechanics design (what I added on top of the rules)

- **Classic betting, and what "all in" means.** There is no "all in" action in blackjack (it is a poker term). At a real table it just means pushing your whole stack into the betting circle, and the **table maximum** caps that. In free betting the bar has **Max bet**, which becomes **All in** when your whole stack fits under the table maximum. In matching-bets mode the all-in is the short-stack choice described above.
- **Visible betting.** Each seat has a gold **betting circle** printed on the felt. Tap a chip to add it (it flies to the circle), **Clear**, **Rebet**, **Double bet**, **Max bet / All in**. Everyone sees everyone's bet and a **Table bet** pill, and each seat shows a tag: Opens, Call, Raise, All in, Fold, Betting.
- **Chip stacks.** Casino colours: white 10, red 50, black 100, purple 500, gold 1K (blue 5). Big stacks collapse into a count label. After the dealer settles, losing chips fly to the dealer and winning chips fly from the dealer to the circle and then to your stack.
- **Turn timer** bar above the controls with a soft tick in the last 5 s.
- **Seats and turns.** 6 seats on an arc of the table, dealer at the top. The active seat glows. Split hands show side by side with their own bet.
- **Hand total badges** (hard/soft shown, e.g. "soft 17"), BUST, BLACKJACK, WIN, LOSE, PUSH, SURRENDER with the amount.
- **Hint mode (off by default):** "Basic strategy: Hit". Bots use the same strategy table, so the hint and the bots never disagree.
- **Shoe icon** shows how much of the shoe has been dealt. The running count is kept by the engine for the bots but not shown to humans.
- **Round log** and a **game-over stats row**; **stats** (games, wins, blackjacks, best stack) saved in the browser.
- **Game speed** (Normal / Fast), **four-colour deck** option for colour-blind players, keyboard shortcuts (H, S, D, P, R, C, A, F, Y, N, Enter).
- **Presets:** Quick table, Classic night, High roller, Practice.

## The people

**The dealer** has a portrait that changes mood and **talks** in a speech bubble: "Place your bets, please", "No more bets", "Dealer checks for blackjack", "Dealer has 18", "Dealer busts with 24". Mood: smug when the table loses, worried when it wins, sad on a bust, happy on a blackjack.

**You** pick one of 6 avatars on the home screen.

**The regulars (bots).** Every one is drawn in code (`js/art.js`, one face rig with many looks), has five moods, original lines per situation (hello, win, lose, bust, blackjack, big bet, fold, double, split, all in, raise, surrender; `js/bots.js`), and a style:

| Bot | Style | How they bet and play |
| --- | --- | --- |
| Lucky Lou | Gambler | Chases losses with bigger bets, sometimes bets 25% of his stack, hits "on a hunch", never surrenders; calls and raises big |
| Madame Rouge | Steady | Bets ~5% of her stack, plays it by the book |
| Professor Pip | Card counter | Counts cards (Hi-Lo), raises his bet when the shoe is rich in tens and aces, takes insurance when the count is high |
| Big Tony | Gambler | High roller, always doubles on 10 and 11 |
| Penny | Cautious | Minimum bets, stands too early on 15–16, avoids splitting, folds to big bets |
| Silent Sam | Steady | Same steady play, says almost nothing |
| Duchess Dot | Card counter | Old money, sharp memory |
| Ace McGraw | Cautious | Lucky charm, nerves of jelly |

Bots look only at what a seat can see. They **play basic strategy** (the best classic play, with late surrender) plus quirks. **Levels:** Easy (mistakes ~16% of the time), Normal (~5%), Hard (none). Verified by simulation: basic strategy at flat bets loses about 0.4–0.6% of money wagered over hundreds of thousands of hands, which matches the known blackjack house edge. In matching-bets mode bots fold when the table bet is more than a style-dependent share of their stack (cautious ~12%, steady ~30%, counter ~35%, gambler ~70%, with noise), call otherwise, and sometimes raise.

Speech is limited (probability and a cooldown) so the table does not babble.

## Music and sound

Everything is **synthesised live with WebAudio** (`js/audio.js`), like Liar's Call: no audio files, no licences, works offline. The music is **composed on the fly from rule sets** (chords per bar, bass pattern, comping rhythm, drums, and a melody generated once per track and repeated with an answering phrase), so each track is a proper loop. There are eight instruments (upright bass, Rhodes, piano, muted trumpet, vibraphone, brass, strings pad, plucked guitar, synth) and 14 drum sounds, with room reverb and an echo on the lead.

| # | Track | Where it plays | Feel |
| --- | --- | --- | --- |
| 1 | **Green Felt** | Home screen, setup | Warm swing, walking bass, brushed ride, Rhodes (96 BPM, F) |
| 2 | **Smoky Back Room** | Calm rounds | Slow noir lounge, muted trumpet over strings (72 BPM, D minor) |
| 3 | **Shuffle & Deal** | Action rounds | Upbeat swing, piano comping and runs (132 BPM, B♭) |
| 4 | **High Roller** | A bet that is half your stack or more | Big-band brass stabs, trumpet lead (120 BPM, C) |
| 5 | **Chip Stack Bossa** | Calm and action rounds | Bossa nova, plucked guitar, rim clave (110 BPM, A minor) |
| 6 | **Midnight Vegas** | Calm and action rounds | Rat-pack lounge, vibraphone, strings (100 BPM, E♭) |
| 7 | **Dealer Stands on 17** | The dealer plays against your strong hand (18 to 21) | Tense: drone, ticking clock, heartbeat, riser (90 BPM, E minor) |
| 8 | **All In** | The last 3 rounds | Driving synth bass and arpeggios, four on the floor (140 BPM, A minor) |
| 9 | **Lucky Streak** | When you are on a winning streak | Bright ragtime piano (150 BPM, G) |
| 10 | **Last Hand** | The final round and the standings | Slow waltz, piano and strings (66 BPM, G minor) |

Tracks crossfade over 1.2 s. In **Auto** mode the game picks the track; in the Sound menu you can lock any one of the ten. **Effects:** card deal, flip, shuffle, chip clink and stack, chips paid and taken, button click, turn ping, timer tick, fold, win, blackjack fanfare, lose, bust, push, surrender, dealer blackjack. Music and effects have separate volume sliders and on/off, saved in the browser; the speaker button on the table mutes everything. Sound starts after the first tap (browser rule) and pauses when the tab is hidden.

How it was checked (no ears available): the composer is tested in Node (`tests/test-audio.js`: ranges, keys, repeatability, strict fake audio context), and every track and effect was rendered offline in Chromium and measured: no NaN, no silence, no clipping, similar loudness across tracks. **Someone still has to listen to it** and say what to change (tempo, levels, instruments).

## Look and feel

- **Table:** drawn entirely in CSS with a slight 3D tilt: a wooden outer edge with visible thickness, a padded leather rail with brass stitching, and green felt with a fine noise texture, soft lamp light and a vignette. Gold lettering on the felt ("Blackjack pays 3 to 2", "Insurance pays 2 to 1", "Dealer stands on all 17s"), printed gold betting circles.
- **Cards:** the classic 52-card deck as SVG (`js/art.js`): soft sheen and shadow, standard pip layouts, crowns and plumes on the court cards, a navy and gold back. Hands fan out slightly. Optional four-colour deck.
- **Interface:** dark "card room" look: near-black glass panels with brass hairlines, ivory text, gold primary buttons with a pressed 3D feel, colour-coded action buttons (Hit green, Stand red, Double gold, Split blue, Surrender grey) with keyboard hints, no emoji, line icons.
- **Home screen:** floating card suits, a bobbing card fan, **Quick play** (uses your last settings), **Table setup**, How to play, Sound, Credits, a player card (avatar picker, name, stats) and **Meet the regulars**.
- **Fonts:** Cinzel (lettering and numbers), Playfair Display (kept for display use), Inter (interface), self-hosted `.woff2` (SIL Open Font License; licences in `fonts/`).
- **Motion:** deal and flip animations, flying chips, floating win/lose amounts, speech bubbles. Reduced-motion setting is honoured.

## Tech overview

Plain HTML/CSS/JS, **no build step**, same architecture as Liar's Call. Files (✓ = exists):

| File | What it does |
| --- | --- |
| `index.html` ✓ | All screens: home, setup, table, game over, plus how-to-play, round log, menu, sound/display and credits overlays |
| `js/rules.js` ✓ | `BJ`: the pure rules engine (no DOM, no timers). Seeded RNG; every call returns **events**; `view(s, seat)` hides the dealer's hole card and the shoe. Matching-bets betting round, surrender, split, double, insurance |
| `js/bots.js` ✓ | `BJBots`: the cast and their lines, basic strategy, bet sizing by style, betting decisions, Easy/Normal/Hard |
| `js/art.js` ✓ | `BJArt`: cards, chips, portraits (dealer, 8 bots, 6 avatars), icons |
| `js/audio.js` ✓ | `BJAudio`: composer + synthesiser for the 10 tracks and all effects |
| `js/game.js` ✓ | Table client for solo play: turns engine events into a staged, animated display, sound and speech; asks the human for bets and moves; home, setup, settings, stats |
| `css/game.css`, `css/fonts.css`, `fonts/` ✓ | Styling and local fonts |
| `manifest.webmanifest`, `sw.js`, `icon.svg`, `icon-192.png`, `icon-512.png`, `og.png` ✓ | Install-as-app, offline cache, social preview image |
| `vercel.json` ✓ | Static site settings (no framework, serve the repo root, cache headers) |
| `tests/test-rules.js` ✓ | 97 checks: rules, payouts, split/double/insurance/surrender, matching bets, 1,000 random bot games, a house-edge simulation |
| `tests/test-audio.js` ✓ | 105 checks: the 10 tracks compose valid, repeatable music in key; all of them schedule on a strict fake audio context |
| `tests/ui-smoke.js` ✓ | Plays whole games through the real buttons in a headless browser (needs Playwright and a local server) |
| `js/net.js`, `js/peerjs.min.js` | Online rooms over PeerJS (copy of Liar's Call's approach). **Not built yet** |

**How the engine is used:** the host's browser runs the engine. Guests (once online play exists) send only their intent (bet, call, fold, hit, stand, ...); the host applies it and broadcasts the events plus each seat's `view`. **Events never contain the hole card**; it is only revealed with a `reveal` event. (Like Liar's Call, the host's browser holds the shoe, so a determined host could peek. Fine among friends.)

**Engine phases:** `bet → (insurance) → turn → dealer → roundEnd → bet … → over`. Key calls: `newGame`, `startRound`, `bet` (turn by turn with `matchBets`), `betOptions`, `rebuy`, `closeBets` (deals), `act`, `autoAct`, `autoBet` (timeouts), `nextRound`, `view`.

Browser storage keys: `bj-settings`, `bj-stats`, `bj-sound`.

## Hosting (Vercel)

1. In Vercel, **Add New → Project → import `blackjack21`**.
2. Framework preset **Other**, no build command, no output directory. `vercel.json` already says so.
3. Production branch `main`; every PR gets a preview URL. Bump `VERSION` in `sw.js` when you ship changes so installed copies update.

## Roadmap

**Phase 0: foundation** ✔ planner, rules engine, bots, tests

**Phase 1: playable solo table** ✔ deck and chip art, felt table, visible betting, solo game loop, setup, standings, design overhaul (3D table, professional buttons), surrender, table maximum, 6 seats

**Phase 2: sound** ✔ 10 tracks with mood switching, effects, volume sliders, track picker, now-playing label

**Phase 3: characters and polish** ✔ dealer and bot portraits with moods and speech, 6 player avatars, home redesign (quick play, player card, cast), presets, game speed, four-colour deck, stats, install-as-app, offline, social image

**Phase 3b: matching bets** ✔ poker-style betting round (call, raise, all in, fold), opener rotation, bot betting AI, table-bet pill and seat tags, free-betting option

**Phase 4: online** (next)
- [ ] `net.js` port, room codes, join links
- [ ] Lobby (seats, kick, add bots, options)
- [ ] Host/guest drivers, heartbeat, bot takeover for dropped players, spectators
- [ ] Emotes and quick table talk between players

**Phase 5: ship**
- [ ] Listen through the music and effects on real devices, tune
- [ ] Try on a real phone (layout, tap targets, install)
- [ ] Playtest with friends, balance (rounds, starting chips, bot levels, matching-bet tolerance)
- [ ] Copy into `Web-Games` as `games/blackjack21` + hub card + update its notes

## Decisions and why

- **Name: Blackjack 21** (user's choice). **Classic blackjack only for now.** **6 players + dealer, bots fill seats** (the user first asked for 7, then said 6 is fine because 7 looked crowded).
- **"52 decks" read as the classic 52-card deck.** The shoe is 6 decks by default (option 1 to 8). A literal 52-deck shoe makes counting meaningless, so it is not offered.
- **Matching bets are the default betting rule** (the user's request), with free betting as an option. Raises are capped at 2 per round so a round always ends; the opener rotates so everyone sets the table bet sometimes.
- **Static site + PeerJS, no Next.js** (an early draft proposed Next.js): matches Liar's Call, no build step, free hosting, easy copy into `Web-Games`.
- **Pure engine + events + per-seat views,** the same pattern as Liar's Call, so the same code runs solo, as an online host and in tests.
- **Dealer stands on all 17s, blackjack pays 3:2, dealer peeks, late surrender on.** Player-friendly casino rules; house edge about 0.4–0.6%.
- **Bets are multiples of 10** so 3:2 and insurance stay whole numbers.
- **Game length: 15 rounds, richest wins** (or endless). Gives a party-game finish.
- **All sound is generated** (no recordings), so nothing needs a licence or credit and it works offline. The trade-off is that it sounds synthesised; recorded tracks can replace it later without changing the track list.
- **Characters are drawn in code** (one face rig, many looks) so there are no image files and the cast is original.
- **One dealer** for now (the user wrote "dealers"; several selectable dealers are easy to add later).
- **Original names, art and sound only.**

## Ideas (not built, not decided)

- **Dealer choice:** a few dealers with different personalities.
- **Table themes** like Liar's Call: classic green (default), neon Vegas, vintage Monte Carlo, blue "high limit" room.
- **Side bets:** Perfect Pairs, 21+3. **Even money** on a blackjack against an Ace.
- **Bluff / power-card variants** (parked): hidden hole card with call-out, Peek/Swap/Freeze/Shield cards.
- **Tournament mode:** knockout, lowest stack out each round.
- **Cosmetics unlocked by playing:** card backs, felt colours, chip designs.
- **Achievements,** a **daily challenge** (fixed shoe seed), a **first-game tutorial** with the dealer, **replay last hand**, **phone vibration**.
- **Bot voices** (text-to-speech or recorded) and bot tells (a nervous twitch when they bluff-call).

## Known bugs and limitations

- **Solo play only.** Online rooms are the next phase.
- **The audio has not been listened to by a person.** It was verified by tests and offline measurements (see Music and sound).
- **Not tried on a real phone yet.** The UI was driven through full games in headless Chromium at phone and desktop sizes (including raises, a short-stack all-in and free betting) with no console errors.
- Hands of 4+ cards on a 6-seat phone table overlap a neighbour a little; may need tuning after playtests.
- An all-in is rounded down to a multiple of 10, so a stack of $25 goes all in for $20 and keeps $5.
- Online play, once built, will share Liar's Call's limits: never tested on strict networks, the host holds the shoe, host leaving ends the game.

## Open questions for the owner

1. Does the music feel right (tempo, instruments, volume)? Any track you want replaced, or a style missing?
2. Matching bets: are the bots' folding limits and the 2-raise cap right? Should raises be uncapped?
3. One dealer or several to pick from?
4. 15 rounds with richest-wins, or endless as the default?
5. Which table themes beyond classic green, if any?
6. Ready for online rooms with friends next?
