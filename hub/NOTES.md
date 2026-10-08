# Web Games hub: project notes

Last updated: 8 October 2026.

## What it is

The landing page for all three games, live at https://randomwebgames.vercel.app. It's a static site (no build step) with a "channel guide" idea:

1. **The TV (hero).** A 3D retro TV built in three.js plays real gameplay of each game on a curved CRT screen (scanlines, colour fringing, static between channels, a green on-screen channel number). Beside it: the headline, and three game cards with the game's picture, name and player count. Hovering a card lifts it, plays a short clip in it and tunes the TV to that game; clicking the TV or pressing ← / → changes channel too; it cycles on its own until someone picks.
2. **Scroll.** The text fades, the camera moves to a front-on view of the whole set, then the TV's screen grows into Pixel Peek's full-screen panel (its outline follows the 3D screen, so the screen literally becomes the page).
3. **The reel.** Liar's Call, then Apartment 07, rise as cards over the previous game, which sinks back (scales down, dims) like a stack. Titles reveal letter by letter (GSAP SplitText), the gameplay video drifts (parallax), and a channel indicator on the right shows where you are.
4. **Ending.** "More channels coming soon", then the footer with the "Made by @adityajain1323" credit.

## Files

- `index.html`, `style.css`, `main.js`: the page. `main.js` is an ES module; the order of the hero's scroll phases is set by `ZOOM_END`, `FRAME`, `GROW` and `SHOW` at its top.
- `media/`: gameplay loops (`pp`, `lc`, `a7`) as WebM (VP9) and MP4 (H.264) plus a poster JPEG each, 1280×720, about 1.6 MB for the three videos per format.
- `vendor/`: three.js r170 (plus its RoomEnvironment and bloom post-processing modules), GSAP 3.15 with ScrollTrigger and SplitText, Lenis 1.3. Stored locally so the site needs no CDN. Licences in `vendor/LICENSES.txt` (MIT, and GSAP's free standard licence).
- `img/og.jpg`: the 1200×630 share image (a capture of the hero). `favicon.svg`: the TV icon.

## Decisions

- **Real gameplay, not drawings.** Earlier versions used CSS-drawn scenery and small screenshots and looked homemade. The footage was recorded from each game running locally, in a headless browser with the page's clock and animations slowed 10× and then sped back up, so it comes out at a smooth 30 fps. The Pixel Peek clip uses the "Quick break" emoji packs on purpose: rounds with brand logos are not used in promo footage.
- **Local libraries, relative imports.** No import map and no CDN, so the page works the same on Vercel, GitHub Pages and a private preview host.
- **Single dark theme by design** (a TV in a dark room).
- **Fallbacks.** Without WebGL the TV is replaced by a framed video and the portal grows from that frame instead. With "reduce motion" on, the animations stop and the page jumps between states instead of easing.

## Planned / not done

- No custom domain yet.
- Not measured on a real phone. If the 3D is slow on weak phones, lower the pixel ratio cap (1.75) or skip the bloom pass on small screens.
- Add a channel (card, panel and clip) when a fourth game ships.

## Known issues

- Fonts load from Google Fonts.
- The game clips are fixed recordings; retake them when a game's look changes (see HOW_TO_RUN.md).
