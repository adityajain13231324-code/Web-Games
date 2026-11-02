# UI overhaul (branch `ui-overhaul`)

Presentation layer only. Nothing under `server/` or `shared/` changed, no socket events or state shapes changed, and
`src/audio.js` (WebRTC and recording) is untouched. `Room.viewFor` secrecy is intact: the UI renders only what the server sends.

## Changelog

**Phase 1: structure (no behavior change).** `src/main.jsx` (2.1k lines) is now `App.jsx`, `screens/{Landing,Entry,Lobby,Voting,AudioSettings,Styleguide}.jsx`,
`screens/Game/{index,LiveMeter}.jsx` and shared primitives in `src/ui/`. CSS moved to `src/styles/` (`tokens`, `stage`, `ui`, `screens`, `game`, `motion`,
`reveal`, `guess`, `awards`, `styleguide`, plus `legacy.css`, the old rules still used by screens not yet redone).

**Phase 2: theme engine.** Four themes defined entirely through tokens on `[data-theme]` (so live previews can scope a theme to any element).
Saved choice is applied by an inline script before first paint (no flash). Switching crossfades over about 420 ms with the View Transitions API when
available, and falls back to token transitions. A palette popover (`ThemePicker`) shows four live mini-previews. Each theme also has a distinct stage
backdrop (`StageBackground`) that pauses when the tab is hidden.

**Phase 3: UI kit and screens.** New kit in `src/ui/`: `Button`, `IconButton`, `Badge`, `Toggle`, `Slider`, `Stepper`, `Skeleton`, `Tooltip`, `TimerRing`, `EQ`,
`CountUp`, `Popover`, `Drawer`, `ReconnectPill`, `Confetti`, `Countdown`, `Poster` (+`ModeArt`), `PlayerCard`/`GhostSlot`, `RoomCodeChip`, `Cast`, `ThemePicker`,
`StageBackground`, and `sfx` (synthesized UI sounds). Landing has an animated logo, masked word-slide headline, two giant buttons and a floating avatar cast.
The lobby is a "green room": room-code ticket (copy morphs to a check with mini confetti), a stage of animated player cards with ghost slots, poster mode
picker with a horizontal "four more ways" shelf, scoring popover, live mic level meter, settings drawer, and a dominant Start button with a ready-count ring and
an animated status line (sticky action bar on phones). Joining has a six-box room code and an avatar shuffle.

**Phase 4: game ceremony.** Phase chip in the round header, `TimerRing` (shakes and turns coral in the last 5 seconds) plus the draining time bar, a big 3-2-1 before
going live, a prompt flip card for the performer, a voice-reactive performer (the avatar's mouth, size and ring follow the mic level) over an EQ ring, a "who's done"
cast bar with animated checks, and an unmissable "Tap to hear your friends" button when autoplay is blocked.

**Phase 5: results and settings.** Podium with staggered rise, score count-up, confetti and a short screen shake. "Sound & motion" settings with an in-app
**Reduce motion** toggle (stored as `sd-reduce-motion`, mirrors the OS setting). Reconnect pill replaces the old banner.

**Phase 6: tooling.** Dev-only styleguide at `/styleguide` or `#/styleguide` (`npm run dev`; excluded from production builds). `scripts/shots.mjs` captures
every theme at 390/768/1440 px. `scripts/play-review.mjs` plays Classic and Gartic with four simulated phone sessions (`THEME=neon node scripts/play-review.mjs`).

## Token reference

Shared: spacing `--s-1..8` (4/8/12/16/24/32/48/64 px), type `--fs-xs..hero` (fluid `clamp()`), layers `--z-*`, durations `--t1..t4`
(120/200/320/520 ms times the theme's `--speed`), easings `--ease-out`, `--ease-spring`, `--ease-inout`, `--ease-ui` (per theme), `--stage-max` 1200px, `--gutter`.

| Token                | Midnight Studio            | Neon Arcade                                       | Paper Playground (default)                                      | Sunset Lounge                                            |
| -------------------- | -------------------------- | ------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| `--bg` / `--surface` | `#0e0e1b` / `#181829`      | `#060a1c` / `#0c1530`                             | `#f5eddb` / `#fffaf0`                                           | `#2a1238` / `#3c1f4d`                                    |
| `--text` / `--muted` | `#f4efe6` / `#b6b3cc`      | `#eefaff` / `#a9c3e6`                             | `#25222b` / `#5b5460`                                           | `#fff1e0` / `#e6c8da`                                    |
| `--accent`           | violet `#bba6ff`           | coral `#ff5c80`                                   | violet `#7650c2`                                                | peach `#ffb48c`                                          |
| `--accent-2`         | mint `#9ff0c4`             | cyan `#2de8ff`                                    | coral `#b23d2b`                                                 | coral `#ff9a82`                                          |
| `--mint` / `--coral` | `#9ff0c4` / `#ff9d92`      | `#55ffc0` / `#ff5c80`                             | `#1c7650` / `#b23d2b`                                           | `#cde9b6` / `#ff9a82`                                    |
| `--on-accent`        | `#1a1530`                  | `#12040a`                                         | `#fffdf7`                                                       | `#381424`                                                |
| Radii `--r-sm..xl`   | 10/14/22/30                | sharp, asymmetric (2 to 6 px corners)             | wobbly irregular                                                | 16/22/30/42                                              |
| `--border-w`         | 1px                        | 2px                                               | 2.5px, ink outlines                                             | 1px                                                      |
| Heading font / case  | Space Grotesk              | Space Grotesk, uppercase                          | Fraunces                                                        | Bricolage Grotesque                                      |
| `--speed`            | 1 (smooth)                 | 0.7 (fast, sharp)                                 | 1.1 (bouncy, springy)                                           | 1.6 (slow, floaty)                                       |
| Stage props          | spotlight cone, film grain | perspective grid floor, scanlines, glitch flicker | dotted paper, washi tape, hard offset shadows, marker highlight | gradient sky, blurred sun, drifting clouds, glow shadows |

Contrast (WCAG AA, computed from the tokens): body text, muted text, text on accent fills, and accent against bg and surface all pass 4.5:1 (3:1 for UI)
in every theme. Paper's mint and coral were darkened so they pass as text on its surfaces.

## Verification

- 29 unit tests and 9 Playwright browser tests (four simulated sessions, every mode) pass.
- `scripts/shots.mjs`: 72 screenshots (4 themes x 3 widths x 6 screens) reviewed; no console errors.
- Bundle: about +13 KB gzip over the pre-overhaul build (JS 112 KB, CSS 18 KB), well under the 60 KB budget. No new runtime dependencies, no CDN calls.

## Tests that changed (same commit as the UI)

- Theme picker is a popover, so the theme test closes it with Escape instead of a "Close" button.
- Room settings are a slide-over drawer, so `configure()` presses Escape after changing settings.
- The Start button's glow-only animation never changes its box, so Playwright sees it as stable.

## Deferred or not done

- **Remote voice reactivity:** guessers see the performer's avatar sway while live, but not driven by the real level. The remote audio level lives inside `src/audio.js`'s
  WebRTC code, which was off limits. A small hook there that exposes an analyser would unlock it.
- **View Transitions between screens:** theme changes crossfade, but moves between landing, lobby and game phases use CSS entrance animation, not shared-element transitions.
- **Legacy CSS:** `src/styles/legacy.css` still styles screens that were restyled by tokens only (Recorder, Voting, Foley scenes, Duo/Detective/Ranking panels).
  They inherit the themes and look consistent, but they have not had bespoke redesigns.
- **Per-mode accents** for Foley, Duo, Detective and Ranking inside the game are limited to the poster art; the in-game screens share the common treatment.
- **Gartic reveal** keeps its existing timeline layout (restyled by the themes); the full "chain unfolds with connecting waveform thumbnails" playlist was not rebuilt.
- **Real-device checks** (touch targets on physical phones, TV casting, real microphones) were not done; everything was verified in emulated browsers with simulated microphones.
- **Unused imports** left by the automated file split in a few screen files are harmless but could be cleaned with a linter.

## Two more themes: Cloud Nine and Bubblegum Pop

- **Cloud Nine** (`sky`): light, airy sky blue. A sky gradient, a pale sun and drifting clouds; DM Sans display type; pill buttons; slow, soft motion.
- **Bubblegum Pop** (`pop`): pink with polka dots and slowly rising hearts; Bricolage Grotesque; candy-style pill buttons with a pressed-down shadow; bouncy motion.
- Both are token blocks in `tokens.css` (backdrops and personality in `styles/themes-light.css`) and appear in the picker with a cloud and a heart emblem. **Paper remains the default.**
- `npm run check:contrast` (and a unit test) checks every theme for WCAG AA: text, muted text, accent buttons and accent text.
