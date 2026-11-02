import React from "react";
import { ArrowRight, Headphones, Mic, Plus, Users } from "lucide-react";
import { MODES } from "../../shared/modes.js";
import { Avatar } from "../components.jsx";
import { Poster } from "../ui/Poster.jsx";
import { Button } from "../ui/kit.jsx";

// Faces for the floating cast: a spread of bodies, colours, hats and expressions.
const CAST_LOOKS = [
  "blob.0.1.0.4.0",
  "cloud.4.2.1.0.2",
  "ghost.2.5.3.0.0",
  "robot.4.8.2.12.0",
  "flower.5.4.6.0.1",
  "frog.6.0.5.3.3",
  "cat.3.6.7.8.0",
  "star.1.9.1.2.0",
];
// Where the floating cast drifts behind the headline.
const CAST = [
  ["3%", "6%", "-10deg", "7s"],
  ["87%", "4%", "12deg", "9s"],
  ["1%", "52%", "8deg", "8s"],
  ["90%", "50%", "-12deg", "10s"],
  ["12%", "82%", "-6deg", "9s"],
  ["80%", "80%", "10deg", "7.5s"],
  ["16%", "26%", "7deg", "11s"],
  ["78%", "26%", "-9deg", "8.5s"],
];

const Words = ({ children, start }) => (
  <span className="line">
    {children.split(" ").map((w, i) => (
      <span key={i} style={{ "--w": start + i }}>
        {w}
        {" "}
      </span>
    ))}
  </span>
);

export function Landing({ onCreate, onJoin, onHelp }) {
  const extras = Object.entries(MODES).slice(2);
  return (
    <div className="land">
      <section className="land-hero">
        <div className="land-cast" aria-hidden="true">
          {CAST.map(([x, y, r, d], i) => (
            <Avatar
              key={i}
              kind={CAST_LOOKS[i % CAST_LOOKS.length]}
              size={i % 3 === 0 ? 86 : 64}
              animated
              style={{
                "--x": x,
                "--y": y,
                "--r": r,
                "--d": d,
                "--bob-delay": `${-i}s`,
              }}
            />
          ))}
        </div>
        <div className="eyebrow">
          <span className="status-dot" /> A PARTY GAME FOR YOUR VOICE
        </div>
        <h1 className="land-title">
          <Words start={0}>Make some</Words>
          <span className="line">
            <span style={{ "--w": 2 }}>
              <em>noise.</em>
              {" "}
            </span>
          </span>
          <Words start={3}>Make a mess.</Words>
        </h1>
        <p className="land-sub">
          Your friends. A mystery sound. Absolutely no dignity. Turn your best
          (or worst) impressions into a game night.
        </p>
        <div className="land-actions">
          <Button
            variant="primary"
            size="lg"
            icon={<Plus size={22} />}
            onClick={() => onCreate()}
          >
            Create a room
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={<ArrowRight size={22} />}
            onClick={onJoin}
          >
            Join a room
          </Button>
        </div>
        <div className="land-meta">
          <span>
            <Users size={16} /> 2–8 friends
          </span>
          <span>
            <Mic size={16} /> Bring your voice
          </span>
          <span>
            <Headphones size={16} /> Headphones recommended
          </span>
        </div>
      </section>

      <section className="land-modes" aria-labelledby="modes-title">
        <div className="land-modes-head">
          <div>
            <span className="eyebrow">PICK YOUR KIND OF CHAOS</span>
            <h2 id="modes-title">Same friends. New noises.</h2>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onHelp}
          >
            How it works
          </button>
        </div>
        <div className="posters">
          {["classic", "gartic"].map((key, i) => (
            <Poster
              key={key}
              index={i}
              modeKey={key}
              mode={MODES[key]}
              onSelect={onCreate}
            />
          ))}
        </div>
        <div className="posters posters-more">
          {extras.map(([key, m], i) => (
            <Poster
              key={key}
              index={i + 2}
              modeKey={key}
              mode={m}
              compact
              onSelect={onCreate}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
