// Screenshots of the starting-words panel, the word library and the seed screen, per theme and width.
//   ONLY=neon WIDTHS=390 node scripts/shots-words.mjs
import { chromium } from "@playwright/test";
import { createApp } from "../server/index.js";
import { mkdir } from "node:fs/promises";

const port = 3611;
const base = `http://localhost:${port}`;
const themes = (process.env.ONLY || "midnight,neon,paper,sunset").split(",");
const widths = (process.env.WIDTHS || "390,1440").split(",").map(Number);
await mkdir("shots/words", { recursive: true });
const app = await createApp({ production: true, port });
const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

for (const theme of themes) {
  for (const width of widths) {
    const height = width < 500 ? 844 : 900;
    const pages = [];
    const ctxs = [];
    for (let i = 0; i < 2; i++) {
      const ctx = await browser.newContext({
        viewport: { width, height },
        isMobile: width < 500,
        hasTouch: width < 500,
        permissions: ["microphone"],
      });
      await ctx.addInitScript(
        (t) => localStorage.setItem("sd-theme", t),
        theme,
      );
      const page = await ctx.newPage();
      await page.goto(base);
      await page
        .getByRole("button", {
          name: i ? "Join a room" : "Create a room",
          exact: true,
        })
        .click();
      await page.getByLabel("Your nickname").fill(i ? "Dev" : "Mira");
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
      ctxs.push(ctx);
    }
    const [host, guest] = pages;
    for (const page of pages) {
      await page.getByRole("button", { name: "A quick mic check?" }).click();
      await page
        .getByRole("button", { name: "Test microphone", exact: true })
        .click();
      await wait(600);
      await page
        .getByRole("button", { name: "Stop recording", exact: true })
        .click();
      await page.getByRole("button", { name: "Done", exact: true }).click();
    }
    const shot = async (page, name, full = false) => {
      await wait(1300);
      await page.screenshot({
        path: `shots/words/${theme}-${width}-${name}.png`,
        fullPage: full,
      });
    };
    await host
      .locator(".lobby-mode")
      .filter({ hasText: "Gartic Sounds" })
      .click();
    await host.getByRole("button", { name: "Room settings" }).click();
    await host.getByRole("radio", { name: /We write our own/ }).click();
    await shot(host, "1-settings-words");
    await host.getByRole("button", { name: "Browse the word library" }).click();
    await shot(host, "2-library");
    await host.keyboard.press("Escape");
    await host.keyboard.press("Escape");
    await Promise.all(
      pages.map((p) =>
        p.getByRole("button", { name: "Ready up", exact: true }).click(),
      ),
    );
    await host.getByRole("button", { name: "Let’s make noise" }).click();
    await host.getByLabel("Your starting word").waitFor();
    await host.getByLabel("Your starting word").fill("Disco llama");
    await shot(host, "3-seed-valid");
    await host.getByLabel("Your starting word").fill("my dog is loud");
    await shot(host, "4-seed-sentence");
    for (const c of ctxs) await c.close();
  }
}
await browser.close();
await app.close();
console.log("words shots done");
process.exit(0);
