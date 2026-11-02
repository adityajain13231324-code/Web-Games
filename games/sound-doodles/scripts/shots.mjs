// Captures key screens for every theme at 390, 768 and 1440px into shots/<theme>-<width>-<screen>.png.
//   node scripts/shots.mjs            (starts its own server on :3511)
//   ONLY=neon WIDTHS=390 node scripts/shots.mjs
import { chromium } from "@playwright/test";
import { createApp } from "../server/index.js";
import { mkdir } from "node:fs/promises";

const port = 3511;
const base = `http://localhost:${port}`;
const themes = (process.env.ONLY || "midnight,neon,paper,sunset").split(",");
const widths = (process.env.WIDTHS || "390,768,1440").split(",").map(Number);
await mkdir("shots", { recursive: true });
const app = await createApp({ production: true, port });
const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const settle = (page, ms = 1400) => page.waitForTimeout(ms);

for (const theme of themes) {
  for (const width of widths) {
    const height = width < 500 ? 844 : width < 1000 ? 1024 : 900;
    const ctx = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 500,
      hasTouch: width < 1000,
      permissions: ["microphone"],
    });
    await ctx.addInitScript((t) => localStorage.setItem("sd-theme", t), theme);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const shot = async (name, full = true) => {
      await settle(page);
      await page.screenshot({
        path: `shots/${theme}-${width}-${name}.png`,
        fullPage: full,
      });
    };
    await page.goto(base);
    await shot("1-landing");
    await page
      .getByRole("button", { name: "Join a room", exact: true })
      .click();
    await page.getByLabel("Room code").fill("ABC");
    await shot("2-join-modal", false);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Create a room", exact: true })
      .click();
    await page.getByLabel("Your nickname").fill("Aditya");
    await page
      .getByRole("button", { name: "Create room", exact: true })
      .click();
    await page.getByText("Tonight’s game").waitFor();
    await shot("3-lobby");
    await page.getByRole("button", { name: "A quick mic check?" }).click();
    await page
      .getByRole("button", { name: "Test microphone", exact: true })
      .click();
    await page.waitForTimeout(700);
    await page
      .getByRole("button", { name: "Stop recording", exact: true })
      .click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page
      .getByRole("button", { name: "Four more ways to make a scene" })
      .click();
    await shot("4-lobby-modes");
    await page.getByRole("button", { name: "Room settings" }).click();
    await shot("5-settings-drawer", false);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Change theme", exact: true })
      .click();
    await shot("6-theme-picker", false);
    await page.keyboard.press("Escape");
    await ctx.close();
    if (errors.length)
      console.log(theme, width, "ERRORS", [...new Set(errors)].slice(0, 4));
  }
}
await browser.close();
await app.close();
console.log("shots done");
process.exit(0);
