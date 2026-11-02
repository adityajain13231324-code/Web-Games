import React, { useState } from "react";
import { Flame, Library } from "lucide-react";
import { WordLibrary, useLibrary } from "./WordLibrary.jsx";
import { Toggle } from "./kit.jsx";
import { sfx } from "./sfx.js";

/** Friendly name of the chosen word packs: one name, two names, or the first two and a count. */
export function usePackName(settings) {
  const { data } = useLibrary();
  const picked = settings.wordPacks || ["mixed"];
  const nameOf = (id) =>
    id === "sounds"
      ? "Sound ideas"
      : data?.packs.find((p) => p.id === id)?.name || "Library";
  if (picked.includes("mixed")) {
    const extra = picked.filter((id) => id !== "mixed").map(nameOf);
    return ["Everything", ...extra].join(" + ");
  }
  const names = picked.map((id) =>
    id === "sounds"
      ? "Sound ideas"
      : data?.packs.find((p) => p.id === id)?.name || "Library",
  );
  return names.length > 2
    ? `${names.slice(0, 2).join(" + ")} + ${names.length - 2} more`
    : names.join(" + ");
}

/** A small row of radio pills: one value out of a handful. */
function Pills({ label, value, options, onPick, disabled }) {
  return (
    <div className="pills" role="radiogroup" aria-label={label}>
      {options.map(({ value: v, text, aria }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          aria-label={aria}
          className={`pill ${value === v ? "on" : ""}`}
          disabled={disabled}
          onClick={() => {
            if (value === v) return;
            sfx("pop");
            onPick(v);
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Row({ title, hint, children }) {
  return (
    <div className="set-row">
      <div className="set-label">
        <strong>{title}</strong>
        {hint && <small>{hint}</small>}
      </div>
      {children}
    </div>
  );
}

const seconds = (list) => list.map((n) => ({ value: n, text: `${n}s` }));

/** Everything the host can tune before a match, grouped so it stays quick to scan. */
export function RoomSettings({ settings, host, change }) {
  const [library, setLibrary] = useState(false);
  const packName = usePackName(settings);
  const mode = settings.mode;
  const classic = mode === "classic";
  const gartic = mode === "gartic";
  const guessing = classic || mode === "duo";
  const own = !!settings.customPrompts;

  return (
    <div className="room-settings">
      <section className="set-group" aria-label="Rounds and timing">
        <h3>Rounds and timing</h3>
        <label className="field">
          {classic ? "Turns per performer" : "Rounds"}
          <select
            aria-label={classic ? "Turns per performer" : "Rounds"}
            disabled={!host}
            value={settings.rounds}
            onChange={(e) => change({ rounds: Number(e.target.value) })}
          >
            {[1, 2, 3].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        {gartic ? (
          <>
            <Row title="Recording time" hint="How long to make your sound">
              <Pills
                label="Recording time"
                disabled={!host}
                value={settings.recordSeconds}
                options={seconds([20, 35, 50])}
                onPick={(v) => change({ recordSeconds: v })}
              />
            </Row>
            <label className="field">
              Chain length
              <select
                disabled={!host}
                value={settings.chainLength}
                onChange={(e) =>
                  change({ chainLength: Number(e.target.value) })
                }
              >
                <option value={0}>Everyone contributes once</option>
                <option value={3}>3 contributions</option>
                <option value={4}>4 contributions (if enough players)</option>
              </select>
            </label>
          </>
        ) : (
          <Row title="Performance time" hint="Per turn">
            <Pills
              label="Performance time"
              disabled={!host}
              value={settings.performanceSeconds}
              options={seconds([20, 30, 40, 60, 90])}
              onPick={(v) => change({ performanceSeconds: v })}
            />
          </Row>
        )}
        {classic && (
          <Row title="Time to pick a word" hint="Before the turn starts">
            <Pills
              label="Time to pick a word"
              disabled={!host}
              value={settings.chooseSeconds}
              options={seconds([10, 20, 30])}
              onPick={(v) => change({ chooseSeconds: v })}
            />
          </Row>
        )}
      </section>

      {(classic || gartic) && (
        <section className="set-group" aria-label="Words">
          <h3>Words</h3>
          {classic && (
            <Row title="Words to pick from" hint="Easiest first">
              <Pills
                label="How many words to pick from"
                disabled={!host}
                value={settings.choices || 4}
                options={[3, 4, 5].map((n) => ({
                  value: n,
                  text: String(n),
                  aria: `${n} words`,
                }))}
                onPick={(v) => change({ choices: v })}
              />
            </Row>
          )}
          {gartic && (
            <Row title="Starting words" hint="Where each chain begins">
              <div
                className="pills wide"
                role="radiogroup"
                aria-label="Where do starting words come from?"
              >
                {[
                  [false, "From the library"],
                  [true, "We write our own"],
                ].map(([v, text]) => (
                  <button
                    key={text}
                    type="button"
                    role="radio"
                    aria-checked={own === v}
                    className={`pill ${own === v ? "on" : ""}`}
                    disabled={!host}
                    onClick={() => {
                      if (own === v) return;
                      sfx("pop");
                      change({ customPrompts: v });
                    }}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </Row>
          )}
          <div className="set-pack">
            <span>
              {settings.adultsOnly && <Flame size={14} className="sw-flame" />}
              {gartic && own
                ? `Suggestions come from ${packName}`
                : `From ${packName}`}
            </span>
            <button
              type="button"
              className="chip-button"
              onClick={() => setLibrary(true)}
            >
              <Library size={15} />
              Browse the word library
            </button>
          </div>
          <label className="field">
            Difficulty
            <select
              disabled={!host}
              value={settings.difficulty}
              onChange={(e) => change({ difficulty: e.target.value })}
            >
              <option value="mixed">A little of everything</option>
              <option value="easy">Everyday sounds</option>
              <option value="hard">Weird little scenes</option>
            </select>
          </label>
        </section>
      )}

      {!classic && !gartic && (
        <section className="set-group" aria-label="Prompts">
          <h3>Prompts</h3>
          <label className="field">
            Difficulty
            <select
              disabled={!host}
              value={settings.difficulty}
              onChange={(e) => change({ difficulty: e.target.value })}
            >
              <option value="mixed">A little of everything</option>
              <option value="easy">Everyday sounds</option>
              <option value="hard">Weird little scenes</option>
            </select>
          </label>
        </section>
      )}

      {(classic || guessing || gartic) && (
        <section className="set-group" aria-label="Helpers and scoring">
          <h3>Helpers and scoring</h3>
          {classic && (
            <Row title="Word shuffles" hint="Per performer, per turn">
              <Pills
                label="Word shuffles per turn"
                disabled={!host}
                value={settings.shuffles}
                options={[0, 1, 2, 3].map((n) => ({
                  value: n,
                  text: String(n),
                  aria: n === 1 ? "1 shuffle" : `${n} shuffles`,
                }))}
                onPick={(v) => change({ shuffles: v })}
              />
            </Row>
          )}
          {guessing && (
            <>
              <Toggle
                disabled={!host}
                checked={settings.hints}
                onChange={(v) => change({ hints: v })}
                label="Show guessers a small hint"
              />
              <Toggle
                disabled={!host}
                checked={settings.speedBonus}
                onChange={(v) => change({ speedBonus: v })}
                label="Faster guesses earn more points"
              />
            </>
          )}
          {gartic && (
            <Toggle
              disabled={!host}
              checked={!!settings.awards}
              onChange={(v) => change({ awards: v })}
              label="Friendly awards vote after the reveal"
            />
          )}
        </section>
      )}

      {!host && (
        <p className="muted">Only the host can change room settings.</p>
      )}
      {library && (
        <WordLibrary
          selected={settings.wordPacks || ["mixed"]}
          canChoose={host}
          onChange={(wordPacks, adults) => {
            change({ wordPacks, adultsOnly: !!adults });
            sfx("pop");
          }}
          onClose={() => setLibrary(false)}
        />
      )}
    </div>
  );
}

/** One slim line under the mode posters: the settings that matter most, tap to change. */
export function SettingsSummary({ settings, onOpen }) {
  const packName = usePackName(settings);
  const mode = settings.mode;
  const bits = [];
  if (mode === "gartic") {
    bits.push(`${settings.recordSeconds}s recordings`);
    bits.push(
      settings.customPrompts ? "Write your own words" : `${packName} words`,
    );
  } else {
    bits.push(`${settings.performanceSeconds}s turns`);
    if (mode === "classic") {
      bits.push(`${settings.choices} words to pick`);
      bits.push(`${packName} words`);
    }
  }
  const n = settings.rounds;
  bits.push(
    mode === "classic"
      ? `${n} turn${n === 1 ? "" : "s"} each`
      : `${n} round${n === 1 ? "" : "s"}`,
  );
  return (
    <button type="button" className="settings-summary" onClick={onOpen}>
      <span className="settings-summary-bits">
        {bits.map((b) => (
          <i key={b}>{b}</i>
        ))}
      </span>
      <b>Change</b>
    </button>
  );
}
