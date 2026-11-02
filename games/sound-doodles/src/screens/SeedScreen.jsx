import React, { useState } from "react";
import { ArrowRight, Shuffle } from "lucide-react";
import { Button } from "../ui/kit.jsx";
import { sfx } from "../ui/sfx.js";

/** Mirrors the server rule: one or two words, never a sentence. The server is still the authority. */
export function checkStartingWord(text) {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return { ok: false, words: 0, message: "" };
  const parts = cleaned.split(" ");
  if (parts.length > 2)
    return {
      ok: false,
      words: parts.length,
      message: "That’s a sentence. Keep it to one or two words.",
    };
  if (
    !parts.every(
      (w) => /^[\p{L}\p{N}][\p{L}\p{N}'’.\-]*$/u.test(w) && w.length <= 20,
    ) ||
    cleaned.length > 30
  )
    return {
      ok: false,
      words: parts.length,
      message: "Use plain letters and numbers, up to 20 per word.",
    };
  return { ok: true, words: parts.length, message: "" };
}

export function SeedScreen({ state: s, action, act }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const check = checkStartingWord(value);
  const shuffles = s.seedShuffles ?? 0;
  const submit = async (e) => {
    e.preventDefault();
    if (!check.ok || busy) return;
    setBusy(true);
    setError("");
    try {
      await action("submit", { text: value });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="game-stage seed-stage">
      <span className="eyebrow">START SOMETHING STRANGE</span>
      <h1>Pick your starting word.</h1>
      <p>
        One or two words, not a sentence. Your friends will have to turn it into
        a sound, then guess it back.
      </p>
      <form className="seed-form" onSubmit={submit}>
        <label className="field">
          Your starting word
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={32}
            placeholder="Disco llama"
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            aria-describedby="seed-help"
          />
        </label>
        <div className="seed-meter" id="seed-help" aria-live="polite">
          <span
            className={`word-count w${Math.min(check.words, 3)} ${check.ok ? "ok" : ""}`}
          >
            {check.words} / 2 words
          </span>
          <span className={`seed-msg ${check.message ? "bad" : ""}`}>
            {error ||
              check.message ||
              (check.ok
                ? "Nice. That’s playable."
                : "Try an animal, a place, a person…")}
          </span>
        </div>
        <Button
          variant="primary"
          size="lg"
          type="submit"
          className="wide"
          loading={busy}
          disabled={!check.ok}
        >
          Start this chain
          <ArrowRight size={18} />
        </Button>
      </form>
      <div className="seed-suggest">
        <span className="eyebrow">OR TAKE A SUGGESTION</span>
        <div className="suggest-chip" key={s.seed}>
          {s.seed}
        </div>
        <div className="suggest-actions">
          <Button
            variant="ghost"
            size="sm"
            icon={<Shuffle size={16} />}
            disabled={shuffles <= 0}
            onClick={() => {
              sfx("pop");
              act("shuffleSeed");
            }}
          >
            Shuffle ({shuffles} left)
          </Button>
          <button
            type="button"
            className="text-button"
            onClick={() => act("pass")}
          >
            Keep “{s.seed}”
          </button>
        </div>
      </div>
    </section>
  );
}
