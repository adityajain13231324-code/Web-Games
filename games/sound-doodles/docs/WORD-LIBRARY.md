# Word library and own-word mode (Gartic Sounds)

## What it is

- **1,399 starting words** in 15 packs, every entry one or two words (never a sentence): Animals, Famous people, Characters & legends, Food & drink,
  Places & landmarks, Things around the house, Jobs, Sports & games, Nature & weather, Vehicles & machines, Fantasy & monsters, Movies & shows,
  Music & instruments, Everyday actions, Science & space. The original list of sound ideas is still available as the "Sound ideas" pack.
- **Starting words** choice in **Room settings** (Gartic Sounds only):
  - _From the library_: everyone is dealt a surprise word from the chosen pack ("Everything" by default).
  - _We write our own_: each player types a word of **one or two words**. A live counter and message refuse sentences; the server enforces the same rule.
    The player can shuffle the suggested word up to three times or keep it. Anyone who passes or runs out of time keeps their suggestion.
- **Word library browser**: a card per pack with its size and a few random sample words (**Peek again** reshuffles the samples). The full list is never sent to the
  browser, so the words stay a surprise. The host can pick a pack from the browser.

## Where things live

- `server/words.js`: the packs, `cleanStartingWord()` (the one-or-two-word rule), `wordsFor()`, `libraryOverview()`.
- `server/game.js`: `wordPacks` room setting (a list of packs to mix), `drawWord()` (no repeats until a pack is used up), `shuffleSeed` event, seed-phase validation.
- `GET /api/words/library`: pack names, sizes and random samples only.
- `src/ui/RoomSettings.jsx`, `src/ui/WordLibrary.jsx`, `src/screens/SeedScreen.jsx`, `src/styles/words.css`.

## Rules

- A word is 1 or 2 tokens, each starting with a letter or digit and containing only letters, digits, apostrophes, periods or hyphens, at most 20 characters per word and
  30 overall. Hyphenated names count as one word (`Spider-Man`).
- Every library word appears in exactly one pack, so "Everything" never repeats an entry.
- Famous people are well-known public figures (historical, scientific, sporting, musical, film and a few Indian icons), chosen to be friendly. There is no profanity filter
  on words players type themselves; this is a game for private rooms among friends.

## Adding words

Edit the comma-separated lists in `server/words.js`. `npm test` checks that the library has 1,000+ unique entries and that every entry passes the one-or-two-word rule.

## Tests

Unit: library integrity, the word rule, own-word seed phase, pack draws, shuffle limit, no repeats. Browser: own-word flow with two sessions and the library browser.

## Classic word choices (Skribbl style)

- The performer is dealt **3, 4 or 5 words** (host setting, default 4), **easiest first**, each tagged EASY, MEDIUM or HARD with its category.
- Classic only deals **one- or two-word** prompts. Scenes and sentences ("Dog chasing a bouncing ball") are never dealt in Classic.
- Words come from the room's **packs** (one or several, see below): "Everything" blends the sound ideas (about 40%) with the family-friendly library, "Sound ideas"
  uses only the curated list, and any other pack deals only from the packs you chose. Every chosen pack is equally likely, so a small pack still shows up in a mix. Library words are guessed by their name; famous people and characters also accept the surname or character name alone.
- Hints for library words are the category, then the letter count.

## Spicy pack (18+)

- An 80-word pack of **sounds you can actually perform** for adult groups: moaning, heavy breathing, slurping, smooches, lip smacks, creaky mattresses, wolf whistles and
  other cheeky noises. It is suggestive and never explicit.
- **Opt-in only.** It is never part of "Everything". The host must pick it in the word library and confirm "We're all adults"; the server refuses the pack without
  that confirmation. Every player sees a "Spicy words are on" banner in the lobby, and switching to another pack turns it off.
- The library never previews its words, so opening the browser cannot surprise anyone.
- Works for both Classic and Gartic Sounds.

## Mixing packs

In the word library the host taps packs to build a mix: "Everything" is a preset, the first pack tapped narrows it to that pack, and further taps add ("Add to the mix") or
remove ("In the mix · remove") packs. At least one pack always stays selected. The 18+ confirmation is needed whenever Spicy joins a mix, and the banner shows for
everyone while it is in.

## Forgiving guesses

Guessing should not be a chore, so every one- or two-word prompt accepts more than its exact text (`autoAliases()` in `server/prompts.js`, used for the library and the curated sound ideas):

- **Any meaningful word alone**: "whisper" for Sultry Whisper, "station" for Space Station, "shame" for Walk-Of-Shame.
- **Other word forms**: "moan", "moans" and "moaning" are the same word ("lions" for Lion, "snore" for Snoring).
- **Words run together**: "catcall" for Cat Call, "wifi" for Wi-Fi.
- **Famous people and characters**: the surname or last word ("Depp"), never a first name; hyphenated names such as Spider-Man stay whole.
- Weak words never count alone: adjectives and fillers like "sultry", "heavy", "hot", "voice", "of". A few hand-written synonyms cover cases like "wolf whistle" for Cat Call.
- Single typos on words of five letters or more are still forgiven. Scenes (Duo) still need every part.

An 18+ pack stacks on top of Everything ("Everything + Spicy"); tapping a family pack narrows Everything to that pack but keeps any 18+ pack you added. An 18+ pack that was added on purpose
gets about 40% of the library picks, so it is really present.

## Older open pages

The server keeps a legacy `wordPack` mirror in the room settings and honors a changed `wordPack` from a page still running an older build, and every update carries a build id. A page that stays
open across a deploy shows "A new version of the game is ready · Refresh".

## Turns in Classic

Like Skribbl, everyone takes turns on the mic. A player who skipped the mic check still gets turns: their browser asks for the microphone while they choose a word.
Small rooms play at least four rounds (two friends get two turns each).

## Microphone list

The mic check lists microphones as soon as it opens and refreshes when hardware is plugged in or removed. Browsers hide device names until microphone permission is
granted, so unnamed devices appear as "Microphone 1, 2…" with a **Find my microphones** button. The chosen microphone is remembered, and if it is unplugged the
game falls back to the system default.

## Room settings (drawer)

The lobby shows one slim summary line (turn length, words to pick, pack, turns); everything else lives in the **Room settings** drawer, grouped:

- **Rounds and timing**: turns or rounds, performance time (20/30/40/60/90s), Classic pick-a-word time (10/20/30s), Gartic recording time (20/35/50s), chain length.
- **Words**: words to pick from (3/4/5), Gartic starting words (library or write your own), pack browser, difficulty.
- **Helpers and scoring**: word shuffles per turn (0-3), guesser hints on/off, speed bonus on/off (flat 150 points when off), Gartic awards vote.

All of these are validated on the server (`settings` event) and only the host can change them.
