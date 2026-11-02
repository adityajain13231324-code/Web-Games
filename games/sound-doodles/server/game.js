import { randomInt, randomUUID } from "node:crypto";
import { prompts, matchPrompt } from "./prompts.js";
import { MODES } from "../shared/modes.js";
import { formatLook, parseLook, randomLook, sizeOf } from "../shared/looks.js";
import {
  WORD_SETTINGS,
  hasAdultPack,
  resolvePacks,
  wordsFor,
  cleanStartingWord,
  libraryEntries,
  ADULT_PACK_IDS,
  libraryPrompt,
  DIFFICULTY_RANK,
} from "./words.js";

/** Changes with every deploy, so open pages can tell they are out of date. */
export const BUILD = process.env.RENDER_GIT_COMMIT || String(Date.now());

export class GameError extends Error {}
export const AWARD_CATEGORIES = [
  { key: "funniest", label: "Funniest transformation" },
  { key: "bestSound", label: "Best sound performance" },
  { key: "unexpected", label: "Most unexpected interpretation" },
  { key: "accurate", label: "Most surprisingly accurate chain" },
];
const requireThat = (condition, message) => {
  if (!condition) throw new GameError(message);
};
export function shuffle(values) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function routing(ids, rounds) {
  const order = shuffle(ids);
  return Array.from({ length: rounds }, (_, round) =>
    Object.fromEntries(
      order.map((owner, i) => [order[(i + round) % order.length], owner]),
    ),
  );
}
export function rankingScores(entries, ballots) {
  const scores = Object.fromEntries(entries.map((e) => [e.id, 0]));
  for (const ranking of Object.values(ballots))
    ranking.forEach((id, i) => {
      scores[id] += (ranking.length - i) / ranking.length;
    });
  return scores;
}
export class Room {
  constructor(code, { now = () => Date.now(), scale = 1 } = {}) {
    this.code = code;
    this.now = now;
    this.scale = scale;
    this.created = now();
    this.touched = now();
    this.players = [];
    this.host = null;
    this.phase = "lobby";
    this.phaseId = 0;
    this.deadline = null;
    this.audio = new Map();
    this.recent = [];
    this.settings = {
      mode: "classic",
      rounds: 1,
      chainLength: 0,
      difficulty: "mixed",
      performanceSeconds: 40,
      customPrompts: false,
      awards: false,
      wordPacks: ["mixed"],
      wordPack: "mixed", // legacy mirror for pages still running an older build
      choices: 4,
      adultsOnly: false,
      shuffles: 1,
      chooseSeconds: 20,
      recordSeconds: 35,
      hints: true,
      speedBonus: true,
    };
    this.reactions = [];
    this.replay = 0;
    this.autoplay = false;
  }
  // A face is a look string (shared/looks.js). Honor the requested one unless it is invalid or an exact copy of
  // someone already here; with no usable choice, deal a random face whose body (shape and colour) is free.
  pickAvatar(requested) {
    const used = new Set(this.players.map((p) => p.avatar));
    const usedBodies = new Set(
      this.players.map((p) => {
        const l = parseLook(p.avatar);
        return l && `${l.shape}.${l.color}`;
      }),
    );
    const rand = () => randomInt(1_000_000) / 1_000_000;
    let look = parseLook(requested);
    if (!look)
      for (let i = 0; i < 40; i++) {
        look = randomLook(rand);
        if (!usedBodies.has(`${look.shape}.${look.color}`)) break;
      }
    const colors = sizeOf("color");
    for (let i = 0; i < colors && used.has(formatLook(look)); i++)
      look = { ...look, color: (look.color + 1) % colors };
    return formatLook(look);
  }
  add({ name, avatar, spectator = false }) {
    requireThat(this.players.length < 12, "This room is full.");
    requireThat(
      typeof name === "string" &&
        name.trim().length >= 1 &&
        name.trim().length <= 20,
      "Use a nickname from 1 to 20 characters.",
    );
    const p = {
      id: randomUUID(),
      token: randomUUID() + randomUUID(),
      name: name.trim(),
      avatar: this.pickAvatar(avatar),
      spectator: this.phase !== "lobby" || spectator,
      connected: true,
      ready: false,
      mic: false,
      score: 0,
    };
    if (!p.spectator)
      requireThat(
        this.players.filter((p) => !p.spectator).length < 8,
        "Eight players are already here. Join as a spectator.",
      );
    this.players.push(p);
    this.host ??= p.id;
    return p;
  }
  player(id) {
    return this.players.find((p) => p.id === id);
  }
  active() {
    return this.players.filter((p) => !p.spectator && p.connected);
  }
  setPhase(phase, seconds = null) {
    this.phase = phase;
    this.phaseId++;
    this.started = this.now();
    this.deadline = seconds ? this.now() + seconds * 1000 * this.scale : null;
    this.reactions = [];
    this.touched = this.now();
  }
  /**
   * Classic, Skribbl style: deal 3 to 5 words to pick from, easiest first, with a spread of difficulties.
   * "sounds" uses the curated sound ideas, a pack id uses that pack, "mixed" blends sound ideas with the family-friendly library.
   */
  drawChoices(count = this.settings.choices || 4) {
    const selection = this.settings.wordPacks;
    const { sounds, packIds } = resolvePacks(selection);
    const level = this.settings.difficulty;
    const fits = (p) =>
      level === "mixed" ||
      (level === "easy" ? p.difficulty === "easy" : p.difficulty !== "easy");
    const curated = sounds
      ? prompts.filter(
          (p) =>
            p.modes.includes("classic") &&
            p.phrase.trim().split(/\s+/).length <= 2,
        )
      : [];
    // Every chosen pack is equally likely, so a small pack still shows up when mixed with big ones. An 18+ pack
    // that was added on purpose gets 40% of the library picks, so "Everything + Spicy" really is spicy.
    const adultLists = packIds
      .filter((id) => ADULT_PACK_IDS.includes(id))
      .map((id) => libraryEntries(id));
    const otherLists = packIds
      .filter((id) => !ADULT_PACK_IDS.includes(id))
      .map((id) => libraryEntries(id));
    const entries = [...adultLists, ...otherLists];
    const wantedOrder = ["easy", "easy", "medium", "hard", "medium"];
    const chosen = [];
    const taken = new Set();
    const pickOne = (wanted) => {
      for (let tries = 0; tries < 120; tries++) {
        const fromCurated =
          curated.length && (!entries.length || randomInt(10) < 4);
        const p = fromCurated
          ? curated[randomInt(curated.length)]
          : (() => {
              const pool =
                adultLists.length && otherLists.length
                  ? randomInt(10) < 4
                    ? adultLists
                    : otherLists
                  : entries;
              const list = pool[randomInt(pool.length)];
              const e = list[randomInt(list.length)];
              return libraryPrompt(e.word, e.packId);
            })();
        if (taken.has(p.id) || this.recent.includes(p.id)) continue;
        if (tries < 90 && !fits(p)) continue;
        if (tries < 40 && wanted && p.difficulty !== wanted) continue;
        return p;
      }
      return null;
    };
    for (let i = 0; i < count; i++) {
      let p = pickOne(wantedOrder[i]);
      if (!p) {
        this.recent = [];
        p = pickOne(null);
      }
      if (!p) break;
      taken.add(p.id);
      chosen.push(p);
    }
    chosen.sort(
      (a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty],
    );
    this.recent.push(...chosen.map((p) => p.id));
    this.recent = this.recent.slice(-200);
    return chosen;
  }
  /** A starting word for Gartic: from the chosen library pack, never repeated within the recent past. */
  drawWord() {
    let words = wordsFor(this.settings.wordPacks);
    if (!words) return this.draw().phrase;
    const { packIds } = resolvePacks(this.settings.wordPacks);
    const adult = packIds.filter((id) => ADULT_PACK_IDS.includes(id));
    if (adult.length && adult.length < packIds.length && randomInt(10) < 4)
      words = wordsFor(adult);
    this.recentWords ||= [];
    let pool = words.filter((w) => !this.recentWords.includes(w));
    if (!pool.length) {
      this.recentWords = [];
      pool = words;
    }
    const word = pool[randomInt(pool.length)];
    this.recentWords.push(word);
    this.recentWords = this.recentWords.slice(-300);
    return word;
  }
  draw(mode = this.settings.mode) {
    let pool = prompts.filter(
      (p) =>
        p.modes.includes(mode) &&
        (mode !== "duo" || p.components.length === 2) &&
        (this.settings.difficulty === "mixed" ||
          p.difficulty === this.settings.difficulty ||
          mode === "duo"),
    );
    if (!pool.length) pool = prompts.filter((p) => p.modes.includes(mode));
    let available = pool.filter((p) => !this.recent.includes(p.id));
    if (!available.length) {
      this.recent = [];
      available = pool;
    }
    const prompt = available[randomInt(available.length)];
    this.recent.push(prompt.id);
    this.recent = this.recent.slice(-80);
    return prompt;
  }
  performers() {
    if (this.phase !== "perform") return [];
    return this.settings.mode === "detective"
      ? [this.order[this.speakerIndex]]
      : this.performerIds || [];
  }
  start() {
    const active = this.active();
    const mode = this.settings.mode;
    requireThat(
      active.length >= MODES[mode].min,
      `${MODES[mode].name} needs at least ${MODES[mode].min} players.`,
    );
    requireThat(
      active.every((p) => p.ready),
      "Everyone needs to be ready.",
    );
    requireThat(
      mode === "classic" || active.every((p) => p.mic),
      "Check your microphones first, or choose spectator.",
    );
    this.ids = shuffle(active.map((p) => p.id));
    this.players.forEach((p) => (p.score = 0));
    this.round = 0;
    this.audio.clear();
    this.autoplay = false;
    this.awardBallots = {};
    this.awards = null;
    this.shuffles = {};
    if (mode === "gartic") {
      this.chainRounds = this.settings.chainLength
        ? Math.min(this.ids.length, this.settings.chainLength)
        : this.ids.length;
      this.schedule = routing(this.ids, this.chainRounds);
      this.chains = Object.fromEntries(
        this.ids.map((id) => [
          id,
          {
            id: randomUUID(),
            owner: id,
            entries: [
              { type: "text", text: this.drawWord(), author: id, round: -1 },
            ],
          },
        ]),
      );
      this.contributionRound = 0;
      this.submissions = {};
      if (this.settings.customPrompts) this.setPhase("seed", 30);
      else this.beginTask();
    } else {
      // Classic, like Skribbl: everyone takes turns on the mic (a player who skipped the mic check is asked for
      // it when their turn comes). Small rooms always play at least four rounds, so two friends do not get a
      // one-round game.
      const performers = this.ids.length;
      this.totalRounds =
        mode === "classic"
          ? performers *
            Math.max(
              this.settings.rounds,
              Math.ceil(4 / Math.max(performers, 1)),
            )
          : this.settings.rounds;
      this.beginRound();
    }
  }
  beginRound() {
    if (this.round >= this.totalRounds) {
      this.setPhase("results");
      return;
    }
    this.submissions = {};
    this.ballots = {};
    this.progress = {};
    this.solved = {};
    this.skips = 0;
    this.prompt = null;
    this.answer = null;
    this.outsiderGuess = null;
    this.voteResult = null;
    this.entries = [];
    const mode = this.settings.mode;
    if (mode === "classic") {
      this.performerIds = [this.ids[this.round % this.ids.length]];
      this.eligible = this.ids.filter((id) => !this.performerIds.includes(id));
      this.choices = this.drawChoices();
      this.setPhase("choose", this.settings.chooseSeconds);
    } else if (mode === "duo") {
      this.performerIds = [
        this.ids[this.round % this.ids.length],
        this.ids[(this.round + 1) % this.ids.length],
      ];
      this.eligible = this.ids.filter((id) => !this.performerIds.includes(id));
      this.prompt = this.draw("duo");
      this.setPhase("prepare", 5);
    } else if (mode === "detective") {
      this.prompt = this.draw("detective");
      this.outsider = this.ids[this.round % this.ids.length];
      this.order = [
        ...this.ids.slice(this.round % this.ids.length),
        ...this.ids.slice(0, this.round % this.ids.length),
      ];
      this.speakerIndex = 0;
      this.setPhase("prepare", 5);
    } else {
      this.prompt = this.draw();
      this.animation = ["bounce", "slip", "door"][this.round % 3];
      this.setPhase("record", this.settings.recordSeconds);
    }
  }
  beginTask() {
    this.submissions = {};
    this.setPhase(
      this.contributionRound % 2 === 0 ? "record" : "interpret",
      this.contributionRound % 2 === 0 ? this.settings.recordSeconds : 30,
    );
  }
  task(id) {
    if (this.settings.mode !== "gartic" || !this.ids?.includes(id)) return null;
    const owner = this.schedule[this.contributionRound]?.[id];
    const chain = this.chains[owner];
    if (!chain) return null;
    const last = chain.entries.at(-1);
    if (last.type === "missing")
      return { type: "text", text: "A squeaky door", replacement: true };
    return { type: last.type, text: last.text, audioId: last.audioId };
  }
  checkPhase(data) {
    requireThat(
      data.phaseId === this.phaseId,
      "That round has moved on. Try the current action.",
    );
  }
  dispatch(id, event, data = {}) {
    requireThat(data && typeof data === "object", "Invalid action.");
    const p = this.player(id);
    requireThat(p?.connected, "Reconnect to the room first.");
    this.touched = this.now();
    const host = () =>
      requireThat(this.host === id, "Only the host can do that.");
    const participant = () =>
      requireThat(
        this.ids?.includes(id),
        "You are watching this match. Join in from the next lobby.",
      );
    if (event === "ready") {
      requireThat(this.phase === "lobby", "The match has started.");
      p.ready = !!data.ready;
      return;
    }
    if (event === "mic") {
      p.mic = !!data.mic;
      return;
    }
    if (event === "seat") {
      requireThat(this.phase === "lobby", "Switch roles in the lobby.");
      if (!data.spectator)
        requireThat(
          this.players.filter((x) => !x.spectator && x.id !== id).length < 8,
          "All eight player seats are taken.",
        );
      p.spectator = !!data.spectator;
      p.ready = false;
      return;
    }
    if (event === "settings") {
      host();
      requireThat(this.phase === "lobby", "Change settings in the lobby.");
      const s = data.settings;
      requireThat(
        s && MODES[s.mode] && ["mixed", "easy", "hard"].includes(s.difficulty),
        "Choose valid room settings.",
      );
      // Newer pages send a list of packs to mix. A page still running an older build sends a single "wordPack"
      // (and echoes back the list it was given): when that single value changed, it is the player's choice.
      const legacyChoice =
        typeof s.wordPack === "string" && s.wordPack !== this.settings.wordPack;
      const packs = legacyChoice
        ? [s.wordPack]
        : (s.wordPacks ?? (s.wordPack ? [s.wordPack] : ["mixed"]));
      requireThat(
        Array.isArray(packs) &&
          packs.length >= 1 &&
          packs.length <= WORD_SETTINGS.length &&
          packs.every((id) => WORD_SETTINGS.includes(id)),
        "Choose at least one word pack from the library.",
      );
      requireThat(
        !hasAdultPack(packs) || s.adultsOnly === true,
        "The spicy pack needs the 18+ confirmation.",
      );
      requireThat(
        s.choices === undefined || [3, 4, 5].includes(s.choices),
        "Choose 3, 4 or 5 words to pick from.",
      );
      requireThat(
        [1, 2, 3].includes(s.rounds) &&
          [0, 3, 4].includes(s.chainLength) &&
          [20, 30, 40, 60, 90].includes(s.performanceSeconds),
        "Unsupported timing or round count.",
      );
      requireThat(
        (s.shuffles === undefined || [0, 1, 2, 3].includes(s.shuffles)) &&
          (s.chooseSeconds === undefined ||
            [10, 20, 30].includes(s.chooseSeconds)) &&
          (s.recordSeconds === undefined ||
            [20, 35, 50].includes(s.recordSeconds)),
        "Unsupported shuffle or timing choice.",
      );
      this.settings = {
        mode: s.mode,
        difficulty: s.difficulty,
        rounds: s.rounds,
        chainLength: s.chainLength,
        performanceSeconds: s.performanceSeconds,
        customPrompts: !!s.customPrompts,
        awards: !!s.awards,
        wordPacks: [...new Set(packs)],
        wordPack: packs[0],
        choices: s.choices ?? 4,
        adultsOnly: hasAdultPack(packs) && s.adultsOnly === true,
        shuffles: s.shuffles ?? 1,
        chooseSeconds: s.chooseSeconds ?? 20,
        recordSeconds: s.recordSeconds ?? 35,
        hints: s.hints !== false,
        speedBonus: s.speedBonus !== false,
      };
      this.players.forEach((p) => (p.ready = false));
      return;
    }
    if (event === "start") {
      host();
      requireThat(this.phase === "lobby", "Already playing.");
      this.start();
      return;
    }
    if (event === "again") {
      host();
      requireThat(this.phase === "results", "Finish this match first.");
      this.audio.clear();
      this.chains = null;
      this.entries = [];
      this.ids = [];
      this.players.forEach((p) => (p.ready = false));
      this.setPhase("lobby");
      return;
    }
    if (event === "reaction") {
      requireThat(
        ["👏", "😂", "✨", "🤯"].includes(data.emoji),
        "Choose a reaction.",
      );
      requireThat(
        this.now() - (p.lastReaction || 0) >= 2000,
        "Give that reaction a moment.",
      );
      p.lastReaction = this.now();
      this.reactions.push({
        id: randomUUID(),
        emoji: data.emoji,
        name: p.name,
        at: this.now(),
      });
      this.reactions = this.reactions.slice(-5);
      return;
    }
    this.checkPhase(data);
    if (event === "pick") {
      requireThat(
        this.phase === "choose" && this.performerIds.includes(id),
        "Only the performer can choose now.",
      );
      this.prompt = this.choices.find((p) => p.id === data.promptId);
      requireThat(this.prompt, "Choose one of your three prompts.");
      this.setPhase("prepare", 5);
      return;
    }
    if (event === "skipPrompt") {
      requireThat(
        this.phase === "choose" &&
          this.performerIds.includes(id) &&
          this.skips < this.settings.shuffles,
        "No shuffles left this turn.",
      );
      this.skips++;
      this.choices = this.drawChoices();
      return;
    }
    if (event === "guess") {
      participant();
      requireThat(
        this.phase === "perform" &&
          ["classic", "duo"].includes(this.settings.mode) &&
          this.eligible.includes(id),
        "You cannot guess right now.",
      );
      requireThat(
        typeof data.text === "string" &&
          data.text.trim().length > 0 &&
          data.text.length <= 120,
        "Keep guesses between 1 and 120 characters.",
      );
      requireThat(
        this.now() - (p.lastGuess || 0) >= 650,
        "A little slower. Give each guess a moment.",
      );
      p.lastGuess = this.now();
      if (this.solved[id]) return;
      const result = matchPrompt(
        this.prompt,
        data.text,
        this.progress[id]?.components,
      );
      this.progress[id] = result;
      if (result.correct) {
        const remaining = Math.max(
          0,
          (this.deadline - this.now()) /
            (this.settings.performanceSeconds * 1000 * this.scale),
        );
        const points = this.settings.speedBonus
          ? 100 + Math.round(100 * remaining)
          : 150;
        this.solved[id] = points;
        p.score += points;
      }
      if (this.eligible.every((id) => this.solved[id]))
        this.finishPerformance();
      return;
    }
    if (event === "pass") {
      participant();
      if (
        ["choose", "prepare", "perform"].includes(this.phase) &&
        ((this.settings.mode === "detective" &&
          this.performers().includes(id)) ||
          (["classic", "duo"].includes(this.settings.mode) &&
            this.performerIds.includes(id)))
      ) {
        if (this.settings.mode === "detective") this.advance();
        else {
          this.prompt ??= this.choices?.[0];
          this.finishPerformance();
        }
        return;
      }
      requireThat(
        ["record", "interpret", "seed"].includes(this.phase),
        "You cannot pass at this step.",
      );
      if (!this.submissions[id])
        this.submissions[id] = {
          type: "missing",
          reason: "Passed",
          author: id,
        };
      this.maybeSubmitted();
      return;
    }
    if (event === "submit") {
      participant();
      requireThat(
        ["seed", "record", "interpret"].includes(this.phase),
        "Submissions are closed.",
      );
      if (this.submissions[id]) return;
      if (this.phase === "record") {
        const a = this.audio.get(data.audioId);
        requireThat(
          a && a.owner === id && a.phaseId === this.phaseId,
          "Record and upload your sound first.",
        );
        this.submissions[id] = {
          type: "audio",
          audioId: data.audioId,
          author: id,
        };
      } else if (this.phase === "seed") {
        const word = cleanStartingWord(data.text);
        requireThat(word, "Use one or two words, not a sentence.");
        this.submissions[id] = { type: "text", text: word, author: id };
      } else {
        requireThat(
          typeof data.text === "string" &&
            data.text.trim().length > 0 &&
            data.text.length <= 100,
          "Use 1 to 100 characters.",
        );
        this.submissions[id] = {
          type: "text",
          text: data.text.trim(),
          author: id,
        };
      }
      this.maybeSubmitted();
      return;
    }
    if (event === "shuffleSeed") {
      participant();
      requireThat(
        this.phase === "seed",
        "Shuffling is only open while choosing starting words.",
      );
      requireThat(!this.submissions[id], "You already chose your word.");
      this.shuffles ||= {};
      requireThat(
        (this.shuffles[id] || 0) < 3,
        "No more shuffles. Write your own or keep this one.",
      );
      this.shuffles[id] = (this.shuffles[id] || 0) + 1;
      this.chains[id].entries[0].text = this.drawWord();
      return;
    }
    if (event === "award") {
      participant();
      requireThat(this.phase === "awards", "Awards voting is closed.");
      if (this.awardBallots[id]) return;
      const picks = data.picks || {};
      const entryRefs = {};
      for (const chain of Object.values(this.chains))
        chain.entries.forEach((e, i) => {
          if (e.type === "audio") entryRefs[`${chain.id}:${i}`] = e;
        });
      const clean = {};
      for (const key of AWARD_CATEGORIES.map((c) => c.key)) {
        const pick = picks[key];
        if (pick === undefined || pick === null) continue;
        if (key === "bestSound") {
          requireThat(entryRefs[pick], "Choose a real recording.");
          requireThat(
            entryRefs[pick].author !== id,
            "You cannot vote for your own sound.",
          );
        } else {
          const chain = Object.values(this.chains).find((c) => c.id === pick);
          requireThat(chain, "Choose a real chain.");
          requireThat(
            chain.owner !== id,
            "You cannot vote for your own chain.",
          );
        }
        clean[key] = pick;
      }
      this.awardBallots[id] = clean;
      if (this.ids.every((pid) => this.awardBallots[pid])) this.finishAwards();
      return;
    }
    if (event === "vote") {
      participant();
      requireThat(this.phase === "vote", "Voting is closed.");
      if (this.ballots[id]) return;
      if (this.settings.mode === "detective") {
        requireThat(
          data.target === null ||
            (this.ids.includes(data.target) && data.target !== id),
          "Choose someone else, or abstain.",
        );
        this.ballots[id] = { target: data.target };
      } else {
        requireThat(
          Array.isArray(data.ranking) &&
            new Set(data.ranking).size === data.ranking.length,
          "Choose distinct recordings.",
        );
        const allowed = this.entries
          .filter((e) => e.author !== id)
          .map((e) => e.id);
        requireThat(
          data.ranking.every((x) => allowed.includes(x)),
          "You cannot vote for your own sound.",
        );
        requireThat(
          this.settings.mode === "ranking"
            ? data.ranking.length === allowed.length
            : data.ranking.length <= 1,
          "Rank all other recordings, or pick one favorite in Foley.",
        );
        this.ballots[id] = data.ranking;
      }
      if (this.ids.every((id) => this.ballots[id])) this.advance();
      return;
    }
    if (event === "outsiderGuess") {
      requireThat(
        this.phase === "outsider" && id === this.outsider,
        "Only the outsider can make the final guess.",
      );
      requireThat(
        typeof data.text === "string" && data.text.length <= 120,
        "Keep the guess short.",
      );
      this.outsiderGuess = data.text;
      this.advance();
      return;
    }
    if (
      event === "next" ||
      event === "nextChain" ||
      event === "replay" ||
      event === "autoplay"
    ) {
      host();
      requireThat(
        ["roundReveal", "chainReveal", "listening"].includes(this.phase),
        "Wait for the reveal.",
      );
      if (event === "replay") {
        this.replay++;
        return;
      }
      if (event === "autoplay") {
        this.autoplay = !!data.enabled;
        this.deadline = this.autoplay ? this.now() + 12000 * this.scale : null;
        return;
      }
      if (event === "nextChain") {
        requireThat(
          this.phase === "chainReveal" &&
            this.revealStep >=
              this.chains[this.ids[this.revealChain]].entries.length - 1,
          "Reveal every step first.",
        );
        this.advanceChain();
        return;
      }
      this.advance();
      return;
    }
    throw new GameError("That action is not available.");
  }
  maybeSubmitted() {
    if (this.ids.every((id) => this.submissions[id])) {
      this.pendingPhase = this.phase;
      this.setPhase("handoff", 2);
    }
  }
  finishPerformance() {
    const solved = Object.keys(this.solved).length;
    const bonus = Math.round(
      (200 * solved) / Math.max(1, this.eligible.length),
    );
    this.performerIds.forEach((id) => (this.player(id).score += bonus));
    this.answer = this.prompt.phrase;
    this.setPhase("roundReveal");
  }
  finishTask(phase = this.phase) {
    for (const id of this.ids)
      this.submissions[id] ??= {
        type: "missing",
        reason: "No submission",
        author: id,
      };
    if (phase === "seed") {
      for (const id of this.ids)
        if (this.submissions[id].type === "text")
          this.chains[id].entries[0].text = this.submissions[id].text;
      this.beginTask();
      return;
    }
    if (this.settings.mode === "gartic") {
      for (const id of this.ids) {
        const chain = this.chains[this.schedule[this.contributionRound][id]];
        chain.entries.push({
          ...this.submissions[id],
          round: this.contributionRound,
        });
      }
      this.contributionRound++;
      if (this.contributionRound >= this.chainRounds) {
        this.revealChain = 0;
        this.revealStep = 0;
        this.setPhase("chainReveal");
      } else this.beginTask();
    } else {
      this.entries = shuffle(
        Object.values(this.submissions).filter((e) => e.type === "audio"),
      ).map((e, i) => ({
        ...e,
        id: randomUUID(),
        label: `Sound ${String.fromCharCode(65 + i)}`,
      }));
      this.listenIndex = 0;
      if (this.entries.length) this.setPhase("listening");
      else {
        this.voteResult = [];
        this.setPhase("roundReveal");
      }
    }
  }
  finishAwards() {
    const tallies = Object.fromEntries(
      AWARD_CATEGORIES.map((c) => [c.key, {}]),
    );
    for (const ballot of Object.values(this.awardBallots || {}))
      for (const [key, pick] of Object.entries(ballot))
        tallies[key][pick] = (tallies[key][pick] || 0) + 1;
    this.awards = AWARD_CATEGORIES.map(({ key, label }) => {
      const entries = Object.entries(tallies[key]);
      const top = Math.max(0, ...entries.map(([, n]) => n));
      return {
        key,
        label,
        votes: top,
        winners: top
          ? entries.filter(([, n]) => n === top).map(([pick]) => pick)
          : [],
      };
    });
    this.setPhase("results");
  }
  advanceChain() {
    this.revealChain++;
    this.revealStep = 0;
    if (this.revealChain >= this.ids.length) {
      if (this.settings.awards && this.settings.mode === "gartic") {
        this.awardBallots = {};
        this.awards = null;
        this.setPhase("awards", 60);
      } else this.setPhase("results");
    } else {
      this.setPhase("chainReveal");
      if (this.autoplay) this.deadline = this.now() + 12000 * this.scale;
    }
  }
  advance() {
    const mode = this.settings.mode;
    if (this.phase === "handoff") {
      this.finishTask(this.pendingPhase);
      return;
    }
    if (this.phase === "awards") {
      this.finishAwards();
      return;
    }
    if (this.phase === "choose") {
      this.prompt = this.choices[0];
      this.setPhase("prepare", 5);
      return;
    }
    if (this.phase === "prepare") {
      this.setPhase(
        "perform",
        mode === "detective" ? 10 : this.settings.performanceSeconds,
      );
      return;
    }
    if (this.phase === "perform") {
      if (mode === "detective") {
        this.speakerIndex++;
        if (this.speakerIndex >= this.order.length) this.setPhase("vote", 30);
        else this.setPhase("perform", 10);
      } else this.finishPerformance();
      return;
    }
    if (["record", "interpret", "seed"].includes(this.phase)) {
      this.finishTask();
      return;
    }
    if (this.phase === "listening") {
      this.listenIndex++;
      if (this.listenIndex >= this.entries.length) this.setPhase("vote", 45);
      else {
        this.replay++;
        if (this.autoplay) this.deadline = this.now() + 12000 * this.scale;
      }
      return;
    }
    if (this.phase === "vote") {
      if (mode === "detective") {
        const counts = Object.fromEntries(this.ids.map((id) => [id, 0]));
        for (const b of Object.values(this.ballots))
          if (b.target) counts[b.target]++;
        const max = Math.max(...Object.values(counts));
        const leaders = this.ids.filter((id) => counts[id] === max);
        this.caught =
          max > 0 && leaders.length === 1 && leaders[0] === this.outsider;
        this.voteResult = {
          counts,
          caught: this.caught,
          tie: leaders.length > 1,
        };
        this.setPhase("outsider", 20);
      } else {
        const totals = rankingScores(this.entries, this.ballots);
        this.voteResult = this.entries
          .map((e) => ({ ...e, points: Math.round(totals[e.id] * 100) }))
          .sort((a, b) => b.points - a.points);
        this.voteResult.forEach(
          (e) => (this.player(e.author).score += e.points),
        );
        this.setPhase("roundReveal");
      }
      return;
    }
    if (this.phase === "outsider") {
      const escaped = matchPrompt(
        this.prompt,
        this.outsiderGuess || "",
      ).correct;
      this.ids.forEach((id) => {
        if (id === this.outsider) {
          if (!this.caught || escaped) this.player(id).score += 200;
        } else if (this.ballots[id]?.target === this.outsider)
          this.player(id).score += 100;
      });
      this.voteResult = {
        ...this.voteResult,
        escaped,
        outsider: this.outsider,
        ballots: this.ballots,
      };
      this.answer = this.prompt.phrase;
      this.setPhase("roundReveal");
      return;
    }
    if (this.phase === "roundReveal") {
      this.round++;
      this.beginRound();
      return;
    }
    if (this.phase === "chainReveal") {
      const entries = this.chains[this.ids[this.revealChain]].entries;
      if (this.revealStep < entries.length - 1) {
        this.revealStep++;
        this.replay++;
        if (this.autoplay) this.deadline = this.now() + 12000 * this.scale;
      } else this.advanceChain();
      return;
    }
  }
  tick() {
    if (this.deadline && this.now() >= this.deadline) {
      this.advance();
      return true;
    }
    return false;
  }
  disconnect(id) {
    const p = this.player(id);
    if (!p) return;
    p.connected = false;
    p.ready = false;
    p.disconnectedAt = this.now();
    this.migrateHost();
  }
  migrateHost() {
    if (!this.player(this.host)?.connected)
      this.host = this.players.find((p) => p.connected)?.id || this.host;
  }
  storeAudio(id, buffer, mime, duration, phaseId) {
    requireThat(
      this.phase === "record" &&
        phaseId === this.phaseId &&
        this.ids.includes(id) &&
        !this.submissions[id],
      "This recording task has ended.",
    );
    requireThat(
      Buffer.isBuffer(buffer) && buffer.length > 100 && buffer.length <= 512000,
      "Record a clip smaller than 500 KB.",
    );
    requireThat(
      ["audio/webm", "audio/ogg", "audio/mp4"].includes(mime.split(";")[0]),
      "Unsupported recording format.",
    );
    requireThat(
      Number.isFinite(duration) &&
        duration > 0 &&
        duration <= (this.settings.mode === "foley" ? 5.5 : 10.5),
      "That recording is too long.",
    );
    for (const [key, a] of this.audio)
      if (a.owner === id && a.phaseId === phaseId) this.audio.delete(key);
    const key = randomUUID();
    this.audio.set(key, {
      owner: id,
      phaseId,
      buffer,
      mime,
      created: this.now(),
      duration,
    });
    return key;
  }
  canHear(id, audioId) {
    if (!this.player(id)) return false;
    const a = this.audio.get(audioId);
    if (!a) return false;
    if (a.owner === id) return true;
    if (this.phase === "interpret" && this.task(id)?.audioId === audioId)
      return true;
    if (
      ["awards", "results"].includes(this.phase) &&
      this.settings.mode === "gartic" &&
      this.chains
    )
      return Object.values(this.chains).some((c) =>
        c.entries.some((e) => e.audioId === audioId),
      );
    if (this.phase === "chainReveal")
      return this.chains[this.ids[this.revealChain]].entries
        .slice(0, this.revealStep + 1)
        .some((e) => e.audioId === audioId);
    if (
      ["listening", "vote", "roundReveal", "results"].includes(this.phase) &&
      this.settings.mode !== "gartic"
    )
      return this.entries?.some(
        (e) =>
          e.audioId === audioId &&
          (this.phase !== "listening" ||
            this.entries.indexOf(e) <= this.listenIndex),
      );
    return false;
  }
  view(id) {
    const me = this.player(id),
      mode = this.settings.mode;
    const v = {
      code: this.code,
      you: id,
      host: this.host,
      phase: this.phase,
      phaseId: this.phaseId,
      serverNow: this.now(),
      deadline: this.deadline,
      settings: this.settings,
      build: BUILD,
      players: this.players.map(
        ({ id, name, avatar, connected, ready, mic, spectator, score }) => ({
          id,
          name,
          avatar,
          connected,
          ready,
          mic,
          spectator,
          score,
        }),
      ),
      round: this.round || 0,
      totalRounds: this.totalRounds || 0,
      performers: this.performers(),
      reactions: this.reactions,
      replay: this.replay,
      autoplay: this.autoplay,
      participant: this.ids?.includes(id) || false,
      submitted: !!this.submissions?.[id],
      voted: !!this.ballots?.[id],
    };
    if (this.phase === "lobby") return v;
    v.completed = Object.keys(this.submissions || {});
    v.solved = Object.keys(this.solved || {});
    if (mode === "classic" || mode === "duo") {
      v.performerIds = this.performerIds;
      v.progress = this.progress?.[id];
      if (this.performerIds?.includes(id) && this.phase === "choose") {
        v.choices = this.choices.map(
          ({ id, phrase, difficulty, category }) => ({
            id,
            phrase,
            difficulty,
            category,
          }),
        );
        v.skips = this.skips;
      }
      if (
        this.performerIds?.includes(id) &&
        ["prepare", "perform"].includes(this.phase)
      )
        v.prompt =
          mode === "duo"
            ? this.prompt.components[this.performerIds.indexOf(id)].join(" / ")
            : this.prompt.phrase;
      if (this.phase === "perform" && this.settings.hints)
        v.hint =
          this.prompt.hints[
            Math.min(
              1,
              Math.floor((this.now() - this.started) / (20000 * this.scale)),
            )
          ];
      if (this.phase === "roundReveal") {
        v.answer = this.answer;
        v.awarded = this.solved;
      }
    }
    if (mode === "gartic") {
      v.contributionRound = this.contributionRound;
      v.chainRounds = this.chainRounds;
      if (["record", "interpret"].includes(this.phase)) v.task = this.task(id);
      if (this.phase === "seed" && this.ids.includes(id)) {
        v.seed = this.chains[id].entries[0].text;
        v.seedShuffles = 3 - (this.shuffles?.[id] || 0);
      }
      if (["awards", "results"].includes(this.phase) && this.chains) {
        v.awardChains = Object.values(this.chains).map((c) => ({
          id: c.id,
          owner: c.owner,
          own: c.owner === id,
          entries: c.entries.map((e, i) => ({
            ref: `${c.id}:${i}`,
            type: e.type,
            text: e.type === "text" ? e.text : null,
            audioId: e.type === "audio" ? e.audioId : null,
            author: e.author,
            own: e.author === id,
            missing: e.type === "missing",
          })),
        }));
        v.awardsEnabled = !!this.settings.awards;
        v.awardsVoted = !!this.awardBallots?.[id];
        if (this.phase === "results") v.awards = this.awards;
      }
      if (this.phase === "chainReveal") {
        const chain = this.chains[this.ids[this.revealChain]];
        v.chain = {
          ...chain,
          entries: chain.entries.slice(0, this.revealStep + 1),
          total: chain.entries.length,
        };
        v.revealChain = this.revealChain;
        v.chainCount = this.ids.length;
        v.revealStep = this.revealStep;
      }
    }
    if (mode === "detective") {
      if (
        this.ids.includes(id) &&
        ["prepare", "perform", "vote"].includes(this.phase)
      ) {
        v.outsider = id === this.outsider;
        v.prompt = v.outsider ? null : this.prompt.phrase;
      }
      if (this.phase === "perform") v.speakerIndex = this.speakerIndex;
      if (this.phase === "outsider") {
        v.outsider = id === this.outsider;
        v.voteCounts = this.voteResult.counts;
      }
      if (this.phase === "roundReveal") {
        v.answer = this.answer;
        v.voteResult = this.voteResult;
        v.outsiderGuess = this.outsiderGuess;
      }
    }
    if (["foley", "ranking"].includes(mode)) {
      if (mode === "foley") v.animation = this.animation;
      if (
        mode === "ranking" &&
        this.ids.includes(id) &&
        this.phase === "record"
      )
        v.prompt = this.prompt.phrase;
      if (["listening", "vote"].includes(this.phase))
        v.entries = this.entries
          .slice(
            0,
            this.phase === "listening" ? this.listenIndex + 1 : undefined,
          )
          .map(({ id: entryId, audioId, label, author }) => ({
            id: entryId,
            audioId,
            label,
            own: author === id,
          }));
      if (this.phase === "listening") v.listenIndex = this.listenIndex;
      if (this.phase === "roundReveal") {
        v.voteResult = this.voteResult;
        v.answer = mode === "ranking" ? this.prompt.phrase : null;
      }
    }
    return v;
  }
}
