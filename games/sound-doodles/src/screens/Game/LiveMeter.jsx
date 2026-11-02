import React, { useState, useEffect } from "react";
import { EQ } from "../../ui/kit.jsx";
import { createMeter, mic } from "../../audio.js";

export function LiveMeter() {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    let cleanup,
      smooth = 0;
    const root = document.documentElement.style;
    // Ease the raw level so the character swells and settles instead of jittering.
    const follow = (raw) => {
      smooth += (raw - smooth) * (raw > smooth ? 0.5 : 0.12);
      root.setProperty("--voice", smooth.toFixed(3));
      setLevel(raw);
    };
    const t = setInterval(() => {
      if (mic.stream && !cleanup) cleanup = createMeter(mic.stream, follow);
    }, 250);
    return () => {
      clearInterval(t);
      cleanup?.();
      root.removeProperty("--voice");
    };
  }, []);
  return (
    <div className="mic-stage" aria-label="Your microphone level">
      <EQ level={level} count={32} />
    </div>
  );
}
