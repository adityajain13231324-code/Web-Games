import test from "node:test";
import assert from "node:assert/strict";
import { io } from "socket.io-client";
import { createApp } from "../server/index.js";

test("independent socket sessions, authenticated recordings, reconnect, host migration and late joining", async () => {
  const app = await createApp({ production: true, port: 0 });
  const clients = [];
  const base = `http://localhost:${app.port}`;
  const connect = async (data) => {
    const s = io(base, { transports: ["websocket"], forceNew: true });
    clients.push(s);
    await new Promise((resolve) => s.on("connect", resolve));
    const result = await new Promise((resolve) =>
      s.emit("enter", data, resolve),
    );
    assert.ok(result.ok, result.error);
    return { s, ...result };
  };
  const send = async (c, event, data = {}) =>
    new Promise((resolve) =>
      c.s.emit(
        "action",
        { event, data: { phaseId: app.rooms.get(c.code).phaseId, ...data } },
        resolve,
      ),
    );
  try {
    const a = await connect({ create: true, name: "A" }),
      b = await connect({ code: a.code, name: "B" }),
      c = await connect({ code: a.code, name: "C" });
    const room = app.rooms.get(a.code);
    assert.equal(
      (await send(b, "settings", { settings: room.settings })).ok,
      false,
    );
    await send(a, "settings", {
      settings: { ...room.settings, mode: "gartic" },
    });
    for (const client of [a, b, c]) {
      await send(client, "mic", { mic: true });
      await send(client, "ready", { ready: true });
    }
    assert.ok((await send(a, "start")).ok);
    const upload = await fetch(`${base}/api/rooms/${a.code}/audio`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${a.token}`,
        "Content-Type": "audio/webm",
        "X-Duration": "1",
        "X-Phase-Id": String(room.phaseId),
      },
      body: Buffer.alloc(200, 1),
    });
    const { audioId } = await upload.json();
    assert.ok(audioId);
    assert.equal(
      (await fetch(`${base}/api/rooms/${a.code}/audio/${audioId}`)).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${base}/api/rooms/${a.code}/audio/${audioId}`, {
          headers: { Authorization: `Bearer ${b.token}` },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${base}/api/rooms/${a.code}/audio/${audioId}`, {
          headers: { Authorization: `Bearer ${a.token}` },
        })
      ).status,
      200,
    );
    const late = await connect({ code: a.code, name: "Viewer" });
    assert.ok(room.player(late.id).spectator);
    const originalId = b.id;
    b.s.disconnect();
    await new Promise((r) => setTimeout(r, 20));
    const resumed = await connect({ code: a.code, token: b.token });
    assert.equal(resumed.id, originalId);
    a.s.disconnect();
    await new Promise((r) => setTimeout(r, 20));
    assert.notEqual(room.host, a.id);
    assert.equal(room.players.length, 4);
  } finally {
    clients.forEach((s) => s.disconnect());
    await app.close();
  }
});
