// Theme engine: persistence, pre-paint application, crossfade, tab-visibility pausing and motion preference.
export const THEME_KEY = "sd-theme";
export const MOTION_KEY = "sd-reduce-motion";
export const THEME_LIST = [
  { key: "paper", name: "Paper Playground", blurb: "Good old scribbly fun." },
  { key: "midnight", name: "Midnight Studio", blurb: "A little after hours." },
  { key: "neon", name: "Neon Arcade", blurb: "Turn up the electric." },
  { key: "sunset", name: "Sunset Lounge", blurb: "Stay for one more round." },
  { key: "sky", name: "Cloud Nine", blurb: "Light, breezy and cool." },
  { key: "pop", name: "Bubblegum Pop", blurb: "Hearts, sparkle, zero chill." },
];
const META = {
  midnight: "#0e0e1b",
  neon: "#060a1c",
  paper: "#f5eddb",
  sunset: "#2a1238",
  sky: "#cfe7fb",
  pop: "#ffd9ea",
};

export const prefersReducedMotion = () =>
  document.documentElement.dataset.motion === "reduce" ||
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function applyTheme(key) {
  const root = document.documentElement;
  if (!META[key]) key = "paper";
  const set = () => {
    root.dataset.theme = key;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", META[key]);
  };
  if (root.dataset.theme === key) return set();
  if (
    document.startViewTransition &&
    !prefersReducedMotion() &&
    root.dataset.theme
  )
    document.startViewTransition(set);
  else set();
  try {
    localStorage.setItem(THEME_KEY, key);
  } catch {}
}

export function applyMotion(reduce) {
  if (reduce) document.documentElement.dataset.motion = "reduce";
  else delete document.documentElement.dataset.motion;
  try {
    localStorage.setItem(MOTION_KEY, reduce ? "1" : "0");
  } catch {}
}

/** Pause ambient animation while the tab is hidden. Returns a cleanup function. */
export function watchVisibility() {
  const update = () => {
    if (document.hidden) document.documentElement.dataset.hidden = "";
    else delete document.documentElement.dataset.hidden;
  };
  document.addEventListener("visibilitychange", update);
  update();
  return () => document.removeEventListener("visibilitychange", update);
}

export const FX_KEY = "sd-fx";
/** "Lite" turns off blurs and moving backdrops, which helps older phones feel snappy. */
export function applyFx(lite) {
  if (lite) document.documentElement.dataset.fx = "lite";
  else delete document.documentElement.dataset.fx;
  try {
    localStorage.setItem(FX_KEY, lite ? "lite" : "full");
  } catch {}
}
