// Debug helper: finds what covers "Room settings" in the phone lobby.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  permissions: ["microphone"],
});
const page = await ctx.newPage();
await page.goto("http://localhost:3210");
await page.getByRole("button", { name: "Create a room", exact: true }).click();
await page.getByLabel("Your nickname").fill("Phone");
await page.getByRole("button", { name: "Create room", exact: true }).click();
await page.getByText("Tonight’s game").waitFor();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "A quick mic check?" }).click();
await page
  .getByRole("button", { name: "Test microphone", exact: true })
  .click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Stop recording", exact: true }).click();
await page.getByRole("button", { name: "Done", exact: true }).click();
await page
  .getByRole("button", { name: "Four more ways to make a scene" })
  .click();
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) =>
    b.innerText.includes("Room settings"),
  );
  btn.scrollIntoView({ block: "center" });
  const r = btn.getBoundingClientRect();
  const hit = document.elementFromPoint(
    r.left + r.width / 2,
    r.top + r.height / 2,
  );
  const stage = document.querySelector(".cast-stage").getBoundingClientRect();
  const kids = [...document.querySelectorAll(".cast-stage *")]
    .map((e) => ({
      c: String(e.className).slice(0, 24),
      b: e.getBoundingClientRect(),
    }))
    .filter(
      (x) => x.b.bottom > r.top - 5 && x.b.top < r.bottom + 5 && x.b.width > 0,
    )
    .slice(0, 6)
    .map((x) => `${x.c} ${Math.round(x.b.top)}-${Math.round(x.b.bottom)}`);
  return {
    vw: innerWidth,
    scrollW: document.documentElement.scrollWidth,
    btn: [
      Math.round(r.left),
      Math.round(r.top),
      Math.round(r.width),
      Math.round(r.height),
    ],
    hit: hit.tagName + "." + hit.className,
    stage: [Math.round(stage.top), Math.round(stage.bottom)],
    overlapping: kids,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
