# Pixel Peek — expanded edition

## What changed

- 1,762 pictures across 14 packs.
- 289 newly added pictures, selected from open artwork catalogs and visually reviewed.
- 118 original entries removed (near-duplicates, placeholders or overly specific pictures).
- 279 original display answers simplified, with old names and common synonyms accepted.
- Mailbox now accepts "mailbox", "mail box", "letterbox" and "postbox". The four flag/door variants are reduced to one picture.
- Gaming logos increased from 37 to 66, including Minecraft, Nintendo, Switch, Xbox, Undertale and more.
- New Game loot & gear (64 pictures) and Fantasy creatures (27 pictures) packs.
- Gamer night preset selects all three gaming packs: 157 pictures available, 15 rounds, 30 seconds per picture.
- Expanded apps, brands, animals and places. Ambiguous new assets were removed after visual review.
- Live reaction bar: laugh, fire, applause, surprise, crying, cool, handshake and skull.
- Reactions travel over the existing peer connection. Both sending and receiving are rate limited to one per 1.2 seconds. The display is capped at four bubbles and clears each after 3.5 seconds.
- Hide incoming reactions is remembered on this device. No free-text chat or persistent reaction history.

## Run

With Node.js installed, open a terminal in this folder:

    node serve.cjs

Visit http://localhost:4173. Stop with Ctrl+C.
Do not open index.html directly; pictures are fetched over HTTP.
A localhost invite works only on the same computer. For friends on different
devices, use an HTTPS static website host.

## Deploy

Upload these together:

- index.html
- improvements.css
- reactions.js
- p2p.js
- peerjs.min.js
- packs/ (all 14 JSON files)
- credits.html
- asset-credits.json

No hosted deployment was changed. New artwork is embedded in the packs; there
are no remote image requests for it. Google Fonts and PeerJS signaling still
use external services, as in the original website.

## Verification

Run each command from this folder:

    node check.cjs
    node test-content.cjs
    node test-flow.cjs
    node test-network.cjs
    node test-reactions.cjs

These passed. The checks cover pack counts, unique pack titles, SVG safety,
answer matching, common synonyms, the mailbox regression, presets, game startup,
room timeout and teardown, plus simulated two-way reaction delivery, cooldown,
mute, invalid payload rejection and disconnection behavior.

All new SVGs were rasterized into contact sheets and visually reviewed. This
checks the pictures, not browser layout. Real two-device WebRTC and mobile UI
verification remain outstanding; the preview browser could not reach the local
server in the previous session.

## Credits and audit

credits.html gives visible attribution; asset-credits.json records each added
picture's artist, source URL, license and changes. Game-icons.net art is CC BY
3.0 and Simple Icons art is CC0. Original artwork remains from the supplied ZIP;
its upstream licenses have not been independently audited.

content-audit.json records original answer changes and removals, plus new assets
rejected or relabeled during visual review. content-summary.json records totals.

New source libraries:
https://game-icons.net/about.html
https://github.com/simple-icons/simple-icons

## Remaining architecture limitations

This is a casual game between trusted friends. Guest clients still report their
own correct guesses and points; competitive play would require authoritative
validation. Some networks may require TURN infrastructure for reliable WebRTC.
No login, analytics, chat storage, or new backend was introduced.
