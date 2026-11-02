// Generates the optional announcer lines with the official ElevenLabs text-to-speech API.
// Run once during development, listen to the results, then commit the mp3 files.
//   ELEVENLABS_API_KEY=... node scripts/generate-announcer.mjs   (ELEVENLABS_VOICE_ID is optional)
// Use a stock or designed voice. Never clone a player's voice. This costs credits, so it is never
// called during gameplay.
import { mkdir, writeFile } from "node:fs/promises";

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error(
    "Set ELEVENLABS_API_KEY first (a free ElevenLabs account has one under Developers > API keys).",
  );
  process.exit(1);
}
// No voice id needed: unless ELEVENLABS_VOICE_ID is set, pick a stock premade voice from the account.
let voice = process.env.ELEVENLABS_VOICE_ID;
if (!voice) {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
  });
  if (!res.ok) {
    console.error(`Could not list voices: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const { voices } = await res.json();
  const stock = voices.find((v) => v.category === "premade") || voices[0];
  if (!stock) {
    console.error("This account has no voices to use.");
    process.exit(1);
  }
  voice = stock.voice_id;
  console.log(`Using stock voice: ${stock.name}`);
}
const lines = {
  "your-turn": "Your turn.",
  "time-to-guess": "Time to guess.",
  "lets-hear": "Let's hear what happened.",
};
const out = new URL("../public/audio/announce/", import.meta.url);
await mkdir(out, { recursive: true });
for (const [name, text] of Object.entries(lines)) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
    },
  );
  if (!res.ok) {
    console.error(`${name}: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  await writeFile(
    new URL(`${name}.mp3`, out),
    Buffer.from(await res.arrayBuffer()),
  );
  console.log(`wrote ${name}.mp3`);
}
