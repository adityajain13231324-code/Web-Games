# Web Games hub: project notes

Last updated: 30 October 2026 (Ultimate Tic Tac Toe added as channel 2).

## What it is

The landing page for all six games, live at https://randomwebgames.vercel.app. It's a static site (no build step) with a "channel guide" idea:

1. **The TV (hero).** A 3D retro TV built in three.js plays real gameplay of each game on a curved CRT screen (scanlines, colour fringing, static between channels, a green on-screen channel number). Beside it: the headline, and five game cards with the game's picture, name and player count (the first two, Pixel Peek and Ultimate Tic Tac Toe, are larger "featured" cards with a one-line description). Each card is a link to its game. Hovering a card lifts it, zooms its still picture, shows a "Play" label and tunes the TV to that game (only the TV plays video). Clicking the TV or pressing ← / → changes channel too; it cycles on its own until someone picks.
2. **Scroll.** The text fades, the camera moves to a front-on view of the whole set, then the TV's screen grows into Pixel Peek's full-screen panel (its outline follows the 3D screen, so the screen literally becomes the page).
3. **The reel.** Ultimate Tic Tac Toe, then Liar's Call, Apartment 07 and Blackjack 21, rise as cards over the previous game, which sinks back (scales down, dims) like a stack. Titles reveal letter by letter (GSAP SplitText), the gameplay video drifts (parallax), and a channel indicator on the right shows where you are.
4. **Ending.** "More channels coming soon", then the footer with the "Made by @adityajain1323" credit.

## Files

- `index.html`, `style.css`, `main.js`: the page (scrolling, cards, the reel). The order of the hero's scroll phases is set by `ZOOM_END`, `FRAME`, `GROW` and `SHOW` at the top of `main.js`.
- `tv.js`: the 3D TV. `main.js` imports it after the first frame, so the page is usable before the 3D engine has loaded.
- `vercel.json`: cache headers for `vendor/`, `media/` and `img/`.
- `media/`: gameplay loops (`pp`, `ut`, `lc`, `a7`, `bj`) as WebM (VP9) and MP4 (H.264) plus a poster JPEG each, 1280×720, about 1.6 MB for the three videos per format.
- `vendor/`: three.js r170 (plus its RoomEnvironment and bloom post-processing modules), GSAP 3.15 with ScrollTrigger and SplitText, Lenis 1.3. Stored locally so the site needs no CDN. Licences in `vendor/LICENSES.txt` (MIT, and GSAP's free standard licence).
- `img/og.jpg`: the 1200×630 share image (a capture of the hero). `favicon.svg`: the TV icon.

## Decisions

- **Real gameplay, not drawings.** Earlier versions used CSS-drawn scenery and small screenshots and looked homemade. The footage was recorded from each game running locally, in a headless browser with the page's clock and animations slowed 10× and then sped back up, so it comes out at a smooth 30 fps. The Pixel Peek clip uses the "Quick break" emoji packs on purpose: rounds with brand logos are not used in promo footage.
- **Local libraries, relative imports.** No import map and no CDN, so the page works the same on Vercel, GitHub Pages and a private preview host.
- **Single dark theme by design** (a TV in a dark room).
- **Fallbacks.** Without WebGL the TV is replaced by a framed video and the portal grows from that frame instead. With "reduce motion" on, the animations stop and the page jumps between states instead of easing.

## Performance

- First load fetches the page, the three card pictures, the libraries and one TV clip. The other TV clips load when first tuned; the full-screen clips start loading about two screens before they appear and only play while on screen.
- The TV renders without canvas antialiasing (the bloom pass's render target is multisampled instead), with a 512 px shadow map, a pixel-ratio cap of 1.75 (1.5 on narrow screens), and drops its resolution by itself if frames take longer than 25 ms. It stops rendering once the screen has grown over it.
- No effects that repaint the whole screen each frame: the film grain is a still texture, the nav has no blend mode, the pills have no backdrop blur.
- The scroll script skips all page updates while the scroll position is unchanged.

## Planned / not done

- No custom domain yet.
- Not measured on a real phone. If the 3D is still slow on weak phones, skip the bloom pass on small screens in `tv.js`.
- Add a channel (card, panel and clip) when a sixth game ships. Channel count is not hard-coded: `main.js` and `light.js` use `CHANNELS.length` / `names.length`. The card grid in `style.css` (`.guide`) is 6 columns: two featured cards span 3 each, the others span 2, so a sixth game needs a new row layout (or a third featured card).

## Known issues

- Fonts load from Google Fonts.
- The game clips are fixed recordings; retake them when a game's look changes (see HOW_TO_RUN.md).

## 9 October 2026: integrated hub improvements

- Preserves the desktop TV-to-screen choreography and the performance pass's lazy media loading. Game code and destinations are unchanged.
- `boot.js` loads `light.js` on narrow/coarse-pointer, reduced-motion, data-saving and <=4-core devices. This path uses native scrolling, real gameplay stills and a CSS TV; no 3D, animation libraries or video decoding. Rendering mode is selected at page load; reload after changing between desktop and mobile viewport emulation.
- Desktop DPR is capped at 1.5, MSAA at 2 samples; sustained slow frames disable bloom as well as lowering resolution. TV tilt uses elapsed time; interrupted channel tuning is cancelled. Rendering pauses in hidden tabs.
- `enhancements.css` adds creator credit, subtle static background detail, larger music target, native-flow mobile cards and a dismissing scroll hint. The nav explicitly restores pointer events for buttons (the original nav only restored anchors).
- `music.js` contains three original synthesized instrumental loops, silent until a user click. One icon cycles three tracks and off. Audio suspends while hidden. No third-party music or network fetches.
- `enhancements.js` dismisses the scroll hint after 32px. Pick for me selects a different game without navigating automatically.
- Phone rendering has been designed for narrow screens; physical-device performance remains to be measured.

## 9 October 2026: Blackjack 21 (channel 4)

- New channel: card, reel panel, rail entry, TV clip (`media/bj.webm/.mp4/.jpg`, recorded from the game in headless Chromium, 14 s, about 0.3 MB per format) and the lightweight-mode poster. Links to https://blackjack21-cardgame.vercel.app.
- The channel arithmetic (arrow keys, TV click, Pick for me, auto-cycle) now uses the channel count instead of a hard-coded 3.
- Hero cards are 4 columns on desktop. Checked at 1440x810 (3D path) and 390x844 (light path); not checked on a real phone.
- The game's code is copied to `games/blackjack21` (standalone repo: `blackjack21`).

## 30 October 2026: Ultimate Tic Tac Toe (channel 2)

- New channel placed second, right after Pixel Peek: the two are the **featured** cards (the card grid was 6 columns then; see the Sound Doodles entry for the current 12-column layout). Each featured card has a one-line description; Pixel Peek's was added for symmetry ("Name the hidden picture before your friends do."). Channels after it moved down one: Liar's Call CH 03, Apartment 07 CH 04, Blackjack 21 CH 05 (cards, reel panels, rail, `CHANNELS`, lightweight-mode poster list).
- The Ultimate Tic Tac Toe card has a **2-player badge** on its picture and an **animated mini icon** (a 3×3 of 3×3 boards whose marks pop in and out; CSS only, `.mini` in `style.css`; it stops under reduced motion and keeps a static pattern).
- TV clip: `media/ut.webm/.mp4/.jpg`, a scripted 36-move game recorded from the real game (neon theme, 1280×720, 15 s, about 0.6 MB per format). The game was found by search so that both players claim boards and O wins on the last move.
- Reel panel title uses Orbitron (added to the Google Fonts link in `index.html`).
- On laptop-height screens (≤ 860 px tall, desktop path) the lead paragraph is hidden and the thumbnails are shorter so both rows of cards stay on screen; checked at 1440×810, 1280×720 and 1920×1080, plus the lightweight layout at 390×844.
- The card and panel link to https://bettertictactoe.vercel.app, the game's own Vercel project, deployed from the standalone repo `adityajain13231324-code/ultimate-tic-tac-toe`. The link appears in `index.html` (card and panel) and `main.js` (`CHANNELS`).

## 3 November 2026: Sound Doodles (channel 6)

- New channel: card, reel panel, rail entry, TV clip (`media/sd.webm`, 21 s, 0.6 MB, recorded from the game in desktop Chrome with four players and fake microphones) and poster `media/sd.jpg`. Links to https://sound-doodles.onrender.com.
- No `sd.mp4`: no H.264 encoder was available when recording, so the panel and TV use the VP9 WebM only. Browsers without VP9 get the poster in the panel; the lightweight (phone) path only uses posters. Add an MP4 if that matters.
- With six channels `.guide` is a 12-column grid: the two featured cards (Pixel Peek, Ultimate Tic Tac Toe) span 6 each, the other four span 3 each (two rows). The light-mode override keeps one column on phones.
- The clip is a light UI, so `#sound-doodles .bg` is dimmed in `enhancements.css` to keep the title readable. Title font is Fraunces 700 (the game's own headline serif), added to the Google Fonts link.
- The game's code is copied to `games/sound-doodles` (standalone repo: `SOUND-DOODLES`, branch `main`).

## 4 November 2026: Tiny Gods (channel 1)

- Newest games go first: Tiny Gods is CH 01 (first card, the TV's opening channel and the full-screen portal panel); everything else moved down one (Pixel Peek is now the first reel panel, CH 02). The three featured cards are Tiny Gods, Pixel Peek and Ultimate Tic Tac Toe (span 4 each); the other four are small cards.
- Clip `media/tg.webm` (VP9, 12 s, about 1 MB) and poster `media/tg.jpg` were recorded from the live game (no mp4 version, like Sound Doodles).
- `boot.js` no longer sends every machine with 4 or fewer CPU cores to the lightweight page (that made many desktops show the flat TV). Phones, narrow windows, reduced motion and data saver still do.
- Game code copied to `games/tiny-gods`.
