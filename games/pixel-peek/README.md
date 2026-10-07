# Pixel Peek (party edition)

A picture guessing game for 2 to 8 players, each on their own device. A hidden picture slowly comes into focus, and everyone races to name it.

## How scoring works

- Everyone who guesses the picture scores, not just the first person.
- Your points depend on the timer when you guess: 100 at the start, dropping to 10 at the end.
- The round ends when everyone has got it or skipped, or when time runs out.
- There's no penalty for wrong guesses, so keep typing.
- Custom pics: you can't guess your own. If nobody gets it, you get 30 points.

## Hosting a room

- The host can remove a player with the ✕ next to their name (in the lobby or on the leaderboard). Tap it twice to confirm. Removed players can't rejoin that room.
- If someone closes their browser, they leave the room straight away. If their laptop sleeps or their internet drops, they're removed after about 10 seconds, and they can rejoin with the same code.
- Names are kept unique: a second "Player" becomes "Player 2".
- The ⛶ button in the top bar switches to full screen. The game also shrinks the picture to fit short laptop screens, so you never need to scroll mid-round.

## Reveal styles

Pixels, Zoom, Tiles, Spotlight (a wandering beam of light that slowly widens) and Shuffle (scrambled, rotated puzzle pieces that swap back into place). Mixed picks a different one each round.

## Pictures

2,480 pictures in 31 packs:

**Logos:** Tech & Code (248), Apps & Websites (329), Movies, TV & Music (62), Cars & Brands (156), Indian Brands (21)

**Emoji Riddles:** Movies in Emoji (70), Bollywood in Emoji (38), TV Shows & Anime in Emoji (38), Video Games in Emoji (37)

**Gaming:** Gaming Logos (88), Game Loot & Gear (69)

**Characters:** People & Jobs (62), Fantasy & Creatures (50), Emoji Faces & Reactions (68)

**Food:** Indian Food (35), Fruits & Veggies (39), Meals & Snacks (51), Sweets & Drinks (30)

**Everyday:** Tech & Gadgets (56), Movies, Music & Fun (75), Home & Kitchen (38), School & Office (43), Tools & Science (36), Clothes & Accessories (45), Sports (52)

**World & nature:** Animals (124), Nature & Weather (58), Vehicles & Travel (45), Famous Places (40), Flags (208), Country Shapes (169)

Emoji Riddles show 2 to 4 emoji that hint at a movie, show or game title. Type the title (common short forms like "lotr", "got", "ddlj" and "gta" also count).

Most pictures use Noto Emoji artwork (Apache 2.0, see licenses/noto-emoji.txt). The Indian Food illustrations were drawn for this edition (CC0).

## Put it online

Live at https://gamepixelpeek.vercel.app (hosted on Vercel). To update it, upload this folder to the Vercel project, or connect the project to the GitHub repo with Root Directory `games/pixel-peek` and no build command.

Share the link. One person creates a room and the others join with the 4-letter code or the invite link.

The host's device runs the game and passes everything along, so the host should have the steadiest connection. If someone gets stuck on "Joining room", a strict network (like some college Wi-Fi) may be blocking it: try a phone hotspot.

## Play locally

Run `node serve.cjs` in this folder and open http://localhost:4173. Opening index.html directly will not load the picture packs.

## Credits

See credits.html and the licenses folder. Brand and team names belong to their owners.
