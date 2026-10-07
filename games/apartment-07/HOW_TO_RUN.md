# How to play and run Apartment 07

## Play online

**[Play Apartment 07](https://apartment07.up.railway.app)** — no installation or account required.

1. Click to come inside, customize your explorer and select **New apartment**.
2. Create a room and share its invitation link or six-letter code with up to three friends.
3. Friends open the same site and use **Join friends**, or follow the invite link.
4. The host selects **Begin the story**. Solve the apartment together and have everyone walk through the opened entrance. Solo works too.

The game runs on Railway, so the creator's laptop does not need to stay on. Sessions are held in server memory; a server restart or redeployment ends active games.

## Local development

This game has two parts, a **game server** (Node + Colyseus) and a **web client** (Vite + Phaser), so it can't be opened by double-clicking a file.

## You need

- **Node.js 22 or newer.** Check with `node -v`.
- **pnpm 11.** Install it with `npm install -g pnpm`, or use `npx pnpm@11 …` in place of `pnpm`.

## First time

From this folder (`games/apartment-07`):

```sh
pnpm install --ignore-scripts
```

## Start the game

```sh
node scripts/dev.mjs
```

This starts both parts:

- the game server on `http://127.0.0.1:2567` (restarts automatically when you edit `server/` or `shared/`)
- the web client on **http://127.0.0.1:5173** (reloads instantly when you edit `src/`)

Open http://127.0.0.1:5173 in Chrome or Edge, click to come inside, and create an apartment. To test multiplayer on one computer, open a second browser window and join with the room code.

Stop everything with **Ctrl + C** in the terminal.

The home screen shows "Server offline" if the server isn't running. Creating a room will fail until it is.

## Checks

```sh
pnpm check            # TypeScript type check
pnpm test             # rules / engine tests
pnpm test:network     # multiplayer tests (start the server first with node scripts/dev.mjs)
pnpm build            # production build: dist/ (client) and dist-server/ (server)
```

## Live hosting

Friends can use https://apartment07.up.railway.app now. Localhost is only for development. The live frontend and WebSocket server run together on Railway; deployment changes come from the separate [apartment-07 repository](https://github.com/adityajain13231324-code/apartment-07). The public domain targets the service's current PORT, 8080. Keep one replica and deploy updates between games, because restarts clear active sessions.
