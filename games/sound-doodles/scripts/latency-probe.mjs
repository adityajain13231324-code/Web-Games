// Measures how fast the game feels from this machine: connect time, which transport is used,
// and how long a "ready" press takes to come back as a new state.
//   node scripts/latency-probe.mjs https://sound-doodles.onrender.com
import { io } from "socket.io-client";

const url = process.argv[2] || "http://localhost:3000";
const ms = (t) => Math.round(performance.now() - t);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function probe(label, options) {
  const socket = io(url, { autoConnect: false, forceNew: true, ...options });
  const t0 = performance.now();
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
    socket.connect();
  });
  const connectMs = ms(t0);
  const transport = socket.io.engine.transport.name;
  // upgrades happen shortly after connecting
  await new Promise((r) => setTimeout(r, 1500));
  const finalTransport = socket.io.engine.transport.name;
  const enter = await new Promise((resolve) =>
    socket.emit("enter", { create: true, name: "Probe" }, resolve),
  );
  if (!enter.ok) throw new Error(enter.error);
  const samples = [];
  for (let i = 0; i < 8; i++) {
    const t = performance.now();
    // "ready" flips and the server answers with a fresh state broadcast
    const gotState = new Promise((resolve) => socket.once("state", resolve));
    const acked = new Promise((resolve) =>
      socket.emit(
        "action",
        { event: "ready", data: { ready: i % 2 === 0, phaseId: 0 } },
        resolve,
      ),
    );
    await Promise.all([acked, gotState]);
    samples.push(ms(t));
    await new Promise((r) => setTimeout(r, 300));
  }
  socket.emit("leave");
  socket.close();
  console.log(
    `${label.padEnd(22)} connect ${String(connectMs).padStart(5)} ms | transport ${transport} -> ${finalTransport} | ready press: median ${median(samples)} ms, worst ${Math.max(...samples)} ms`,
  );
}

const http0 = performance.now();
await fetch(`${url}/api/health`);
const httpRtt = ms(http0);
console.log(
  `HTTP round trip to ${url}: ${httpRtt} ms (this is roughly your network latency)`,
);
await probe("default (polling first)", {});
await probe("websocket first", { transports: ["websocket", "polling"] });
process.exit(0);
