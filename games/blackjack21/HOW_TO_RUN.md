# How to run Blackjack 21

It is a static site: plain HTML, CSS and JavaScript with no build step.

## Play / view it locally

Open `index.html` in a browser (works straight from the file for solo play), or serve the folder:

```
python3 -m http.server 8000
```

then go to http://localhost:8000. (Online rooms, once built, need the page served over http(s), not opened as a file.)

## Run the tests

Needs Node 16+. From the repo root:

```
node tests/test-rules.js    # rules, payouts, matching bets, 1,000 random bot games, house-edge simulation
node tests/test-audio.js    # the 10 music tracks and the audio engine, on a strict fake audio context
```

Both print `N passed, 0 failed`. There is also a browser smoke test that plays whole games through the real buttons (needs `npm i playwright` and the site served locally):

```
python3 -m http.server 8123 &
node tests/ui-smoke.js
```

## Install as an app

On Android/Chrome use the browser's Install button; on iPhone use Share, then Add to Home Screen. It opens full screen and works offline (`sw.js` caches the files; bump `VERSION` in it when you ship changes).

## Deploy on Vercel

1. Vercel → **Add New → Project** → import the `blackjack21` repo.
2. Framework preset **Other**. Leave build command and output directory empty. Root Directory is the repo root.
3. Deploy. Every push to `main` goes live; every PR gets a preview link.

No environment variables or database are needed.

`vercel.json` already tells Vercel there is no framework and no build step and to serve the repo root, so it overrides any wrong project setting (for example a Next.js preset). Vercel deploys the production branch, `main`; until the work is merged into `main`, only the pull request's **preview** link shows the game, and the production link says "Page does not exist".
