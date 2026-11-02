import React from "react";

// Poster art for each mode. Drawn with theme tokens so every theme repaints it.
const ink = "var(--ink)";
const art = {
  classic: (
    <>
      <rect
        x="82"
        y="22"
        width="36"
        height="58"
        rx="18"
        fill="var(--accent)"
        stroke={ink}
        strokeWidth="3"
      />
      <path
        d="M66 62q0 34 34 34t34-34M100 96v22M78 120h44"
        fill="none"
        stroke={ink}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <g
        className="art-wave"
        stroke="var(--accent-2)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M144 40q12 14 0 28" />
        <path d="M156 30q20 24 0 48" />
        <path d="M56 40q-12 14 0 28" />
        <path d="M44 30q-20 24 0 48" />
      </g>
      <g className="art-pop">
        <rect
          x="4"
          y="92"
          width="62"
          height="28"
          rx="13"
          fill="var(--surface-3)"
          stroke={ink}
          strokeWidth="2.5"
        />
        <text
          x="35"
          y="110"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill={ink}
        >
          a duck?!
        </text>
      </g>
    </>
  ),
  gartic: (
    <>
      <g className="art-step">
        <rect
          x="8"
          y="36"
          width="52"
          height="40"
          rx="10"
          fill="var(--surface-3)"
          stroke={ink}
          strokeWidth="3"
        />
        <text
          x="34"
          y="62"
          textAnchor="middle"
          fontSize="14"
          fontWeight="800"
          fill={ink}
        >
          kettle
        </text>
      </g>
      <g className="art-step">
        <rect
          x="74"
          y="52"
          width="52"
          height="40"
          rx="10"
          fill="var(--accent)"
          stroke={ink}
          strokeWidth="3"
        />
        <path
          d="M84 72h6l4-9 6 18 5-14 4 5h6"
          fill="none"
          stroke="var(--on-accent)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g className="art-step">
        <rect
          x="132"
          y="68"
          width="66"
          height="40"
          rx="10"
          fill="var(--accent-2)"
          stroke={ink}
          strokeWidth="3"
        />
        <text
          x="165"
          y="92"
          textAnchor="middle"
          fontSize="11"
          fontWeight="800"
          fill="var(--on-accent)"
        >
          spaceship?
        </text>
      </g>
      <path
        d="M60 58q7-2 14 2M126 74q7-2 14 2"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        strokeLinecap="round"
        markerEnd="url(#a)"
      />
    </>
  ),
  duo: (
    <>
      <rect
        x="40"
        y="26"
        width="34"
        height="54"
        rx="17"
        fill="var(--accent)"
        stroke={ink}
        strokeWidth="3"
      />
      <rect
        x="116"
        y="38"
        width="34"
        height="54"
        rx="17"
        fill="var(--accent-2)"
        stroke={ink}
        strokeWidth="3"
      />
      <path
        d="M32 66q0 28 25 28t25-28M108 78q0 28 25 28t25-28M57 94v18M133 106v14"
        fill="none"
        stroke={ink}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        className="art-wave"
        d="M90 40l8 10-8 10 8 10"
        fill="none"
        stroke="var(--gold)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  detective: (
    <>
      <circle
        cx="88"
        cy="62"
        r="34"
        fill="var(--surface-3)"
        stroke={ink}
        strokeWidth="5"
      />
      <path
        d="M113 87l34 34"
        stroke={ink}
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M113 87l34 34"
        stroke="var(--accent)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <text
        x="88"
        y="78"
        textAnchor="middle"
        fontSize="48"
        fontWeight="900"
        fill="var(--accent-2)"
        className="art-pop"
      >
        ?
      </text>
    </>
  ),
  foley: (
    <>
      <rect
        x="30"
        y="52"
        width="140"
        height="70"
        rx="8"
        fill="var(--surface-3)"
        stroke={ink}
        strokeWidth="4"
      />
      <g className="art-clap" style={{ transformOrigin: "30px 52px" }}>
        <rect
          x="26"
          y="26"
          width="148"
          height="26"
          rx="6"
          fill="var(--accent)"
          stroke={ink}
          strokeWidth="4"
        />
        <path
          d="M50 26l-16 26M84 26L68 52M118 26l-16 26M152 26l-16 26"
          stroke={ink}
          strokeWidth="5"
        />
      </g>
      <circle
        cx="100"
        cy="90"
        r="16"
        fill="var(--accent-2)"
        stroke={ink}
        strokeWidth="3"
      />
      <path d="M94 82l14 8-14 8z" fill="var(--on-accent)" />
    </>
  ),
  ranking: (
    <>
      <rect
        x="22"
        y="76"
        width="46"
        height="46"
        fill="var(--accent-2)"
        stroke={ink}
        strokeWidth="3.5"
      />
      <rect
        x="77"
        y="48"
        width="46"
        height="74"
        fill="var(--accent)"
        stroke={ink}
        strokeWidth="3.5"
      />
      <rect
        x="132"
        y="92"
        width="46"
        height="30"
        fill="var(--gold)"
        stroke={ink}
        strokeWidth="3.5"
      />
      <text
        x="45"
        y="106"
        textAnchor="middle"
        fontSize="26"
        fontWeight="900"
        fill="var(--on-accent)"
      >
        2
      </text>
      <text
        x="100"
        y="92"
        textAnchor="middle"
        fontSize="30"
        fontWeight="900"
        fill="var(--on-accent)"
      >
        1
      </text>
      <text
        x="155"
        y="116"
        textAnchor="middle"
        fontSize="22"
        fontWeight="900"
        fill="var(--on-accent)"
      >
        3
      </text>
      <path
        className="art-pop"
        d="m100 14 5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z"
        fill="var(--gold)"
        stroke={ink}
        strokeWidth="2.5"
      />
    </>
  ),
};

export function ModeArt({ mode }) {
  return (
    <svg
      viewBox="0 0 200 130"
      className={`mode-art art-${mode}`}
      aria-hidden="true"
    >
      {art[mode] || art.classic}
    </svg>
  );
}
