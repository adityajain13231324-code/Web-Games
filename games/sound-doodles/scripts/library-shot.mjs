// Screenshot of the word library with a few packs mixed, to shots/library-mix.png.
//   node scripts/library-shot.mjs   (needs `npm run build` first)
import { chromium } from "@playwright/test";
import { createApp } from "../server/index.js";
import { mkdir } from "node:fs/promises";

const port = 3513;
await mkdir("shots", { recursive: true });
const app = await createApp({ production: true, port });
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: Number(process.env.W || 1280), height: 900 },
});
const page = await ctx.newPage();
await page.goto(`http://localhost:${port}`);
await page.getByRole("button", { name: "Create a room", exact: true }).click();
await page.getByLabel("Your nickname").fill("Host");
await page.getByRole("button", { name: "Create room", exact: true }).click();
await page.getByText("Tonight’s game").waitFor();
await page.getByRole("button", { name: "Room settings" }).click();
await page.getByRole("button", { name: "Browse the word library" }).click();
const card = (name) => page.locator(".lib-card").filter({ hasText: name });
await card("Animals").getByRole("button").click();
await card("Food").getByRole("button", { name: "Add to the mix" }).click();
await card("Sound ideas")
  .getByRole("button", { name: "Add to the mix" })
  .click();
await page.waitForTimeout(900);
await page.screenshot({ path: "shots/library-mix.png" });
await browser.close();
await app.close();
process.exit(0);
