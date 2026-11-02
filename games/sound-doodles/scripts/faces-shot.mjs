// Screenshots of the face gallery (dev styleguide) and the join screen's face editor into shots/.
//   node scripts/faces-shot.mjs   (needs `npm run build` first; the styleguide is dev-only, so this uses vite's dev server)
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { createApp } from "../server/index.js";
import { mkdir } from "node:fs/promises";

await mkdir("shots", { recursive: true });
const vite = await createServer({ server: { port: 5199 } });
await vite.listen();
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 1000, height: 900 },
});
const page = await ctx.newPage();
await page.goto("http://localhost:5199/#/styleguide");
await page.waitForTimeout(1500);
await page
  .locator("section[aria-label='Faces']")
  .screenshot({ path: "shots/faces-gallery.png" });
await vite.close();
await browser.close();

const app = await createApp({ production: true, port: 3514 });
const b2 = await chromium.launch({ channel: "chrome" });
for (const [name, width] of [
  ["desktop", 1000],
  ["phone", 390],
]) {
  const c = await b2.newContext({ viewport: { width, height: 900 } });
  const p = await c.newPage();
  await p.goto("http://localhost:3514");
  await p.getByRole("button", { name: "Create a room", exact: true }).click();
  await p.waitForTimeout(900);
  await p.screenshot({ path: `shots/faces-entry-${name}.png` });
  await c.close();
}
await b2.close();
await app.close();
process.exit(0);
