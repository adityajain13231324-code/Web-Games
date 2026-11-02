// Full-page landing screenshots per theme and width into shots/landing-<theme>-<width>.png.
//   node scripts/landing-shots.mjs   (needs `npm run build` first)
import { chromium } from "@playwright/test";
import { createApp } from "../server/index.js";
import { mkdir } from "node:fs/promises";

const port = 3512;
const themes = (process.env.ONLY || "paper,midnight,neon,sunset").split(",");
const widths = (process.env.WIDTHS || "390,768,1440").split(",").map(Number);
await mkdir("shots", { recursive: true });
const app = await createApp({ production: true, port });
const browser = await chromium.launch({ channel: "chrome" });
for (const theme of themes) {
  for (const width of widths) {
    const ctx = await browser.newContext({
      viewport: { width, height: width < 500 ? 844 : 900 },
    });
    await ctx.addInitScript((t) => localStorage.setItem("sd-theme", t), theme);
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${port}`);
    await page.waitForTimeout(1800);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    await page.screenshot({
      path: `shots/landing-${theme}-${width}.png`,
      fullPage: true,
    });
    console.log(theme, width, overflow ? "HORIZONTAL OVERFLOW" : "ok");
    await ctx.close();
  }
}
await browser.close();
process.exit(0);
