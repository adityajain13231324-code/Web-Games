# How to run and host the Web Games hub

The hub is a static landing page (no build, no server) linking to the three games.

## Run locally

From `hub/`: `python3 -m http.server 4300`, then open http://localhost:4300.

## Host it (free, pick one)

**GitHub Pages (automatic).** In the repo go to **Settings → Pages → Source: GitHub Actions**. After that, every push to `main` that touches `hub/` runs `.github/workflows/hub-pages.yml` and publishes to https://adityajain13231324-code.github.io/Web-Games/.

**Vercel (nicer URL).** New Project → import this repo → **Root Directory `hub`**, Framework "Other", no build command. Choose a project name such as `webgames-hub` to get `webgames-hub.vercel.app`, matching the other games.

## Custom domain

Buy a domain (e.g. `webgames.fun`), then add it under Vercel **Settings → Domains** (or GitHub **Settings → Pages → Custom domain**) and set the DNS records they show. HTTPS is automatic.

## Updating screenshots

`img/*.webp` are real screenshots of each game (1280×800). Retake them when a game's look changes. `img/og.png` is the 1200×630 share image; set `og:image` to an absolute URL once the final domain is known.
