// Plays Classic and Gartic Sounds with four phone-sized sessions and saves screenshots to shots/play/.
import { chromium } from "@playwright/test";
import { createApp } from "../server/index.js";
import { mkdir } from "node:fs/promises";

const port = 3411;
const base = `http://localhost:${port}`;
const out = `shots/play-${process.env.THEME || "midnight"}`;
await mkdir(out, { recursive: true });
const app = await createApp({ production: true, port });
const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const shot = (page, name) =>
  page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const expire = async (room) => {
  room.deadline = Date.now() - 1;
  await pause(500);
};

async function makeGroup() {
  const pages = [];
  for (let i = 0; i < 4; i++) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      permissions: ["microphone"],
    });
    await ctx.addInitScript(
      (t) => localStorage.setItem("sd-theme", t),
      process.env.THEME || "midnight",
    );
    const page = await ctx.newPage();
    await page.goto(base);
    await page
      .getByRole("button", {
        name: i ? "Join a room" : "Create a room",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Your nickname")
      .fill(["Mira", "Dev", "Sana", "Leo"][i]);
    if (i)
      await page
        .getByLabel("Room code")
        .fill(new URL(pages[0].url()).searchParams.get("room"));
    await page
      .getByRole("button", {
        name: i ? "Join room" : "Create room",
        exact: true,
      })
      .click();
    await page.getByText("Tonight’s game").waitFor();
    pages.push(page);
  }
  const room = app.rooms.get(new URL(pages[0].url()).searchParams.get("room"));
  for (const page of pages) {
    await page.getByRole("button", { name: "A quick mic check?" }).click();
    await page
      .getByRole("button", { name: "Test microphone", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Stop recording", exact: true })
      .waitFor();
    await pause(400);
    await page
      .getByRole("button", { name: "Stop recording", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Record again", exact: true })
      .waitFor();
    await shot(page, "mic-check-" + pages.indexOf(page)).catch(() => {});
    await page.getByRole("button", { name: "Done", exact: true }).click();
  }
  return { pages, room };
}

async function ready(g) {
  await Promise.all(
    g.pages.map((p) =>
      p.getByRole("button", { name: "Ready up", exact: true }).click(),
    ),
  );
  await pause(300);
}

// ---- Classic ----
{
  const g = await makeGroup();
  await shot(g.pages[0], "classic-1-lobby-host");
  await ready(g);
  await shot(g.pages[0], "classic-2-lobby-ready");
  await g.pages[0].getByRole("button", { name: "Let’s make noise" }).click();
  await pause(800);
  const performerId = g.room.performerIds[0];
  const idx = g.room.players.findIndex((p) => p.id === performerId);
  const performer = g.pages[idx];
  await shot(performer, "classic-3-choose-performer");
  await shot(g.pages[(idx + 1) % 4], "classic-3b-waiting-guesser");
  await performer.locator(".prompt-choices button").first().click();
  await pause(800);
  await shot(performer, "classic-4-prepare-performer");
  await expire(g.room);
  await pause(1500);
  const guesser = g.pages[(idx + 1) % 4];
  await shot(performer, "classic-5-perform-performer");
  await shot(guesser, "classic-6-perform-guesser");
  await guesser.getByLabel("Your private guess").fill("a wrong guess");
  await guesser.getByRole("button", { name: "Guess", exact: true }).click();
  await pause(600);
  await shot(guesser, "classic-7-after-wrong-guess");
  const answer = g.room.prompt.phrase;
  const second = g.pages[(idx + 2) % 4];
  await second.getByLabel("Your private guess").fill(answer);
  await second.getByRole("button", { name: "Guess", exact: true }).click();
  await pause(700);
  await shot(second, "classic-8-correct-guess");
  await shot(g.pages[(idx + 3) % 4], "classic-8b-others-see-correct");
  await expire(g.room);
  await pause(1200);
  await shot(g.pages[0], "classic-9-round-reveal");
  for (const p of g.pages) await p.context().close();
}

// ---- Gartic Sounds ----
{
  const g = await makeGroup();
  const host = g.pages[0];
  await host
    .locator(".lobby-mode")
    .filter({ hasText: "Gartic Sounds" })
    .click();
  await shot(host, "gartic-1-lobby-selected");
  await ready(g);
  await host.getByRole("button", { name: "Let’s make noise" }).click();
  await pause(900);
  await shot(host, "gartic-2-record-task");
  const record = async () => {
    await Promise.all(
      g.pages.map(async (page) => {
        await page
          .getByRole("button", { name: "Start recording", exact: true })
          .click();
        await pause(1400);
      }),
    );
    await shot(g.pages[1], "gartic-3-recording");
    await Promise.all(
      g.pages.map(async (page) => {
        await page
          .getByRole("button", { name: "Stop recording", exact: true })
          .click();
      }),
    );
    await pause(500);
    await shot(g.pages[1], "gartic-4-preview");
    await Promise.all(
      g.pages.map((page) =>
        page
          .getByRole("button", { name: "Submit this sound", exact: true })
          .click(),
      ),
    );
    await pause(700);
    await shot(g.pages[1], "gartic-5-submitted-waiting");
    await expire(g.room);
    await pause(900);
  };
  const interpret = async (r) => {
    await Promise.all(
      g.pages.map(async (page, i) => {
        await page
          .getByLabel("Your interpretation")
          .fill(`A confused seagull ${r}${i}`);
      }),
    );
    if (r === 1) await shot(g.pages[2], "gartic-6-interpret");
    await Promise.all(
      g.pages.map((page) =>
        page.getByRole("button", { name: "Submit", exact: true }).click(),
      ),
    );
    await pause(500);
    await expire(g.room);
    await pause(900);
  };
  await record();
  await interpret(1);
  await record();
  await interpret(3);
  await pause(900);
  await shot(host, "gartic-7-reveal-start");
  let n = 0;
  while (g.room.phase === "chainReveal" && n < 40) {
    const entries =
      g.room.chains[g.room.ids[g.room.revealChain]].entries.length;
    if (g.room.revealChain === 0 && g.room.revealStep === 2)
      await shot(host, "gartic-8-reveal-mid");
    if (g.room.revealChain === 0 && g.room.revealStep === entries - 1)
      await shot(host, "gartic-9-chain-end");
    const next =
      g.room.revealStep < entries - 1
        ? host.getByRole("button", { name: "Reveal next step", exact: true })
        : host.getByRole("button", {
            name: g.room.revealChain === 3 ? "Finish the show" : "Next chain",
            exact: true,
          });
    await next.click();
    await pause(700);
    n++;
  }
  await pause(900);
  await shot(host, "gartic-10-results");
  for (const p of g.pages) await p.context().close();
}
await browser.close();
await app.close();
console.log("done");
process.exit(0);
