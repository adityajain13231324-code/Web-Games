import React, { useState } from "react";
import { Check, Mic, Play, Plus } from "lucide-react";
import { MODES } from "../../shared/modes.js";
import { LABELS, SHAPES, formatLook, sizeOf } from "../../shared/looks.js";
import { THEME_LIST } from "../theme.js";
import { Avatar } from "../components.jsx";
import {
  Badge,
  Button,
  CountUp,
  EQ,
  IconButton,
  Skeleton,
  Slider,
  Stepper,
  TimerRing,
  Toggle,
  Tooltip,
} from "../ui/kit.jsx";
import { Popover } from "../ui/overlays.jsx";
import { Poster } from "../ui/Poster.jsx";
import { PlayerCard, GhostSlot } from "../ui/PlayerCard.jsx";
import { RoomCodeChip } from "../ui/RoomCodeChip.jsx";
import { FlipCard, Podium } from "../ui/ceremony.jsx";
import { Confetti } from "../ui/fx.jsx";
import { StageBackground } from "../ui/StageBackground.jsx";

const players = [
  { id: "a", name: "Mira", avatar: "ghost", score: 340, spectator: false },
  { id: "b", name: "Dev", avatar: "star", score: 280, spectator: false },
  { id: "c", name: "Sana", avatar: "cat", score: 190, spectator: false },
  { id: "d", name: "Leo", avatar: "robot", score: 90, spectator: false },
];

function Panel({ theme }) {
  const [on, setOn] = useState(true);
  const [vol, setVol] = useState(0.6);
  const [step, setStep] = useState(2);
  const [boom, setBoom] = useState(0);
  return (
    <section className="sg-panel" data-theme={theme.key}>
      <h2>{theme.name}</h2>
      <p className="muted">{theme.blurb}</p>

      <h3>Buttons</h3>
      <div className="sg-row">
        <Button variant="primary" icon={<Plus size={18} />}>
          Primary
        </Button>
        <Button>Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="mint" icon={<Check size={18} />}>
          Ready
        </Button>
        <Button variant="primary" loading>
          Loading
        </Button>
        <Button disabled>Disabled</Button>
        <IconButton label="Play">
          <Play size={20} />
        </IconButton>
        <Tooltip text="A tooltip">
          <IconButton label="Mic">
            <Mic size={20} />
          </IconButton>
        </Tooltip>
      </div>

      <h3>Controls</h3>
      <div className="sg-stack">
        <Toggle checked={on} onChange={setOn} label="Friendly awards vote" />
        <Slider label="Background music" value={vol} onChange={setVol} />
        <Stepper
          label="Turns"
          value={step}
          onChange={setStep}
          options={[1, 2, 3].map((n) => ({
            value: n,
            label: `${n} turn${n > 1 ? "s" : ""}`,
          }))}
        />
      </div>

      <h3>Badges, timer, EQ, numbers</h3>
      <div className="sg-row">
        <Badge>FAN FAVORITE</Badge>
        <Badge tone="mint">READY</Badge>
        <TimerRing seconds={24} total={40} />
        <TimerRing seconds={4} total={40} />
        <div style={{ width: 160 }}>
          <EQ playing count={16} />
        </div>
        <b style={{ fontSize: "2rem" }}>
          <CountUp value={1280} />
        </b>
        <Skeleton width={120} height={20} />
      </div>

      <h3>Players</h3>
      <div className="sg-row">
        <PlayerCard
          player={players[0]}
          isHost
          ready
          isYou
          status="Ready to make noise"
        />
        <PlayerCard player={players[1]} status="Getting comfy" index={1} />
        <GhostSlot n={3} index={2} />
      </div>

      <h3>Poster</h3>
      <div className="sg-row">
        <Poster
          modeKey="classic"
          mode={MODES.classic}
          selected
          onSelect={() => {}}
        />
      </div>

      <h3>Room ticket</h3>
      <RoomCodeChip code="K7QX2M" onNotify={() => {}} />

      <h3>Flip card</h3>
      <FlipCard>
        <h1>A nervous ghost</h1>
      </FlipCard>

      <h3>Podium</h3>
      <Podium players={players} />

      <h3>Popover and confetti</h3>
      <div className="sg-row">
        <Popover
          label="Example popover"
          align="start"
          trigger={({ toggle, props }) => (
            <Button onClick={toggle} {...props}>
              Open popover
            </Button>
          )}
        >
          <p className="scoring-note">
            Popovers close on outside click and Escape.
          </p>
        </Popover>
        <Button variant="primary" onClick={() => setBoom((n) => n + 1)}>
          Confetti
        </Button>
        <span style={{ position: "relative" }}>
          {boom > 0 && <Confetti key={boom} count={36} small origin="0% 0%" />}
        </span>
        <Avatar kind="frog" size={64} animated />
        <Avatar
          kind="flower"
          size={64}
          animated
          reactive
          style={{ "--voice": 0.6 }}
        />
      </div>
    </section>
  );
}

/** Every face feature on its own, so a bad hat or mouth is easy to spot. */
function FaceGallery() {
  const base = { shape: 0, color: 0, eyes: 0, mouth: 0, hat: 0, extra: 0 };
  const rows = [
    [
      "shape",
      "Bodies",
      (i) => ({ shape: i, color: [0, 1, 2, 3, 4, 6, 8, 5][i], hat: 0 }),
    ],
    ["color", "Colours", (i) => ({ color: i, shape: i % SHAPES.length })],
    ["eyes", "Eyes", (i) => ({ eyes: i, shape: 3, color: 1 })],
    ["mouth", "Mouths", (i) => ({ mouth: i, shape: 2, color: 2 })],
    [
      "hat",
      "Hats",
      (i) => ({ hat: i, shape: i % SHAPES.length, color: (i * 5) % 12 }),
    ],
    [
      "extra",
      "Extras",
      (i) => ({
        extra: i,
        shape: 5,
        color: 6,
        eyes: i === 3 || i === 5 ? 0 : 1,
      }),
    ],
  ];
  return (
    <section className="sg-panel" aria-label="Faces">
      <h2>Faces</h2>
      {rows.map(([trait, title, make]) => (
        <div key={trait} className="sg-faces">
          <h3>{title}</h3>
          <div>
            {Array.from({ length: sizeOf(trait) }, (_, i) => (
              <figure key={i}>
                <Avatar kind={formatLook({ ...base, ...make(i) })} size={74} />
                <figcaption>{LABELS[trait][i]}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/** Dev-only: every component in all four themes, side by side. Open /styleguide or #/styleguide. */
export function Styleguide() {
  return (
    <div className="styleguide">
      <StageBackground />
      <header>
        <h1>Sound Doodles styleguide</h1>
        <p className="muted">
          Every component in every theme. Development only.
        </p>
      </header>
      <FaceGallery />
      <div className="sg-grid">
        {THEME_LIST.map((t) => (
          <Panel key={t.key} theme={t} />
        ))}
      </div>
    </div>
  );
}
