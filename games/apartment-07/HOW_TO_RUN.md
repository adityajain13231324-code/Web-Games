# How to run Apartment 07 locally

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

## Playing with friends over the internet

Localhost links only work on your own computer. For friends elsewhere:

1. Deploy the server (the `Dockerfile` builds it) to a host that supports WebSockets. Set `CLIENT_ORIGIN` to your website's address.
2. Build the client with `VITE_SERVER_URL=https://your-server-address pnpm build`.
3. Upload `dist/` to a static host such as Netlify or Vercel.

See the "Hosting" section of `README.md` for details.
