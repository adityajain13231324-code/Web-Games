import React from "react";

// SVG parts for the customizable faces (see shared/looks.js). Every part is drawn for the 80x80 avatar canvas:
// eyes sit at y=40 (x=30 and x=50), the mouth around y=52, and hats are drawn with 0,0 at the top of the head.
const INK = "#222231";
const line = {
  fill: "none",
  stroke: INK,
  strokeWidth: 3,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
const outline = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round" };

const star = (cx, cy, r) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rad = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`;
  });
  return pts.join(" ");
};
const heart = (cx, cy) =>
  `M${cx} ${cy + 6}C${cx - 10} ${cy - 1} ${cx - 5} ${cy - 9} ${cx} ${cy - 3}C${cx + 5} ${cy - 9} ${cx + 10} ${cy - 1} ${cx} ${cy + 6}Z`;

export const EYES = [
  // Classic
  <>
    <ellipse cx="30" cy="40" rx="3" ry="5" fill={INK} />
    <ellipse cx="50" cy="40" rx="3" ry="5" fill={INK} />
  </>,
  // Googly
  <>
    {[30, 50].map((x, i) => (
      <g key={x}>
        <circle
          cx={x}
          cy="40"
          r="7.5"
          fill="#fff"
          stroke={INK}
          strokeWidth="2"
        />
        <circle cx={x + (i ? -1 : 1.5)} cy="42" r="3.4" fill={INK} />
      </g>
    ))}
  </>,
  // Happy
  <>
    <path d="M24 42q6-10 12 0" {...line} />
    <path d="M44 42q6-10 12 0" {...line} />
  </>,
  // Sleepy
  <>
    <path d="M24 41q6 5 12 0" {...line} />
    <path d="M44 41q6 5 12 0" {...line} />
    <path d="M22 37l3 2M58 37l-3 2" {...line} strokeWidth="2" />
  </>,
  // Wink
  <>
    <ellipse cx="30" cy="40" rx="3" ry="5" fill={INK} />
    <path d="M44 41q6-8 12 0" {...line} />
  </>,
  // Starry
  <>
    <polygon
      points={star(30, 40, 8.5)}
      fill="#ffd34d"
      {...outline}
      strokeWidth="1.6"
    />
    <polygon
      points={star(50, 40, 8.5)}
      fill="#ffd34d"
      {...outline}
      strokeWidth="1.6"
    />
  </>,
  // Lovestruck
  <>
    <path d={heart(30, 40)} fill="#ff4f7b" {...outline} strokeWidth="1.5" />
    <path d={heart(50, 40)} fill="#ff4f7b" {...outline} strokeWidth="1.5" />
  </>,
  // Grumpy
  <>
    <circle cx="30" cy="42" r="3.4" fill={INK} />
    <circle cx="50" cy="42" r="3.4" fill={INK} />
    <path d="M22 33l12 5M58 33l-12 5" {...line} strokeWidth="3.2" />
  </>,
  // Shades
  <>
    <rect x="19" y="34" width="19" height="12" rx="5" fill={INK} />
    <rect x="42" y="34" width="19" height="12" rx="5" fill={INK} />
    <path d="M38 38h4" {...line} strokeWidth="2.5" />
    <path
      d="M23 38l5 0M46 38l5 0"
      stroke="#fff"
      strokeWidth="1.6"
      strokeLinecap="round"
      opacity="0.7"
    />
  </>,
  // Dizzy
  <>
    <path d="M25 35l10 10M35 35l-10 10" {...line} strokeWidth="2.8" />
    <path d="M45 35l10 10M55 35l-10 10" {...line} strokeWidth="2.8" />
  </>,
];

export const MOUTHS = [
  // Smile
  <path d="M34 51q6 6 12 0" {...line} />,
  // Big grin
  <>
    <path d="M29 49q11 3 22 0q-1 14-11 14t-11-14z" fill={INK} />
    <ellipse cx="40" cy="59" rx="5" ry="2.6" fill="#ff7a9a" />
  </>,
  // Meh
  <path d="M33 54h14" {...line} />,
  // Tongue out
  <>
    <path d="M33 51q7 6 14 0" {...line} />
    <path
      d="M37 54v5a3 3 0 0 0 6 0v-5"
      fill="#ff7a9a"
      {...outline}
      strokeWidth="1.6"
    />
  </>,
  // Oh!
  <ellipse cx="40" cy="55" rx="4" ry="5" fill={INK} />,
  // Toothy
  <>
    <rect
      x="30"
      y="50"
      width="20"
      height="10"
      rx="3.5"
      fill="#fff"
      {...outline}
    />
    <path d="M40 50v10M30 55h20" stroke={INK} strokeWidth="1.4" />
  </>,
  // Smirk
  <path d="M33 55q10 3 15-5" {...line} />,
  // Cat mouth
  <path d="M32 52q4 6 8 0q4 6 8 0" {...line} strokeWidth="2.6" />,
];

// Hats: 0,0 is the top centre of the head, +y goes into the head, anything above is drawn at negative y.
export const HATS = [
  null,
  // Party hat
  <>
    <polygon points="-14,3 14,3 0,-27" fill="#ff6ba8" {...outline} />
    <path
      d="M-8 -9l12 12M-3 -17l12 12"
      stroke="#fff"
      strokeWidth="2.4"
      opacity="0.8"
    />
    <circle
      cx="0"
      cy="-28"
      r="4"
      fill="#ffd34d"
      {...outline}
      strokeWidth="1.6"
    />
  </>,
  // Crown
  <>
    <path
      d="M-15 3l-3-19 9 7 9-13 9 13 9-7-3 19z"
      fill="#ffc233"
      {...outline}
    />
    <circle cx="-8" cy="-2" r="2" fill="#ff5d73" />
    <circle cx="0" cy="-2" r="2" fill="#4aa8ff" />
    <circle cx="8" cy="-2" r="2" fill="#ff5d73" />
  </>,
  // Top hat
  <>
    <rect
      x="-11"
      y="-24"
      width="22"
      height="26"
      rx="2"
      fill="#34344a"
      {...outline}
    />
    <rect x="-11" y="-8" width="22" height="5" fill="#ff5d73" />
    <rect
      x="-19"
      y="0"
      width="38"
      height="5"
      rx="2.5"
      fill="#34344a"
      {...outline}
    />
  </>,
  // Beanie
  <>
    <path d="M-16 3a16 16 0 0 1 32 0z" fill="#4aa8ff" {...outline} />
    <rect
      x="-17"
      y="-2"
      width="34"
      height="7"
      rx="3"
      fill="#ff7ac8"
      {...outline}
    />
    <circle
      cx="0"
      cy="-14"
      r="5"
      fill="#ffd34d"
      {...outline}
      strokeWidth="1.6"
    />
  </>,
  // Cowboy hat
  <>
    <path d="M-12 2q0-20 12-18q12-2 12 18z" fill="#b9793d" {...outline} />
    <path
      d="M-23 4q11 6 23 1q12 5 23-1q-3-5-12-5h-22q-9 0-12 5z"
      fill="#a6652e"
      {...outline}
    />
    <rect x="-12" y="-4" width="24" height="3.5" fill="#6b3f1d" />
  </>,
  // Chef hat
  <>
    <path
      d="M-12 3v-9a8 8 0 0 1 4-14a8 8 0 0 1 8-3a8 8 0 0 1 8 3a8 8 0 0 1 4 14v9z"
      fill="#fff"
      {...outline}
    />
    <path d="M-12 -3h24" stroke="#cfd3e2" strokeWidth="2" />
  </>,
  // Halo
  <>
    <ellipse
      cx="0"
      cy="-11"
      rx="15"
      ry="4.5"
      fill="none"
      stroke="#ffd34d"
      strokeWidth="4"
    />
    <ellipse
      cx="0"
      cy="-11"
      rx="15"
      ry="4.5"
      fill="none"
      stroke={INK}
      strokeWidth="1"
      opacity="0.5"
    />
  </>,
  // Devil horns
  <>
    <path d="M-17 6q-9-8-4-19q4 7 12 9z" fill="#ff3d4d" {...outline} />
    <path d="M17 6q9-8 4-19q-4 7-12 9z" fill="#ff3d4d" {...outline} />
  </>,
  // Bow
  <g transform="translate(14 -3) rotate(18)">
    <path d="M0 0l-12-8v16z" fill="#ff7ac8" {...outline} strokeWidth="1.8" />
    <path d="M0 0l12-8v16z" fill="#ff7ac8" {...outline} strokeWidth="1.8" />
    <circle r="3.2" fill="#e24a98" {...outline} strokeWidth="1.6" />
  </g>,
  // Flower
  <g transform="translate(15 -3)">
    {[0, 72, 144, 216, 288].map((a) => (
      <circle
        key={a}
        cx={Math.cos((a * Math.PI) / 180) * 6}
        cy={Math.sin((a * Math.PI) / 180) * 6}
        r="4.6"
        fill="#ff7ac8"
        stroke={INK}
        strokeWidth="1.4"
      />
    ))}
    <circle r="3.6" fill="#ffd34d" stroke={INK} strokeWidth="1.4" />
  </g>,
  // Headphones
  <>
    <path
      d="M-22 22a22 24 0 0 1 44 0"
      fill="none"
      stroke={INK}
      strokeWidth="4.5"
      strokeLinecap="round"
    />
    <rect
      x="-27"
      y="14"
      width="9"
      height="16"
      rx="4"
      fill="#ff7a66"
      {...outline}
    />
    <rect
      x="18"
      y="14"
      width="9"
      height="16"
      rx="4"
      fill="#ff7a66"
      {...outline}
    />
  </>,
  // Wizard hat
  <>
    <path d="M-16 3q4-24 14-36q4 14 18 36z" fill="#6c4cd9" {...outline} />
    <path d="M-23 4q23 7 46 0q-3-5-23-5t-23 5z" fill="#5b3cc4" {...outline} />
    <polygon points={star(-1, -13, 4)} fill="#ffd34d" />
    <circle cx="6" cy="-4" r="1.5" fill="#ffd34d" />
  </>,
  // Traffic cone
  <>
    <path d="M-13 3l7-27h12l7 27z" fill="#ff8a3d" {...outline} />
    <path d="M-9 -9h18l-1.8 7h-14.4z" fill="#fff" />
    <rect
      x="-16"
      y="2"
      width="32"
      height="4"
      rx="2"
      fill="#e8741f"
      {...outline}
      strokeWidth="1.6"
    />
  </>,
  // Sprout
  <>
    <path
      d="M0 4q0-9 1-14"
      fill="none"
      stroke="#2f9e55"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path
      d="M1 -10q-4-10-14-8q2 10 14 8z"
      fill="#5ad07a"
      {...outline}
      strokeWidth="1.6"
    />
    <path
      d="M1 -10q4-10 14-8q-2 10-14 8z"
      fill="#7be08f"
      {...outline}
      strokeWidth="1.6"
    />
  </>,
];

// Where the top of the head is for each shape (the hat sits there).
export const HEAD_TOP = {
  blob: 11,
  star: 9,
  ghost: 10,
  cat: 22,
  robot: 22,
  frog: 18,
  cloud: 12,
  flower: 10,
};

// Extras are drawn over the face, under the hat.
export const EXTRAS = [
  null,
  // Moustache
  <path
    d="M40 50q-3-4-10-3q-5 1-6 4q7 0 12 1q3 1 4 4q1-3 4-4q5-1 12-1q-1-3-6-4q-7-1-10 3z"
    fill={INK}
  />,
  // Rosy cheeks
  <>
    <ellipse cx="22" cy="50" rx="6" ry="3.6" fill="#ff4f7b" opacity="0.55" />
    <ellipse cx="58" cy="50" rx="6" ry="3.6" fill="#ff4f7b" opacity="0.55" />
  </>,
  // Round specs
  <>
    <circle
      cx="30"
      cy="40"
      r="9"
      fill="#fff"
      fillOpacity="0.18"
      stroke={INK}
      strokeWidth="2.4"
    />
    <circle
      cx="50"
      cy="40"
      r="9"
      fill="#fff"
      fillOpacity="0.18"
      stroke={INK}
      strokeWidth="2.4"
    />
    <path d="M39 39q1-2 2 0" {...line} strokeWidth="2" />
  </>,
  // Freckles
  <>
    {[
      [22, 49],
      [26, 52],
      [30, 49],
      [50, 49],
      [54, 52],
      [58, 49],
    ].map(([x, y]) => (
      <circle key={`${x}${y}`} cx={x} cy={y} r="1.4" fill={INK} opacity="0.6" />
    ))}
  </>,
  // Eyepatch
  <>
    <path d="M14 30L66 46" stroke={INK} strokeWidth="2.2" />
    <ellipse
      cx="30"
      cy="40"
      rx="8.5"
      ry="7.5"
      fill={INK}
      transform="rotate(14 30 40)"
    />
  </>,
  // Plaster
  <g transform="rotate(-24 55 52)">
    <rect
      x="46"
      y="47"
      width="18"
      height="8"
      rx="4"
      fill="#f4c9a0"
      {...outline}
      strokeWidth="1.6"
    />
    <rect x="52" y="47.8" width="6" height="6.4" fill="#e3a978" />
  </g>,
];
