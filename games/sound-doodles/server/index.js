import express from "express";
import { createServer } from "node:http";
import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Server } from "socket.io";
import { Room, GameError } from "./game.js";
import { libraryOverview } from "./words.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export async function createApp({
  production = false,
  port = Number(process.env.PORT) || 3000,
  scale = 1,
} = {}) {
  const app = express(),
    http = createServer(app),
    rooms = new Map(),
    sockets = new Map(),
    limits = new Map();
  // Cross-site requests are refused. With PUBLIC_ORIGIN set it must match exactly; without it,
  // the request's Origin host must equal the Host it was sent to, so hosting needs no extra setup.
  const originAllowed = (origin, host) => {
    if (!origin) return true;
    if (process.env.PUBLIC_ORIGIN)
      return origin === process.env.PUBLIC_ORIGIN.replace(/\/$/, "");
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  };
  const io = new Server(http, {
    maxHttpBufferSize: 65536,
    allowRequest: (req, cb) =>
      cb(null, originAllowed(req.headers.origin, req.headers.host)),
    serveClient: false,
  });
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(self)",
      "X-Frame-Options": "DENY",
    });
    next();
  });
  const rate = (key, max, window = 60000) => {
    const now = Date.now();
    const record = limits.get(key) || { start: now, n: 0 };
    if (now - record.start > window) {
      record.start = now;
      record.n = 0;
    }
    record.n++;
    limits.set(key, record);
    return record.n <= max;
  };
  const auth = (req) => {
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const room = rooms.get(String(req.params.code || "").toUpperCase());
    const player = room?.players.find((p) => p.token === token);
    if (!player)
      throw new GameError(
        "This room session has expired. Rejoin from the invitation.",
      );
    return { room, player };
  };
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  // Word library overview: sizes and a few random samples per pack, never the full list.
  app.get("/api/words/library", (_req, res) =>
    res.set("Cache-Control", "no-store").json(libraryOverview(6)),
  );
  app.get("/api/ice", (_req, res) => {
    const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    if (process.env.TURN_URL)
      iceServers.push({
        urls: process.env.TURN_URL,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      });
    res
      .set("Cache-Control", "no-store")
      .json({ iceServers, relayConfigured: !!process.env.TURN_URL });
  });
  app.post(
    "/api/rooms/:code/audio",
    (req, res, next) => {
      try {
        req.gameAuth = auth(req);
        if (!originAllowed(req.headers.origin, req.headers.host))
          return res.status(403).json({ error: "Origin not allowed." });
        if (!rate(`upload:${req.gameAuth.player.id}`, 15))
          return res
            .status(429)
            .json({ error: "Too many uploads. Try again shortly." });
        next();
      } catch (e) {
        res.status(401).json({ error: e.message });
      }
    },
    express.raw({ type: () => true, limit: "500kb" }),
    (req, res) => {
      try {
        const { room, player } = req.gameAuth;
        const audioId = room.storeAudio(
          player.id,
          req.body,
          req.headers["content-type"] || "",
          Number(req.headers["x-duration"]),
          Number(req.headers["x-phase-id"]),
        );
        res.json({ audioId });
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    },
  );
  app.get("/api/rooms/:code/audio/:audioId", (req, res) => {
    try {
      const { room, player } = auth(req);
      if (!room.canHear(player.id, req.params.audioId))
        return res
          .status(403)
          .json({ error: "This sound is not available at this step." });
      const a = room.audio.get(req.params.audioId);
      res
        .set({
          "Content-Type": a.mime,
          "Cache-Control": "no-store",
          "Content-Length": a.buffer.length,
        })
        .send(a.buffer);
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
  });
  function broadcast(room) {
    for (const p of room.players) {
      const socket = sockets.get(p.id);
      if (socket?.connected) socket.emit("state", room.view(p.id));
    }
  }
  io.on("connection", (socket) => {
    let room, player;
    socket.on("enter", (data, ack = () => {}) => {
      try {
        if (room) throw new GameError("Already in a room.");
        if (!rate(`enter:${socket.handshake.address}`, 30))
          throw new GameError("Too many attempts. Try again in a minute.");
        if (!data || typeof data !== "object")
          throw new GameError("Invalid room request.");
        if (data.create) {
          if (rooms.size >= 250)
            throw new GameError("The studio is full. Try again shortly.");
          let code;
          do {
            code = Array.from(
              { length: 6 },
              () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)],
            ).join("");
          } while (rooms.has(code));
          room = new Room(code, { scale });
          rooms.set(code, room);
        } else room = rooms.get(String(data.code || "").toUpperCase());
        if (!room)
          throw new GameError(
            "Room not found. Check the code or ask for a fresh invitation.",
          );
        player = data.token
          ? room.players.find((p) => p.token === data.token)
          : null;
        if (data.token && !player)
          throw new GameError(
            "Your session expired. Join again with your nickname.",
          );
        if (!player) player = room.add(data);
        const previous = sockets.get(player.id);
        if (previous && previous !== socket) previous.disconnect(true);
        player.connected = true;
        room.touched = Date.now();
        sockets.set(player.id, socket);
        room.migrateHost();
        ack({ ok: true, code: room.code, token: player.token, id: player.id });
        broadcast(room);
      } catch (e) {
        room = null;
        player = null;
        ack({ ok: false, error: e.message });
      }
    });
    // Tiny round trip the client uses to show a live ping, so network delay is visible.
    socket.on("latency", (ack) => typeof ack === "function" && ack(Date.now()));
    socket.on("action", (data, ack = () => {}) => {
      try {
        if (!room || !player) throw new GameError("Join a room first.");
        if (!rate(`action:${player.id}`, 40, 1000))
          throw new GameError("Slow down for a moment.");
        room.tick();
        room.dispatch(player.id, data?.event, data?.data);
        broadcast(room);
        ack({ ok: true });
      } catch (e) {
        ack({
          ok: false,
          error:
            e instanceof GameError
              ? e.message
              : "That action could not be completed.",
        });
        if (!(e instanceof GameError)) console.error(e);
      }
    });
    socket.on("signal", (data) => {
      if (!room || !player || !data || !rate(`signal:${player.id}`, 150, 10000))
        return;
      const target = room.player(data.to);
      if (!target?.connected || target.id === player.id) return;
      const performers = room.performers();
      if (!performers.includes(player.id) && !performers.includes(target.id))
        return;
      if (data.phaseId !== room.phaseId || JSON.stringify(data).length > 20000)
        return;
      if (!["offer", "answer", "candidate"].includes(data.kind)) return;
      sockets.get(target.id)?.emit("signal", {
        from: player.id,
        kind: data.kind,
        payload: data.payload,
        phaseId: room.phaseId,
      });
    });
    socket.on("leave", () => {
      if (room && player) {
        room.disconnect(player.id);
        sockets.delete(player.id);
        broadcast(room);
      }
      room = null;
      player = null;
    });
    socket.on("disconnect", () => {
      if (room && player && sockets.get(player.id) === socket) {
        room.disconnect(player.id);
        sockets.delete(player.id);
        broadcast(room);
      }
    });
  });
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      const ttl =
        Math.min(
          120,
          Math.max(10, Number(process.env.ROOM_TTL_MINUTES) || 120),
        ) * 60000;
      if (
        now - room.created > ttl ||
        (!room.players.some((p) => p.connected) &&
          now - room.touched > 10 * 60000)
      ) {
        for (const p of room.players) {
          sockets.get(p.id)?.emit("expired");
          sockets.get(p.id)?.disconnect(true);
          sockets.delete(p.id);
        }
        room.audio.clear();
        rooms.delete(code);
        continue;
      }
      // Unsubmitted uploads expire after two minutes; referenced clips expire with the room.
      const used = new Set(
        [
          ...Object.values(room.submissions || {}),
          ...(room.entries || []),
          ...Object.values(room.chains || {}).flatMap((c) => c.entries),
        ].map((e) => e.audioId),
      );
      for (const [id, a] of room.audio)
        if (now - a.created > 120000 && !used.has(id)) room.audio.delete(id);
      if (room.tick()) broadcast(room);
    }
    for (const [key, limit] of limits)
      if (now - limit.start > 120000) limits.delete(key);
  }, 200);
  cleanup.unref();
  let vite;
  if (production) app.use(express.static(path.join(root, "dist")));
  else {
    const { createServer } = await import("vite");
    vite = await createServer({
      root,
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }
  if (production)
    app.get("/{*path}", (_req, res) =>
      res.sendFile(path.join(root, "dist/index.html")),
    );
  app.use((error, _req, res, _next) =>
    res.status(error.status || 500).json({
      error:
        error.type === "entity.too.large"
          ? "Recording is too large. Try a shorter take."
          : "Request could not be completed.",
    }),
  );
  await new Promise((resolve) => http.listen(port, "0.0.0.0", resolve));
  return {
    http,
    io,
    rooms,
    port: http.address().port,
    close: async () => {
      clearInterval(cleanup);
      await vite?.close();
      await new Promise((resolve) => io.close(resolve));
    },
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const app = await createApp({
    production:
      process.argv.includes("--production") ||
      process.env.NODE_ENV === "production",
  });
  console.log(`Sound Doodles is listening on http://localhost:${app.port}`);
}
