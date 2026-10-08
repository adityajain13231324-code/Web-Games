# How to run and host the Web Games hub

The hub is a static site: no build step, no server of its own.

## Run locally

`main.js` is a JavaScript module, so the page has to be served (double-clicking `index.html` shows no TV). From `hub/`:

```sh
python -m http.server 8000
# or: npx serve .
```

Then open http://localhost:8000. Scroll slowly to see the dive into the TV.

## Live site

**https://randomwebgames.vercel.app** (Vercel project with Root Directory `hub`, Framework "Other", no build command). Every merge to `main` redeploys it.

GitHub Pages also publishes a copy from `.github/workflows/hub-pages.yml` (https://adityajain13231324-code.github.io/Web-Games/) once Pages is set to "GitHub Actions" in the repo settings. All paths are relative, so it works under that sub-path too.

## Custom domain

Buy a domain, add it under Vercel **Settings → Domains**, and set the DNS records Vercel shows. HTTPS is automatic. Then update `og:image`, `og:url` and the canonical link in `index.html`, which use absolute https://randomwebgames.vercel.app URLs.

## Retaking the gameplay clips

Each clip in `media/` is 1280×720 with a poster frame, in two formats:

```sh
# from a recorded clip.mp4 (H.264):
ffmpeg -i clip.mp4 -vf "scale=1280:720,format=yuv420p" -c:v libx264 -crf 24 -preset slow -movflags +faststart -an media/xx.mp4
ffmpeg -i media/xx.mp4 -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -an media/xx.webm
ffmpeg -ss 5 -i media/xx.mp4 -frames:v 1 -q:v 3 media/xx.jpg
```

Keep clips around 10–15 seconds and under about 1 MB each. Record each game running locally (see its own HOW_TO_RUN.md); a plain screen recording works, and so does a headless browser with its clock slowed down if the machine renders slowly.
