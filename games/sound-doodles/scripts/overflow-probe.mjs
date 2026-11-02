// Lists elements that stick out past the right edge on a phone, per theme and screen.
//   THEMES=pop,sky node scripts/overflow-probe.mjs
import { chromium } from "@playwright/test";
import { createApp } from "../server/index.js";

const themes = (process.env.THEMES || "pop,sky").split(",");
const app = await createApp({ production: true, port: 3518 });
const browser = await chromium.launch({ channel: "chrome" });
const probe = (page) =>
  page.evaluate(() => {
    const w = innerWidth;
    const out = [];
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > w + 1 && !el.closest(".stage-bg"))
        out.push(
          `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(r.right)}`,
        );
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      w,
      out: out.slice(0, 8),
    };
  });
for (const theme of themes) {
  const ctx = await browser.newContext({
    viewport: { width: Number(process.env.W || 390), height: 844 },
  });
  await ctx.addInitScript((t) => localStorage.setItem("sd-theme", t), theme);
  const page = await ctx.newPage();
  await page.goto("http://localhost:3518");
  await page.waitForTimeout(800);
  console.log(theme, "landing", JSON.stringify(await probe(page)));
  await page
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  await page.getByLabel("Your nickname").fill("Probe");
  await page.keyboard.press("Enter");
  await page.getByText("Tonight’s game").waitFor();
  await page.waitForTimeout(800);
  console.log(theme, "lobby", JSON.stringify(await probe(page)));
  await ctx.close();
}
await browser.close();
await app.close();
process.exit(0);
