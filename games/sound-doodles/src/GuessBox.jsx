import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";

// A guess box that answers back: every try appears under the field and is marked as a
// found part, or "not quite". Feedback is visual only, so it never competes with the performer's audio.
export function GuessBox({ progress, onGuess }) {
  const [value, setValue] = useState("");
  const [tries, setTries] = useState([]);
  const [shaking, setShaking] = useState(false);
  const found = progress?.components?.length || 0;
  const seen = useRef(found);
  const pending = useRef(null);
  const timer = useRef(null);

  const settle = (status) => {
    const id = pending.current;
    if (id === null) return;
    pending.current = null;
    clearTimeout(timer.current);
    setTries((all) => all.map((t) => (t.id === id ? { ...t, status } : t)));
    if (status === "miss") {
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
    }
  };

  useEffect(() => {
    if (found > seen.current) settle("part");
    seen.current = found;
  }, [found]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="guess-box">
      <form
        className={`text-action ${shaking ? "shake" : ""}`}
        onSubmit={async (e) => {
          e.preventDefault();
          const text = value.trim();
          if (!text) return;
          const id = Date.now();
          pending.current = id;
          setTries((all) =>
            [{ id, text, status: "checking" }, ...all].slice(0, 5),
          );
          setValue("");
          clearTimeout(timer.current);
          timer.current = setTimeout(() => settle("miss"), 900);
          try {
            await onGuess(text);
          } catch {
            settle("error");
          }
        }}
      >
        <label className="field">
          Your private guess
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={100}
            required
            placeholder="Is that a very angry kettle?"
            autoComplete="off"
          />
        </label>
        <button className="button primary">
          Guess
          <ArrowRight size={17} />
        </button>
      </form>
      {tries.length > 0 && (
        <ul
          className="tries"
          aria-live="polite"
          aria-label="Your guesses so far"
        >
          {tries.map((t) => (
            <li key={t.id} className={`try ${t.status}`}>
              {t.status === "part" ? <Check size={14} /> : <X size={14} />}
              <span>{t.text}</span>
              <small>
                {t.status === "part"
                  ? "Part of it!"
                  : t.status === "miss"
                    ? "Not quite"
                    : t.status === "error"
                      ? "Didn’t send"
                      : "…"}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
