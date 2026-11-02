// WCAG contrast check for every theme in src/styles/tokens.css.  node scripts/contrast.mjs
import { readFileSync } from "node:fs";
const css = readFileSync(
  new URL("../src/styles/tokens.css", import.meta.url),
  "utf8",
);
const blocks = [
  ...css.matchAll(
    /(?:^|\n)((?::root,\s*)?\[data-theme="(\w+)"\])\s*\{([^}]*)\}/g,
  ),
];
const themes = {};
for (const [, , name, body] of blocks) {
  const vars = {};
  for (const [, k, v] of body.matchAll(/--([\w-]+):\s*([^;]+);/g))
    vars[k] = v.trim();
  themes[name] = vars;
}
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255]
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
let fail = 0;
for (const [name, v] of Object.entries(themes)) {
  const get = (k) => {
    let val = v[k];
    const ref = /^var\(--([\w-]+)\)$/.exec(val || "");
    if (ref) val = get(ref[1]);
    return val;
  };
  const checks = [
    ["text on bg", "text", "bg", 4.5],
    ["text on surface", "text", "surface", 4.5],
    ["text on surface-2", "text", "surface-2", 4.5],
    ["muted on bg", "muted", "bg", 4.5],
    ["muted on surface", "muted", "surface", 4.5],
    ["muted on surface-2", "muted", "surface-2", 4.5],
    ["on-accent on accent", "on-accent", "accent", 4.5],
    ["accent on bg (text)", "accent", "bg", 4.5],
    ["accent on surface (text)", "accent", "surface", 4.5],
    ["on-accent on accent-2", "on-accent", "accent-2", 3],
    ["mint on surface", "mint", "surface", 4.5],
    ["coral on surface", "coral", "surface", 4.5],
    ["blue on surface", "blue", "surface", 3],
    ["violet on surface", "violet", "surface", 4.5],
  ];
  const rows = checks.map(([label, a, b, min]) => {
    const r = ratio(get(a), get(b));
    return { label, r, min, ok: r >= min };
  });
  const bad = rows.filter((r) => !r.ok);
  fail += bad.length;
  console.log(
    `${name.padEnd(9)} ${bad.length ? "FAIL" : "ok"}  ${bad.map((r) => `${r.label} ${r.r.toFixed(2)}<${r.min}`).join("; ")}`,
  );
}
if (process.argv.includes("--strict") && fail) process.exit(1);
