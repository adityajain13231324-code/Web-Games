// Customizable faces. A "look" is one string, "shape.color.eyes.mouth.hat.extra" (for example "cat.3.1.4.2.0"),
// so it travels through the server like the old plain avatar name did and can be validated with a regular expression.
// A plain shape name ("ghost") is still understood and means that shape with its default colour and a plain face.
export const SHAPES = [
  "blob",
  "star",
  "ghost",
  "cat",
  "robot",
  "frog",
  "cloud",
  "flower",
];
export const COLORS = [
  "#9b7bff",
  "#ffc233",
  "#3fd6a0",
  "#ff7a66",
  "#4aa8ff",
  "#ff7ac8",
  "#b6e14c",
  "#ff9f43",
  "#3dd9d6",
  "#c9b6ff",
  "#ff5d73",
  "#cdb48a",
];
export const LABELS = {
  shape: ["Blob", "Star", "Ghost", "Cat", "Robot", "Frog", "Cloud", "Flower"],
  color: [
    "Violet",
    "Sunny",
    "Mint",
    "Coral",
    "Sky",
    "Bubblegum",
    "Lime",
    "Orange",
    "Teal",
    "Lavender",
    "Tomato",
    "Biscuit",
  ],
  eyes: [
    "Classic",
    "Googly",
    "Happy",
    "Sleepy",
    "Wink",
    "Starry",
    "Lovestruck",
    "Grumpy",
    "Shades",
    "Dizzy",
  ],
  mouth: [
    "Smile",
    "Big grin",
    "Meh",
    "Tongue out",
    "Oh!",
    "Toothy",
    "Smirk",
    "Cat mouth",
  ],
  hat: [
    "No hat",
    "Party hat",
    "Crown",
    "Top hat",
    "Beanie",
    "Cowboy hat",
    "Chef hat",
    "Halo",
    "Devil horns",
    "Bow",
    "Flower",
    "Headphones",
    "Wizard hat",
    "Traffic cone",
    "Sprout",
  ],
  extra: [
    "Nothing",
    "Moustache",
    "Rosy cheeks",
    "Round specs",
    "Freckles",
    "Eyepatch",
    "Plaster",
  ],
};
export const TRAITS = ["shape", "color", "eyes", "mouth", "hat", "extra"];
const SIZES = {
  shape: SHAPES.length,
  color: COLORS.length,
  eyes: LABELS.eyes.length,
  mouth: LABELS.mouth.length,
  hat: LABELS.hat.length,
  extra: LABELS.extra.length,
};
// The colour each plain legacy shape used to have.
const LEGACY_COLOR = {
  blob: 0,
  star: 1,
  ghost: 2,
  cat: 3,
  robot: 4,
  frog: 6,
  cloud: 8,
  flower: 5,
};
const PATTERN =
  /^([a-z]+)\.(\d{1,2})\.(\d{1,2})\.(\d{1,2})\.(\d{1,2})\.(\d{1,2})$/;

/** Parses a look string. Returns { shape, color, eyes, mouth, hat, extra } (shape is an index) or null if it is not valid. */
export function parseLook(value) {
  if (typeof value !== "string") return null;
  const plain = SHAPES.indexOf(value);
  if (plain >= 0)
    return {
      shape: plain,
      color: LEGACY_COLOR[value],
      eyes: 0,
      mouth: 0,
      hat: 0,
      extra: 0,
    };
  const m = PATTERN.exec(value);
  if (!m) return null;
  const look = {
    shape: SHAPES.indexOf(m[1]),
    color: Number(m[2]),
    eyes: Number(m[3]),
    mouth: Number(m[4]),
    hat: Number(m[5]),
    extra: Number(m[6]),
  };
  if (look.shape < 0) return null;
  for (const t of TRAITS) if (look[t] >= SIZES[t]) return null;
  return look;
}
export function formatLook(l) {
  return `${SHAPES[l.shape]}.${l.color}.${l.eyes}.${l.mouth}.${l.hat}.${l.extra}`;
}
/** A random look. `rand` returns a number in [0, 1) so the server can use a secure source. */
export function randomLook(rand = Math.random) {
  const pick = (n) => Math.floor(rand() * n);
  return {
    shape: pick(SIZES.shape),
    color: pick(SIZES.color),
    eyes: pick(SIZES.eyes),
    mouth: pick(SIZES.mouth),
    // Half of all faces go hat-less, so a hat still feels like a surprise.
    hat: rand() < 0.5 ? 0 : pick(SIZES.hat),
    extra: rand() < 0.55 ? 0 : pick(SIZES.extra),
  };
}
export function sizeOf(trait) {
  return SIZES[trait];
}
