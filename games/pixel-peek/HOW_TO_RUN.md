# How to run Pixel Peek locally

Pixel Peek is a static website. It loads its picture packs with `fetch`, so it needs a small web server. Double-clicking `index.html` won't load the packs.

## Run it

You need Node.js (any recent version). From this folder (`games/pixel-peek`):

```sh
node serve.cjs
```

Then open **http://localhost:4173** in your browser.

Any other static server also works, for example `python -m http.server 4173` or `npx serve .`.

## Try it

- **Practice solo:** works fully offline (apart from the Google Fonts).
- **Multiplayer on one computer:** open two browser windows. Create a room in one and join with the 4-letter code in the other. This needs internet, because PeerJS uses its free public server to connect players.

## Put it online

1. Go to **app.netlify.com/drop** and drag this whole folder in. To update the existing site, drag it onto that site's **Deploys** page instead.
2. Claim the site with a free Netlify account so it doesn't expire.
3. Share the link. One person creates a room, and the others join with the code or the invite link.

The extra files (`README*.md`, `credits*`, `licenses/`, `serve.cjs`) are harmless to deploy and keep the credits available on the site.
