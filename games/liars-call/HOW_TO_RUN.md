# How to run Liar's Call locally

Liar's Call is a static website with no build step and no install.

## Run it

**Option A, quickest:** double-click `index.html`. Playing against bots works. Install-as-app and online rooms need a real web address, so use option B for those.

**Option B, recommended:** serve the folder. From `games/liars-call`:

```sh
python -m http.server 8000
# or
npx serve .
```

Then open **http://localhost:8000**.

- **Play vs bots:** fully offline.
- **Play with friends:** needs internet, because PeerJS uses its free public server to connect players. To test on one computer, open two browser windows. Create a room in one and join with the 4-letter code in the other.

## Tests

```sh
node tests/test-rules.js
```

This runs the rules-engine checks, including 10,000 random games. It needs Node.js.

## Put it online

1. Go to **app.netlify.com/drop** and drag this whole folder in. To update the existing site, drag it onto that site's **Deploys** page instead.
2. Claim the site with a free Netlify account so it doesn't expire.
3. Share the link. "Play with friends" creates a room code and a WhatsApp invite.

Online rooms and the "Install app" button only work from the real `https://` Netlify link, not from a file on your computer.

When you deploy changed files, bump `VERSION` in `sw.js`, so installed copies pick up the update.
