import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { THEME_LIST } from "../src/theme.js";

const tokens = readFileSync(
  new URL("../src/styles/tokens.css", import.meta.url),
  "utf8",
);

test("every listed theme has tokens, and Paper stays the first (default) theme", () => {
  assert.equal(THEME_LIST[0].key, "paper");
  assert.deepEqual(THEME_LIST.map((t) => t.key).sort(), [
    "midnight",
    "neon",
    "paper",
    "pop",
    "sky",
    "sunset",
  ]);
  for (const { key } of THEME_LIST)
    assert.ok(
      tokens.includes(`[data-theme="${key}"]`),
      `${key} has a token block`,
    );
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(
    html.includes('t || "paper"'),
    "the pre-paint script defaults to paper",
  );
});

test("every theme meets WCAG AA contrast for text, muted text and accent buttons", () => {
  // exits non-zero (and throws here) when any pair falls below its minimum
  const out = execFileSync(
    process.execPath,
    ["scripts/contrast.mjs", "--strict"],
    { encoding: "utf8" },
  );
  for (const { key } of THEME_LIST)
    assert.ok(new RegExp(`${key}\\s+ok`).test(out), `${key} passes`);
});
