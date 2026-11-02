import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Briefcase,
  Car,
  Check,
  Clapperboard,
  Drama,
  Flame,
  Layers,
  Leaf,
  MapPin,
  Music,
  Package,
  PawPrint,
  Rocket,
  Shuffle,
  Star,
  Trophy,
  Utensils,
  Volume2,
  WandSparkles,
} from "lucide-react";
import { Modal } from "../components.jsx";
import { Badge, Button, Skeleton } from "./kit.jsx";

const ICONS = {
  paw: PawPrint,
  star: Star,
  mask: Drama,
  utensils: Utensils,
  pin: MapPin,
  box: Package,
  briefcase: Briefcase,
  trophy: Trophy,
  leaf: Leaf,
  car: Car,
  wand: WandSparkles,
  film: Clapperboard,
  music: Music,
  activity: Activity,
  rocket: Rocket,
  layers: Layers,
  sound: Volume2,
  flame: Flame,
};

/** Loads the library overview: pack names, sizes and a few random sample words (never the full list). */
export function useLibrary() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setError(false);
    fetch("/api/words/library", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);
  useEffect(load, [load]);
  return { data, error, reload: load };
}

const EXTRA = [
  {
    id: "mixed",
    name: "Everything",
    blurb: "A surprise from every family-friendly pack below.",
    icon: "layers",
  },
  {
    id: "sounds",
    name: "Sound ideas",
    blurb: "The original list of things that make a noise.",
    icon: "sound",
  },
];

/** Pixel-Peek style browser: every pack as a card with a few random words to peek at. */
export function WordLibrary({ selected, canChoose, onChange, onClose }) {
  const { data, error, reload } = useLibrary();
  const everything = selected.includes("mixed");
  const adultIds = (data?.packs || []).filter((p) => p.adult).map((p) => p.id);
  const send = (next) =>
    onChange(
      next,
      next.some((id) => adultIds.includes(id)),
    );
  // Everything is a preset. Tapping a family pack narrows it to that pack, then taps add or remove. An 18+ pack
  // stacks on top of Everything instead, so "Everything + Spicy" is one tap, and it survives narrowing.
  const toggle = (id) => {
    let next;
    if (selected.includes(id)) next = selected.filter((x) => x !== id);
    else if (everything && !adultIds.includes(id))
      next = [id, ...selected.filter((x) => adultIds.includes(x))];
    else next = [...selected, id];
    if (next.length) send(next);
  };
  // The spicy pack needs a grown-up confirmation before the host can switch it on.
  const [confirming, setConfirming] = useState(null);
  const card = (p, extra) => {
    const Icon = ICONS[p.icon] || Layers;
    const chosen = p.id === "mixed" ? everything : selected.includes(p.id);
    const onlyOne = chosen && !everything && selected.length === 1;
    return (
      <article
        key={p.id}
        className={`lib-card ${chosen ? "chosen" : ""} ${p.adult ? "adult" : ""}`}
      >
        <header>
          <span className="lib-icon">
            <Icon size={22} />
          </span>
          <div>
            <h3>
              {p.name} {p.adult && <Badge tone="coral">18+</Badge>}
            </h3>
            <small>{extra ?? `${p.count} words`}</small>
          </div>
        </header>
        <p>{p.blurb}</p>
        {p.adult && (
          <p className="lib-adult-note">
            Suggestive and cheeky, never explicit. Words stay hidden until the
            game starts.
          </p>
        )}
        {p.samples?.length > 0 && (
          <ul
            className="lib-samples"
            aria-label={`Sample words from ${p.name}`}
          >
            {p.samples.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        {p.adult && confirming === p.id && !chosen ? (
          <div className="lib-confirm" role="group" aria-label="Confirm 18+">
            <strong>Is everyone here 18 or older?</strong>
            <div className="lib-confirm-actions">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setConfirming(null);
                  toggle(p.id);
                }}
              >
                We’re all adults
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(null)}
              >
                Never mind
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant={chosen ? "mint" : "secondary"}
            size="sm"
            disabled={!canChoose || onlyOne}
            icon={chosen ? <Check size={16} /> : undefined}
            onClick={() => {
              if (p.id === "mixed")
                return send([
                  "mixed",
                  ...selected.filter((x) => adultIds.includes(x)),
                ]);
              if (p.adult && !chosen) return setConfirming(p.id);
              toggle(p.id);
            }}
          >
            {!canChoose
              ? chosen
                ? "In use"
                : "Host picks"
              : chosen
                ? p.id === "mixed" || onlyOne
                  ? "In use"
                  : "In the mix · remove"
                : p.id === "mixed" || (everything && !p.adult)
                  ? "Use this pack"
                  : "Add to the mix"}
          </Button>
        )}
      </article>
    );
  };
  return (
    <Modal title="Word library" onClose={onClose}>
      <div className="lib">
        <p className="muted">
          {data
            ? `${data.total.toLocaleString()} words across ${data.packs.length} packs, each one or two words. Pick one pack, or add several to mix them. The rest stay a surprise.`
            : "Opening the shelves…"}
        </p>
        {error && (
          <div className="notice">
            Couldn’t open the library.{" "}
            <button type="button" className="text-button" onClick={reload}>
              Try again
            </button>
          </div>
        )}
        {!data && !error && (
          <div className="lib-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} height={170} radius={20} width="100%" />
            ))}
          </div>
        )}
        {data && (
          <>
            <div className="lib-toolbar">
              <Button
                variant="ghost"
                size="sm"
                icon={<Shuffle size={16} />}
                onClick={reload}
              >
                Peek again
              </Button>
            </div>
            <div className="lib-grid">
              {EXTRA.map((e) =>
                card(
                  { ...e, samples: null, count: 0 },
                  e.id === "mixed"
                    ? `${data.familyTotal.toLocaleString()} words`
                    : "Original sound ideas",
                ),
              )}
              {data.packs.map((p) => card(p))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
