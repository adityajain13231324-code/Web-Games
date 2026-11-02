import React, { useState, useEffect } from "react";
import { audioPrefs, cue, saveAudio } from "../audio.js";
import { announcerAvailable, syncMusic } from "../ambience.js";
import { applyFx, applyMotion } from "../theme.js";
import { Button, Slider, Toggle } from "../ui/kit.jsx";
import { sfx } from "../ui/sfx.js";
import { Volume2 } from "lucide-react";

const SLIDERS = [
  ["voice", "Player voices"],
  ["effects", "Game sound effects"],
  ["announcements", "Announcer lines"],
  ["music", "Background music"],
];

/** Sound and motion preferences. Reduce motion mirrors the OS setting but can be flipped here too. */
export function AudioSettings() {
  const [prefs, setPrefs] = useState({ ...audioPrefs });
  const [hasAnnouncer, setHasAnnouncer] = useState(true);
  const [reduce, setReduce] = useState(
    document.documentElement.dataset.motion === "reduce",
  );
  const [lite, setLite] = useState(
    document.documentElement.dataset.fx === "lite",
  );
  useEffect(() => {
    announcerAvailable().then(setHasAnnouncer);
  }, []);
  return (
    <div className="sound-motion">
      <p className="muted">
        Player voices always come first. Effects pause during live audio,
        recording, and reveal playback.
      </p>
      {SLIDERS.map(([key, label]) => (
        <Slider
          key={key}
          label={label}
          value={prefs[key]}
          onChange={(v) => {
            audioPrefs[key] = v;
            setPrefs({ ...audioPrefs });
            saveAudio();
            if (key === "music") syncMusic();
          }}
        />
      ))}
      <Button
        variant="secondary"
        icon={<Volume2 size={17} />}
        onClick={() => {
          cue("confirm");
          sfx("success");
        }}
      >
        Preview effects
      </Button>
      <h3 className="settings-heading">Motion</h3>
      <Toggle
        checked={reduce}
        onChange={(v) => {
          setReduce(v);
          applyMotion(v);
        }}
        label="Reduce motion"
      />
      <Toggle
        checked={lite}
        onChange={(v) => {
          setLite(v);
          applyFx(v);
        }}
        label="Lite effects (faster on older phones)"
      />
      <p className="small muted">
        Turns off blurs and moving backgrounds. If buttons feel slow, try this
        first.
      </p>
      <p className="small muted">
        Calms animation, background movement and confetti. Your device’s own
        “reduce motion” setting is respected automatically.
      </p>
      <p className="small muted">
        Music is a quiet synthesized loop and pauses while anyone performs or
        records.
        {!hasAnnouncer &&
          " Announcer voice files are not installed on this server, so that slider has no effect yet."}{" "}
        Live audio uses peer connections. Some networks require a TURN relay
        configured by the host operator.
      </p>
    </div>
  );
}
