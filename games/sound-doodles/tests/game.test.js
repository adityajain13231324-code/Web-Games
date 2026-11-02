import test from "node:test";
import assert from "node:assert/strict";
import { Room, routing, rankingScores } from "../server/game.js";
import { prompts, matchPrompt } from "../server/prompts.js";

function fixture(mode = "classic", n = 4) {
  let clock = 100000;
  const room = new Room("ABCDEF", { now: () => clock });
  const players = Array.from({ length: n }, (_, i) =>
    room.add({ name: `Player ${i}` }),
  );
  room.settings = { ...room.settings, mode, rounds: 1 };
  players.forEach((p) => {
    p.ready = true;
    p.mic = true;
  });
  const send = (id, event, data = {}) =>
    room.dispatch(id, event, { phaseId: room.phaseId, ...data });
  const expire = () => {
    clock = room.deadline + 1;
    room.tick();
  };
  return { room, players, send, expire, later: (ms) => (clock += ms) };
}
function submitRecordings(f) {
  for (const id of f.room.ids) {
    const audioId = f.room.storeAudio(
      id,
      Buffer.alloc(200, 1),
      "audio/webm",
      1,
      f.room.phaseId,
    );
    f.send(id, "submit", { audioId });
  }
  if (f.room.phase === "handoff") f.expire();
}
test("curated library has 150+ unique prompts and complete metadata", () => {
  assert.ok(prompts.length >= 150);
  assert.equal(new Set(prompts.map((p) => p.id)).size, prompts.length);
  assert.equal(new Set(prompts.map((p) => p.phrase)).size, prompts.length);
  for (const p of prompts) {
    assert.ok(p.aliases.length && p.hints.length === 2 && p.modes.length);
    assert.ok(["easy", "hard"].includes(p.difficulty));
  }
});
test("matching normalizes, conservatively tolerates typos and accumulates components", () => {
  const kettle = prompts.find((p) => p.phrase === "Kettle");
  assert.ok(matchPrompt(kettle, "THE kettle!!").correct);
  assert.ok(matchPrompt(kettle, "ketle").correct);
  assert.equal(matchPrompt(kettle, "cat").correct, false);
  const robot = prompts.find((p) => p.phrase === "Robot with hiccups");
  const first = matchPrompt(robot, "robot");
  assert.equal(first.correct, false);
  assert.deepEqual(first.components, [0]);
  assert.ok(matchPrompt(robot, "hiccups", first.components).correct);
});
for (let n = 2; n <= 8; n++)
  test(`Gartic routing: ${n} players, balanced, no self-handoff, stable ancestry`, () => {
    const ids = Array.from({ length: n }, (_, i) => `p${i}`),
      schedule = routing(ids, n);
    assert.deepEqual(new Set(Object.keys(schedule[0])), new Set(ids));
    for (const id of ids) {
      assert.equal(schedule[0][id], id);
      assert.equal(new Set(schedule.map((s) => s[id])).size, n);
    }
    for (let round = 0; round < n; round++) {
      assert.equal(new Set(Object.values(schedule[round])).size, n);
      if (round)
        for (const id of ids)
          assert.notEqual(schedule[round][id], schedule[round - 1][id]);
    }
  });
test("minimum players, readiness, mic requirements and role permissions", () => {
  const f = fixture("duo", 3);
  assert.throws(() => f.room.start(), /4 players/);
  f.room.add({ name: "fourth" });
  assert.throws(() => f.room.start(), /ready/);
  const g = fixture();
  assert.throws(() => g.send(g.players[1].id, "start"), /host/);
  // Classic: a missing mic check does not block the match or a turn; the player is asked for the mic on their turn.
  g.players[0].mic = false;
  g.room.start();
  assert.equal(g.room.phase, "choose");
  // Other modes still need everyone's mic check.
  const d = fixture("duo", 4);
  d.players[0].mic = false;
  assert.throws(() => d.room.start(), /microphones/);
});
test("classic completes, hides choices, keeps matching private and prevents duplicate points", () => {
  const f = fixture();
  f.room.start();
  let rounds = 0;
  while (f.room.phase !== "results") {
    const performer = f.room.performerIds[0];
    assert.equal(f.room.view(f.room.eligible[0]).choices, undefined);
    f.send(performer, "pick", { promptId: f.room.choices[0].id });
    assert.equal(f.room.view(f.room.eligible[0]).prompt, undefined);
    f.expire();
    for (const id of f.room.eligible) {
      f.send(id, "guess", { text: f.room.prompt.phrase });
      const score = f.room.player(id).score;
      if (f.room.phase === "perform") {
        f.later(1000);
        f.send(id, "guess", { text: f.room.prompt.phrase });
        assert.equal(f.room.player(id).score, score);
      }
    }
    assert.equal(f.room.phase, "roundReveal");
    assert.equal(f.room.player(performer).score >= 200, true);
    f.send(f.room.host, "next");
    rounds++;
  }
  assert.equal(rounds, 4);
});
test("room settings: shuffles, pick time, hints and flat scoring are validated and honored", () => {
  const f = fixture();
  const next = (patch) =>
    f.send(f.room.host, "settings", {
      settings: { ...f.room.settings, ...patch },
    });
  next({
    shuffles: 3,
    chooseSeconds: 10,
    hints: false,
    speedBonus: false,
    performanceSeconds: 90,
  });
  assert.equal(f.room.settings.shuffles, 3);
  assert.throws(() => next({ shuffles: 4 }), /shuffle or timing/);
  assert.throws(() => next({ chooseSeconds: 15 }), /shuffle or timing/);
  assert.throws(() => next({ performanceSeconds: 45 }), /timing/);
  f.room.players.forEach((p) => (p.ready = true));
  f.room.start();
  assert.equal(f.room.deadline - f.room.started, 10000);
  const performer = f.room.performerIds[0];
  for (let i = 0; i < 3; i++) {
    f.send(performer, "skipPrompt");
    f.later(10);
  }
  assert.throws(() => f.send(performer, "skipPrompt"), /No shuffles left/);
  f.send(performer, "pick", { promptId: f.room.choices[0].id });
  f.expire();
  const guesser = f.room.eligible[0];
  assert.equal(f.room.view(guesser).hint, undefined);
  f.send(guesser, "guess", { text: f.room.prompt.phrase });
  assert.equal(f.room.player(guesser).score, 150);
});
test("room settings: with zero shuffles nobody can reshuffle, and defaults keep the speed bonus and hints", () => {
  const f = fixture();
  assert.equal(f.room.settings.speedBonus, true);
  assert.equal(f.room.settings.hints, true);
  f.send(f.room.host, "settings", {
    settings: { ...f.room.settings, shuffles: 0 },
  });
  f.room.players.forEach((p) => (p.ready = true));
  f.room.start();
  assert.throws(
    () => f.send(f.room.performerIds[0], "skipPrompt"),
    /No shuffles left/,
  );
  f.send(f.room.performerIds[0], "pick", { promptId: f.room.choices[0].id });
  f.expire();
  assert.ok(f.room.view(f.room.eligible[0]).hint);
});
test("unauthorized, stale, oversized and out-of-phase events are rejected", () => {
  const f = fixture();
  f.room.start();
  assert.throws(
    () =>
      f.send(f.room.eligible[0], "pick", { promptId: f.room.choices[0].id }),
    /performer/,
  );
  assert.throws(() => f.send(f.room.host, "vote", { ranking: [] }), /closed/);
  assert.throws(
    () => f.room.dispatch(f.room.host, "pick", { phaseId: -1 }),
    /moved/,
  );
  assert.throws(
    () =>
      f.room.storeAudio(
        f.room.host,
        Buffer.alloc(200),
        "audio/webm",
        1,
        f.room.phaseId,
      ),
    /ended/,
  );
});
test("Duo reveals complementary private roles and scores a complete scene", () => {
  const f = fixture("duo");
  f.room.start();
  assert.notEqual(
    f.room.view(f.room.performerIds[0]).prompt,
    f.room.view(f.room.performerIds[1]).prompt,
  );
  assert.equal(f.room.view(f.room.eligible[0]).prompt, undefined);
  f.expire();
  for (const id of f.room.eligible)
    f.send(id, "guess", { text: f.room.prompt.phrase });
  assert.equal(f.room.phase, "roundReveal");
  for (const id of f.room.performerIds)
    assert.equal(f.room.player(id).score, 200);
  f.send(f.room.host, "next");
  assert.equal(f.room.phase, "results");
});
test("Gartic alternating authentic entries, privacy, passes, reveal and cleanup", () => {
  const f = fixture("gartic", 4);
  f.room.start();
  const originals = Object.fromEntries(
    Object.entries(f.room.chains).map(([id, c]) => [id, c.id]),
  );
  for (let round = 0; round < 4; round++) {
    assert.equal(f.room.phase, round % 2 ? "interpret" : "record");
    for (const id of f.room.ids) {
      const view = f.room.view(id);
      assert.equal(view.chain, undefined);
      assert.equal(view.chains, undefined);
      if (round === 0) {
        const key = f.room.storeAudio(
          id,
          Buffer.alloc(200, 1),
          "audio/webm",
          1,
          f.room.phaseId,
        );
        assert.ok(f.room.canHear(id, key));
        const other = f.room.ids.find((x) => x !== id);
        assert.equal(f.room.canHear(other, key), false);
        f.send(id, "submit", { audioId: key });
      } else if (round % 2)
        f.send(id, "submit", {
          text: `Interpretation ${id.slice(0, 4)} round ${round}`,
        });
      else f.send(id, "pass");
    }
    f.expire();
  }
  assert.equal(f.room.phase, "chainReveal");
  for (const [owner, chain] of Object.entries(f.room.chains)) {
    assert.equal(chain.id, originals[owner]);
    assert.equal(chain.entries.length, 5);
    assert.equal(chain.entries[3].type, "missing");
    assert.equal(chain.entries.at(-1).type, "text");
    assert.equal(new Set(chain.entries.slice(1).map((e) => e.author)).size, 4);
  }
  while (f.room.phase === "chainReveal") {
    const v = f.room.view(f.room.host);
    assert.equal(v.chain.entries.length, f.room.revealStep + 1);
    f.send(f.room.host, "next");
  }
  assert.equal(f.room.phase, "results");
  f.send(f.room.host, "again");
  assert.equal(f.room.audio.size, 0);
  assert.equal(f.room.phase, "lobby");
});
test("three-player Gartic ends with genuine audio, no fabricated text", () => {
  const f = fixture("gartic", 3);
  f.room.start();
  submitRecordings(f);
  for (const id of f.room.ids)
    f.send(id, "submit", { text: "An actual guess" });
  f.expire();
  submitRecordings(f);
  assert.equal(f.room.phase, "chainReveal");
  for (const c of Object.values(f.room.chains))
    assert.equal(c.entries.at(-1).type, "audio");
});
test("custom starting phrases remain private and pass preserves suggested prompt", () => {
  const f = fixture("gartic", 3);
  f.room.settings.customPrompts = true;
  f.room.start();
  assert.equal(f.room.phase, "seed");
  const id = f.room.ids[0];
  f.send(id, "submit", { text: "Custom kettle" });
  for (const other of f.room.ids.slice(1)) f.send(other, "pass");
  f.expire();
  assert.equal(f.room.chains[id].entries[0].text, "Custom kettle");
  assert.equal(f.room.view(f.room.ids[1]).task.text.includes("Custom"), false);
});
test("Sound Detective outsider secrecy, private votes, tie and final guess", () => {
  const f = fixture("detective");
  f.room.start();
  assert.equal(f.room.view(f.room.outsider).prompt, null);
  const innocent = f.room.ids.find((id) => id !== f.room.outsider);
  assert.ok(f.room.view(innocent).prompt);
  f.expire();
  for (let i = 0; i < 4; i++) f.expire();
  assert.equal(f.room.phase, "vote");
  for (const id of f.room.ids) f.send(id, "vote", { target: null });
  assert.equal(f.room.phase, "outsider");
  f.send(f.room.outsider, "outsiderGuess", { text: f.room.prompt.phrase });
  assert.equal(f.room.phase, "roundReveal");
  assert.equal(f.room.voteResult.caught, false);
  assert.equal(f.room.voteResult.escaped, true);
  assert.equal(f.room.player(f.room.outsider).score, 200);
  f.send(f.room.host, "next");
  assert.equal(f.room.phase, "results");
});
for (const mode of ["foley", "ranking"])
  test(`${mode}: recording, anonymous playback, no self-voting, ballots and results`, () => {
    const f = fixture(mode);
    f.room.start();
    submitRecordings(f);
    assert.equal(f.room.phase, "listening");
    let first = f.room.view(f.room.host).entries[0];
    assert.equal(first.author, undefined);
    while (f.room.phase === "listening") f.send(f.room.host, "next");
    for (const id of f.room.ids) {
      const own = f.room.entries.find((e) => e.author === id);
      assert.throws(() => f.send(id, "vote", { ranking: [own.id] }), /own/);
      const ids = f.room.entries
        .filter((e) => e.author !== id)
        .map((e) => e.id);
      f.send(id, "vote", { ranking: mode === "foley" ? ids.slice(0, 1) : ids });
    }
    assert.equal(f.room.phase, "roundReveal");
    assert.ok(f.room.voteResult.every((e) => e.author));
    f.send(f.room.host, "next");
    assert.equal(f.room.phase, "results");
  });
test("ranking scores use normalized descending Borda points and missing ballots contribute zero", () => {
  const entries = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(rankingScores(entries, { p: ["b", "a"] }), {
    a: 0.5,
    b: 1,
    c: 0,
  });
});
test("host migration, late spectator and frozen eligible set", () => {
  const f = fixture();
  f.room.start();
  const eligible = [...f.room.eligible];
  f.room.disconnect(f.room.host);
  assert.notEqual(f.room.host, f.players[0].id);
  assert.deepEqual(f.room.eligible, eligible);
  const late = f.room.add({ name: "Late friend" });
  assert.equal(late.spectator, true);
  assert.equal(f.room.view(late.id).choices, undefined);
  assert.throws(() => f.send(late.id, "submit", { text: "no" }), /watching/);
});
test("no-submission timeouts advance every recording mode without fabricated audio", () => {
  for (const mode of ["gartic", "foley", "ranking"]) {
    const f = fixture(mode);
    f.room.start();
    for (
      let i = 0;
      i < 8 && !["chainReveal", "roundReveal"].includes(f.room.phase);
      i++
    )
      f.expire();
    assert.ok(["chainReveal", "roundReveal"].includes(f.room.phase));
    assert.equal(f.room.audio.size, 0);
  }
});
test("Gartic awards: optional, no self-votes, ties share a title, results carry winners", () => {
  const f = fixture("gartic", 3);
  f.room.settings = { ...f.room.settings, awards: true };
  f.room.start();
  submitRecordings(f);
  for (const id of f.room.ids)
    f.send(id, "submit", { text: "An actual guess" });
  f.expire();
  submitRecordings(f);
  while (f.room.phase === "chainReveal") f.send(f.room.host, "next");
  assert.equal(f.room.phase, "awards");
  const [a, b, c] = f.room.ids;
  const view = f.room.view(a);
  assert.equal(view.awardChains.length, 3);
  assert.equal(view.awards, undefined);
  const ownChain = view.awardChains.find((x) => x.own);
  const otherChain = view.awardChains.find((x) => !x.own);
  assert.throws(
    () => f.send(a, "award", { picks: { funniest: ownChain.id } }),
    /own chain/,
  );
  const ownSound = view.awardChains
    .flatMap((x) => x.entries)
    .find((e) => e.own && e.audioId);
  assert.throws(
    () => f.send(a, "award", { picks: { bestSound: ownSound.ref } }),
    /own sound/,
  );
  f.send(a, "award", { picks: { funniest: otherChain.id } });
  f.send(a, "award", { picks: { funniest: ownChain.id } }); // repeat is ignored, not an error
  f.send(b, "award", { picks: {} }); // abstaining is allowed
  assert.equal(f.room.phase, "awards");
  f.send(c, "award", {
    picks: { funniest: f.room.view(c).awardChains.find((x) => !x.own).id },
  });
  assert.equal(f.room.phase, "results");
  const funniest = f.room.view(a).awards.find((x) => x.key === "funniest");
  assert.ok(funniest.winners.length >= 1 && funniest.votes >= 1);
});
test("Gartic without awards goes straight to results", () => {
  const f = fixture("gartic", 3);
  f.room.start();
  submitRecordings(f);
  for (const id of f.room.ids)
    f.send(id, "submit", { text: "An actual guess" });
  f.expire();
  submitRecordings(f);
  while (f.room.phase === "chainReveal") f.send(f.room.host, "next");
  assert.equal(f.room.phase, "results");
});
test("faces: a valid look is kept, an exact copy is nudged, junk gets a random free face", async () => {
  const { parseLook, formatLook, randomLook, sizeOf } =
    await import("../shared/looks.js");
  const room = new Room("AVATAR", { now: () => 1 });
  const first = room.add({ name: "A", avatar: "cat.3.2.4.5.1" });
  assert.equal(first.avatar, "cat.3.2.4.5.1");
  const copy = room.add({ name: "B", avatar: "cat.3.2.4.5.1" });
  assert.notEqual(copy.avatar, first.avatar, "an exact copy is changed");
  assert.equal(parseLook(copy.avatar).hat, 5, "only the colour is nudged");
  const plain = room.add({ name: "C", avatar: "ghost" });
  assert.equal(
    plain.avatar,
    "ghost.2.0.0.0.0",
    "a plain shape name still works",
  );
  for (const junk of [
    "nope",
    "cat.99.0.0.0.0",
    "cat.1.2.3",
    "cat.1.2.3.4.5.6",
    "",
    undefined,
    7,
  ]) {
    const p = room.add({ name: "J", avatar: junk, spectator: true });
    assert.ok(parseLook(p.avatar), `${junk} becomes a real face`);
    assert.equal(formatLook(parseLook(p.avatar)), p.avatar);
  }
  const all = room.players.map((p) => p.avatar);
  assert.equal(
    new Set(all).size,
    all.length,
    "every face in the room is different",
  );
  const look = randomLook();
  for (const [trait, n] of [
    ["color", sizeOf("color")],
    ["eyes", sizeOf("eyes")],
    ["mouth", sizeOf("mouth")],
    ["hat", sizeOf("hat")],
    ["extra", sizeOf("extra")],
  ])
    assert.ok(look[trait] >= 0 && look[trait] < n);
});
test("two players: Duo and Detective still need four, the other modes start", () => {
  for (const mode of ["duo", "detective"])
    assert.throws(() => fixture(mode, 2).room.start(), /4 players/);
  for (const mode of ["classic", "gartic", "foley", "ranking"]) {
    const f = fixture(mode, 2);
    f.room.start();
    assert.notEqual(f.room.phase, "lobby", mode);
  }
  assert.throws(() => fixture("classic", 1).room.start(), /2 players/);
});
test("two-player Classic: one performer, one guesser, full match", () => {
  const f = fixture("classic", 2);
  f.room.start();
  while (f.room.phase !== "results") {
    const performer = f.room.performerIds[0];
    const [guesser] = f.room.ids.filter((id) => id !== performer);
    f.send(performer, "pick", { promptId: f.room.choices[0].id });
    f.expire();
    assert.deepEqual(f.room.eligible, [guesser]);
    f.send(guesser, "guess", { text: f.room.prompt.phrase });
    assert.equal(f.room.phase, "roundReveal");
    f.send(f.room.host, "next");
  }
  assert.ok(f.room.player(f.room.ids[0]).score > 0);
});
test("two-player Gartic: word to sound to word, each chain touched by both players", () => {
  const f = fixture("gartic", 2);
  f.room.start();
  submitRecordings(f);
  for (const id of f.room.ids)
    f.send(id, "submit", { text: "A guess from the other side" });
  f.expire();
  assert.equal(f.room.phase, "chainReveal");
  for (const chain of Object.values(f.room.chains)) {
    assert.deepEqual(
      chain.entries.map((e) => e.type),
      ["text", "audio", "text"],
    );
    assert.notEqual(chain.entries[2].author, chain.entries[1].author);
  }
  while (f.room.phase === "chainReveal") f.send(f.room.host, "next");
  assert.equal(f.room.phase, "results");
});
test("word library: 1,000+ unique entries, every one is one or two words, no spoilers beyond samples", async () => {
  const {
    WORD_PACKS,
    WORD_TOTAL,
    FAMILY_TOTAL,
    WORD_SETTINGS,
    cleanStartingWord,
    libraryOverview,
    wordsFor,
  } = await import("../server/words.js");
  assert.ok(WORD_TOTAL >= 1000);
  assert.ok(WORD_PACKS.length >= 12);
  const all = WORD_PACKS.flatMap((p) => p.words);
  assert.equal(new Set(all.map((w) => w.toLowerCase())).size, all.length);
  for (const w of all) assert.equal(cleanStartingWord(w), w, w);
  assert.ok(
    WORD_SETTINGS.includes("sounds") && WORD_SETTINGS.includes("mixed"),
  );
  assert.equal(wordsFor("sounds"), null);
  assert.equal(wordsFor("mixed").length, FAMILY_TOTAL);
  assert.ok(
    FAMILY_TOTAL < WORD_TOTAL,
    "the adult pack stays out of Everything",
  );
  const spicy = WORD_PACKS.find((p) => p.id === "spicy");
  assert.ok(spicy.adult && spicy.words.length >= 60);
  assert.ok(!wordsFor("mixed").includes(spicy.words[0]));
  const overview = libraryOverview(6);
  for (const p of overview.packs) {
    assert.ok(p.samples.length <= 6 && p.count > 20);
    assert.equal(p.words, undefined);
  }
});
test("starting words must be one or two words, not a sentence", async () => {
  const { cleanStartingWord } = await import("../server/words.js");
  assert.equal(cleanStartingWord("  Pizza  "), "Pizza");
  assert.equal(cleanStartingWord("Hot   Dog"), "Hot Dog");
  assert.equal(cleanStartingWord("Spider-Man"), "Spider-Man");
  assert.equal(cleanStartingWord("Rock n’ Roll"), null);
  for (const bad of [
    "",
    "   ",
    "a big angry dog",
    "My dog is loud",
    "x".repeat(25),
    "wow!!",
    "<b>hi</b>",
    42,
    null,
  ])
    assert.equal(cleanStartingWord(bad), null, String(bad));
});
test("own-word Gartic: seed phase accepts 1-2 words only, passing keeps the library word", () => {
  const f = fixture("gartic", 3);
  f.room.settings = { ...f.room.settings, customPrompts: true };
  f.room.start();
  assert.equal(f.room.phase, "seed");
  const [a, b, c] = f.room.ids;
  assert.throws(
    () => f.send(a, "submit", { text: "a giant sleepy panda" }),
    /one or two words/,
  );
  assert.throws(() => f.send(a, "submit", { text: "" }), /one or two words/);
  f.send(a, "submit", { text: "Disco Llama" });
  f.send(b, "submit", { text: "Toaster" });
  const keep = f.room.chains[c].entries[0].text;
  f.send(c, "pass");
  f.expire();
  assert.equal(f.room.chains[a].entries[0].text, "Disco Llama");
  assert.equal(f.room.chains[b].entries[0].text, "Toaster");
  assert.equal(f.room.chains[c].entries[0].text, keep);
  assert.notEqual(f.room.phase, "seed");
});
test("word packs: draws stay inside the chosen pack and shuffle is limited to three", async () => {
  const { wordsFor } = await import("../server/words.js");
  const f = fixture("gartic", 4);
  f.room.settings = {
    ...f.room.settings,
    customPrompts: true,
    wordPacks: ["animals"],
  };
  f.room.start();
  const animals = new Set(wordsFor("animals"));
  for (const id of f.room.ids)
    assert.ok(animals.has(f.room.chains[id].entries[0].text));
  const first = f.room.ids[0];
  for (let i = 0; i < 3; i++) {
    f.send(first, "shuffleSeed");
    assert.ok(animals.has(f.room.chains[first].entries[0].text));
  }
  assert.equal(f.room.view(first).seedShuffles, 0);
  assert.throws(() => f.send(first, "shuffleSeed"), /No more shuffles/);
  assert.throws(
    () =>
      f.send(
        f.room.ids.find((id) => id !== f.room.host),
        "settings",
        { settings: {} },
      ),
    /host/,
  );
  const lobby = fixture("gartic", 3);
  assert.throws(
    () =>
      lobby.send(lobby.room.host, "settings", {
        settings: { ...lobby.room.settings, wordPacks: ["nope"] },
      }),
    /word pack/,
  );
  lobby.send(lobby.room.host, "settings", {
    settings: { ...lobby.room.settings, wordPacks: ["food"] },
  });
  assert.deepEqual(lobby.room.settings.wordPacks, ["food"]);
});
test("a pack never repeats a word until it is used up", () => {
  const f = fixture("gartic", 8);
  f.room.settings = { ...f.room.settings, wordPacks: ["vehicles"] };
  const drawn = Array.from({ length: 40 }, () => f.room.drawWord());
  assert.equal(new Set(drawn).size, 40);
});

test("spicy pack is opt-in: needs the 18+ confirmation, stays out of Everything and previews nothing", async () => {
  const { libraryOverview } = await import("../server/words.js");
  const f = fixture("classic", 3);
  const base = { ...f.room.settings };
  assert.throws(
    () =>
      f.send(f.room.host, "settings", {
        settings: { ...base, wordPacks: ["spicy"] },
      }),
    /18\+/,
  );
  assert.throws(
    () =>
      f.send(f.room.host, "settings", {
        settings: { ...base, wordPacks: ["spicy"], adultsOnly: "yes" },
      }),
    /18\+/,
  );
  f.send(f.room.host, "settings", {
    settings: { ...base, wordPacks: ["spicy"], adultsOnly: true },
  });
  assert.equal(f.room.settings.adultsOnly, true);
  f.send(f.room.host, "settings", {
    settings: { ...base, wordPacks: ["food"], adultsOnly: true },
  });
  assert.equal(
    f.room.settings.adultsOnly,
    false,
    "leaving the spicy pack clears the flag",
  );
  const spicy = libraryOverview().packs.find((p) => p.id === "spicy");
  assert.equal(spicy.adult, true);
  assert.deepEqual(spicy.samples, []);
});
test("Classic deals 3, 4 or 5 words to pick from, easiest first, all distinct", () => {
  for (const count of [3, 4, 5]) {
    const f = fixture("classic", 3);
    f.room.settings = { ...f.room.settings, choices: count };
    f.room.start();
    const ranks = { easy: 0, medium: 1, hard: 2 };
    assert.equal(f.room.choices.length, count);
    assert.equal(new Set(f.room.choices.map((p) => p.id)).size, count);
    const sorted = [...f.room.choices].sort(
      (a, b) => ranks[a.difficulty] - ranks[b.difficulty],
    );
    assert.deepEqual(
      f.room.choices.map((p) => p.id),
      sorted.map((p) => p.id),
    );
    const performer = f.room.performerIds[0];
    const view = f.room.view(performer);
    assert.equal(view.choices.length, count);
    assert.ok(view.choices.every((c) => c.category && c.difficulty));
    const guesser = f.room.ids.find((id) => id !== performer);
    assert.equal(f.room.view(guesser).choices, undefined);
  }
  assert.throws(() => {
    const f = fixture("classic", 3);
    f.send(f.room.host, "settings", {
      settings: { ...f.room.settings, choices: 9 },
    });
  }, /3, 4 or 5/);
});
test("Classic draws from the chosen pack, matches library guesses and keeps spicy out of Everything", async () => {
  const { wordsFor } = await import("../server/words.js");
  const f = fixture("classic", 3);
  f.room.settings = { ...f.room.settings, wordPacks: ["animals"], choices: 5 };
  const animals = new Set(wordsFor("animals"));
  f.room.start();
  assert.ok(f.room.choices.every((p) => animals.has(p.phrase)));
  const pick = f.room.choices[0];
  const performer = f.room.performerIds[0];
  const guesser = f.room.ids.find((id) => id !== performer);
  f.send(performer, "pick", { promptId: pick.id });
  f.expire();
  f.send(guesser, "guess", { text: pick.phrase.toLowerCase() });
  assert.ok(f.room.solved[guesser] > 0);

  // famous names can be guessed by surname
  const g = fixture("classic", 3);
  g.room.settings = { ...g.room.settings, wordPacks: ["people"] };
  g.room.start();
  const person =
    g.room.choices.find((p) => p.phrase.includes(" ")) || g.room.choices[0];
  g.send(g.room.performerIds[0], "pick", { promptId: person.id });
  g.expire();
  const other = g.room.ids.find((id) => id !== g.room.performerIds[0]);
  g.send(other, "guess", { text: person.phrase.split(" ").at(-1) });
  assert.ok(g.room.solved[other] > 0);

  // "Everything" never deals a spicy word
  const spicyWords = new Set(wordsFor("spicy"));
  const all = fixture("classic", 3);
  all.room.settings = {
    ...all.room.settings,
    wordPacks: ["mixed"],
    choices: 5,
  };
  for (let i = 0; i < 60; i++)
    assert.ok(all.room.drawChoices().every((p) => !spicyWords.has(p.phrase)));
});

test("Classic only deals one- or two-word prompts, never scenes or sentences", async () => {
  const { prompts } = await import("../server/prompts.js");
  const short = prompts.filter(
    (p) =>
      p.modes.includes("classic") && p.phrase.trim().split(/\s+/).length <= 2,
  );
  assert.ok(short.length >= 100, "enough short sound ideas to deal from");
  for (const wordPack of ["sounds", "mixed", "animals", "people", "spicy"]) {
    const f = fixture("classic", 3);
    f.room.settings = {
      ...f.room.settings,
      wordPacks: [wordPack],
      choices: 5,
    };
    for (let i = 0; i < 80; i++)
      for (const p of f.room.drawChoices())
        assert.ok(
          p.phrase.trim().split(/\s+/).length <= 2,
          `${wordPack}: ${p.phrase}`,
        );
  }
});
test("small Classic rooms always play at least four rounds, whoever checked a mic", () => {
  const rounds = (n, micCount) => {
    const f = fixture("classic", n);
    f.players.forEach((p, i) => (p.mic = i < micCount));
    f.room.settings = { ...f.room.settings, rounds: 1 };
    f.room.start();
    return f.room.totalRounds;
  };
  assert.equal(rounds(2, 2), 4); // each of two friends performs twice
  assert.equal(rounds(2, 1), 4); // still a real game, not a single round
  assert.equal(rounds(3, 3), 6);
  assert.equal(rounds(4, 4), 4);
  // both friends really get turns on the mic
  const f = fixture("classic", 2);
  f.room.start();
  const performers = new Set();
  while (f.room.phase !== "results") {
    const performer = f.room.performerIds[0];
    performers.add(performer);
    f.send(performer, "pick", { promptId: f.room.choices[0].id });
    f.expire();
    const guesser = f.room.ids.find((id) => id !== performer);
    f.send(guesser, "guess", { text: f.room.prompt.phrase });
    f.send(f.room.host, "next");
  }
  assert.equal(performers.size, 2);
});

test("Classic: everyone takes turns on the mic, even players who skipped the mic check", () => {
  for (const n of [2, 3, 5]) {
    const f = fixture("classic", n);
    f.players.forEach((p, i) => (p.mic = i === 0)); // only one player did a mic check
    f.room.start();
    const turns = {};
    while (f.room.phase !== "results") {
      const performer = f.room.performerIds[0];
      turns[performer] = (turns[performer] || 0) + 1;
      f.send(performer, "pick", { promptId: f.room.choices[0].id });
      f.expire();
      for (const id of [...f.room.eligible])
        f.send(id, "guess", { text: f.room.prompt.phrase });
      f.send(f.room.host, "next");
    }
    assert.equal(Object.keys(turns).length, n, `${n} players all perform`);
    const counts = Object.values(turns);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 0, "equal turns");
  }
});
test("Classic can start with nobody having done a mic check", () => {
  const f = fixture("classic", 3);
  f.players.forEach((p) => (p.mic = false));
  f.room.start();
  assert.equal(f.room.phase, "choose");
});
test("several packs can be mixed: draws stay inside them, spicy needs the 18+ flag", async () => {
  const { wordsFor, hasAdultPack } = await import("../server/words.js");
  const f = fixture("classic", 3);
  const base = { ...f.room.settings };
  delete base.wordPack;
  f.send(f.room.host, "settings", {
    settings: { ...base, wordPacks: ["animals", "food", "vehicles"] },
  });
  assert.deepEqual(f.room.settings.wordPacks, ["animals", "food", "vehicles"]);
  const allowed = new Set([
    ...wordsFor("animals"),
    ...wordsFor("food"),
    ...wordsFor("vehicles"),
  ]);
  const seenPacks = new Set();
  for (let i = 0; i < 80; i++)
    for (const p of f.room.drawChoices(5)) {
      assert.ok(allowed.has(p.phrase), p.phrase);
      seenPacks.add(p.category);
    }
  assert.equal(seenPacks.size, 3, "every chosen pack shows up");
  assert.throws(
    () =>
      f.send(f.room.host, "settings", {
        settings: { ...base, wordPacks: ["animals", "spicy"] },
      }),
    /18\+/,
  );
  f.send(f.room.host, "settings", {
    settings: { ...base, wordPacks: ["animals", "spicy"], adultsOnly: true },
  });
  assert.equal(f.room.settings.adultsOnly, true);
  assert.ok(hasAdultPack(f.room.settings.wordPacks));
  assert.throws(
    () =>
      f.send(f.room.host, "settings", {
        settings: { ...base, wordPacks: [] },
      }),
    /at least one/,
  );
  assert.throws(
    () =>
      f.send(f.room.host, "settings", {
        settings: { ...base, wordPacks: ["animals", "nope"] },
      }),
    /at least one/,
  );
  f.send(f.room.host, "settings", {
    settings: { ...base, wordPacks: ["sounds", "animals"] },
  });
  const phrases = new Set();
  for (let i = 0; i < 60; i++)
    for (const p of f.room.drawChoices(5)) phrases.add(p.id.startsWith("lib:"));
  assert.equal(phrases.size, 2, "sound ideas and the animals pack both appear");
});
test("the spicy pack is made of sounds you can actually perform", async () => {
  const { WORD_PACKS } = await import("../server/words.js");
  const spicy = WORD_PACKS.find((p) => p.id === "spicy").words.map((w) =>
    w.toLowerCase(),
  );
  for (const w of ["moaning", "slurping", "heavy breathing", "kissing noises"])
    assert.ok(spicy.includes(w), w);
  assert.ok(!spicy.includes("rizz") && !spicy.includes("situationship"));
});

test("guessing is forgiving: a single meaningful word, another word form or a compound all count", async () => {
  const { libraryPrompt } = await import("../server/words.js");
  const ok = (word, pack, guesses) => {
    const prompt = libraryPrompt(word, pack);
    for (const g of guesses)
      assert.ok(matchPrompt(prompt, g).correct, `${g} should match ${word}`);
  };
  const no = (word, pack, guesses) => {
    const prompt = libraryPrompt(word, pack);
    for (const g of guesses)
      assert.ok(!matchPrompt(prompt, g).correct, `${g} must not match ${word}`);
  };
  ok("Sultry Whisper", "spicy", ["whisper", "whispering", "is it a whisper?"]);
  ok("Moaning", "spicy", ["moan", "moans", "MOANING"]);
  ok("Heavy Breathing", "spicy", ["breathing", "breath"]);
  ok("Cat Call", "spicy", ["catcall", "call", "wolf whistle"]);
  ok("Walk-Of-Shame", "spicy", ["shame", "walk of shame"]);
  ok("Hot Tub", "spicy", ["tub", "jacuzzi"]);
  ok("Space Station", "science", ["station", "space"]);
  ok("Ice-Cream Lick", "spicy", ["lick", "ice cream"]);
  ok("Johnny Depp", "people", ["depp", "johnny depp"]);
  ok("Spider-Man", "characters", ["spiderman", "spider man"]);
  // weak words alone are not enough
  no("Sultry Whisper", "spicy", ["sultry", "voice", "whale"]);
  no("Heavy Breathing", "spicy", ["heavy", "bedroom"]);
  no("Hot Tub", "spicy", ["hot"]);
  no("Cat Call", "spicy", ["cat"]);
  no("Johnny Depp", "people", ["johnny"]);
  no("Spider-Man", "characters", ["man", "spider"]);
  // curated sound ideas get the same treatment
  const alarm = prompts.find((p) => p.phrase === "Alarm clock");
  assert.ok(matchPrompt(alarm, "clock").correct);
  assert.ok(matchPrompt(alarm, "alarms").correct);
  const kettle = prompts.find((p) => p.phrase === "Kettle");
  assert.ok(matchPrompt(kettle, "kettles").correct);
  assert.ok(!matchPrompt(kettle, "cattle").correct);
  // scenes still need all their parts
  const robot = prompts.find((p) => p.phrase === "Robot with hiccups");
  assert.ok(!matchPrompt(robot, "robot").correct);
});

test("a page from an older build still works: its single wordPack choice is honored and mirrored back", () => {
  const f = fixture("classic", 3);
  const host = f.room.host;
  // an old page echoes back the settings it was given and changes only wordPack
  const settings = { ...f.room.settings, wordPack: "animals" };
  f.send(host, "settings", { settings });
  assert.deepEqual(f.room.settings.wordPacks, ["animals"]);
  assert.equal(f.room.view(host).settings.wordPack, "animals");
  // a current page changes the list and does not send the legacy field
  const { wordPack, ...current } = f.room.settings;
  f.send(host, "settings", {
    settings: { ...current, wordPacks: ["food", "vehicles"] },
  });
  assert.deepEqual(f.room.settings.wordPacks, ["food", "vehicles"]);
  assert.ok(f.room.view(host).build);
});

test("Everything + Spicy: both are selectable together and spicy words really show up", async () => {
  const { wordsFor } = await import("../server/words.js");
  const f = fixture("classic", 3);
  const { wordPack, ...current } = f.room.settings;
  f.send(f.room.host, "settings", {
    settings: { ...current, wordPacks: ["mixed", "spicy"], adultsOnly: true },
  });
  assert.deepEqual(f.room.settings.wordPacks, ["mixed", "spicy"]);
  assert.equal(f.room.settings.adultsOnly, true);
  const spicy = new Set(wordsFor("spicy"));
  let spicyDealt = 0;
  let total = 0;
  for (let i = 0; i < 100; i++)
    for (const p of f.room.drawChoices(5)) {
      total++;
      if (spicy.has(p.phrase)) spicyDealt++;
    }
  assert.ok(spicyDealt / total > 0.1, `spicy share ${spicyDealt / total}`);
  assert.ok(spicyDealt < total, "family words still appear");
  // it also works for Gartic starting words
  const g = fixture("gartic", 4);
  g.room.settings = { ...g.room.settings, wordPacks: ["mixed", "spicy"] };
  const words = Array.from({ length: 200 }, () => g.room.drawWord());
  assert.ok(
    words.some((w) => spicy.has(w)) && words.some((w) => !spicy.has(w)),
  );
});
