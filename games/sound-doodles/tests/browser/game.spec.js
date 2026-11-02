import { test, expect } from "@playwright/test";
import { createApp } from "../../server/index.js";
let app;
const base = "http://localhost:3101";
test.beforeAll(async () => {
  process.env.PUBLIC_ORIGIN = base;
  app = await createApp({ production: true, port: 3101 });
});
test.afterAll(async () => {
  await app.close();
});

async function group(browser, count = 4) {
  const contexts = [],
    pages = [];
  const errors = [];
  for (let i = 0; i < count; i++) {
    const context = await browser.newContext({
      permissions: ["microphone"],
      viewport: { width: 1280, height: 900 },
    });
    contexts.push(context);
    await context.addInitScript(() => {
      window.__peers = [];
      const Native = window.RTCPeerConnection;
      window.RTCPeerConnection = class extends Native {
        constructor(...args) {
          super(...args);
          window.__peers.push(this);
        }
      };
    });
    const page = await context.newPage();
    pages.push(page);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page
      .getByRole("button", {
        name: i ? "Join a room" : "Create a room",
        exact: true,
      })
      .click();
    await page.getByLabel("Your nickname").fill(`Friend ${i + 1}`);
    if (i)
      await page
        .getByLabel("Room code")
        .fill(new URL(pages[0].url()).searchParams.get("room"));
    await page
      .getByRole("button", {
        name: i ? "Join room" : "Create room",
        exact: true,
      })
      .click();
    await expect(page.getByText("Tonight’s game")).toBeVisible();
  }
  const code = new URL(pages[0].url()).searchParams.get("room"),
    room = app.rooms.get(code);
  await Promise.all(
    pages.map(async (page) => {
      await page.getByRole("button", { name: "A quick mic check?" }).click();
      await page
        .getByRole("button", { name: "Test microphone", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Stop recording", exact: true }),
      ).toBeVisible();
      await page.waitForTimeout(350);
      await page
        .getByRole("button", { name: "Stop recording", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Record again", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Done", exact: true }).click();
    }),
  );
  return {
    contexts,
    pages,
    room,
    errors,
    close: async () => {
      for (const c of contexts) await c.close();
    },
  };
}
async function configure(g, mode, extra) {
  const host = g.pages[0];
  console.log("configure", mode);
  if (!["classic", "gartic"].includes(mode))
    await host
      .getByRole("button", { name: "Four more ways to make a scene" })
      .click();
  const names = {
    classic: "Classic",
    gartic: "Gartic Sounds",
    duo: "Duo Orchestra",
    detective: "Sound Detective",
    foley: "Five-Second Foley",
    ranking: "Blind Ranking",
  };
  if (mode !== "classic")
    await host
      .locator(mode === "gartic" ? ".lobby-mode" : ".extra-mode-grid button")
      .filter({ hasText: names[mode] })
      .click();
  await host.getByRole("button", { name: "Room settings" }).click();
  console.log("settings open");
  await host
    .getByLabel(mode === "classic" ? "Turns per performer" : "Rounds", {
      exact: true,
    })
    .selectOption("1");
  await expect.poll(() => g.room.settings.rounds).toBe(1);
  if (extra) await extra(host);
  // Settings live in a slide-over drawer; close it before the rest of the lobby is usable.
  await host.keyboard.press("Escape");
  console.log("rounds set");
  await Promise.all(
    g.pages.map((p) =>
      p.getByRole("button", { name: "Ready up", exact: true }).click(),
    ),
  );
  console.log(
    "ready",
    g.room.players.map((p) => ({ name: p.name, ready: p.ready, mic: p.mic })),
  );
  await host.getByRole("button", { name: "Let’s make noise" }).click();
  console.log("started", g.room.phase);
  await expect.poll(() => g.room.phase).not.toBe("lobby");
}
async function expire(room) {
  room.deadline = Date.now() - 1;
  await expect
    .poll(() => room.deadline === null || room.deadline > Date.now())
    .toBeTruthy();
}
function pageFor(g, id) {
  return g.pages[g.room.players.findIndex((p) => p.id === id)];
}
async function recordAll(g) {
  await Promise.all(
    g.pages.map(async (page) => {
      await page
        .getByRole("button", { name: "Start recording", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Stop recording", exact: true }),
      ).toBeVisible();
      await page.waitForTimeout(650);
      await page
        .getByRole("button", { name: "Stop recording", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Submit this sound", exact: true })
        .click();
    }),
  );
  await expect.poll(() => g.room.phase).toBe("handoff");
  await expire(g.room);
}

test("landing, six persistent themes (Paper by default), mobile layout and keyboard entry", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Make some",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await page.screenshot({
    path: "../../work/landing-desktop.png",
    fullPage: true,
  });
  for (const [key, name] of [
    ["paper", "Paper Playground"],
    ["neon", "Neon Arcade"],
    ["sunset", "Sunset Lounge"],
    ["midnight", "Midnight Studio"],
    ["sky", "Cloud Nine"],
    ["pop", "Bubblegum Pop"],
  ]) {
    await page
      .getByRole("button", { name: "Change theme", exact: true })
      .click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("html")).toHaveAttribute("data-theme", key);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", key);
    await page.screenshot({
      path: `../../work/theme-${key}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "../../work/landing-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  await page.getByLabel("Your nickname").fill("Mobile friend");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Tonight’s game")).toBeVisible();
  await page.screenshot({
    path: "../../work/lobby-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("Classic: four independent browser sessions, real WebRTC with simulated microphones, full match and restart", async ({
  browser,
}) => {
  const g = await group(browser);
  try {
    await g.pages[0].screenshot({
      path: "../../work/lobby-desktop.png",
      fullPage: true,
    });
    await configure(g, "classic");
    let verifiedAudio = false;
    while (g.room.phase !== "results") {
      console.log("classic loop", g.room.round, g.room.phase);
      const performer = pageFor(g, g.room.performerIds[0]);
      await performer.locator(".prompt-choices button").first().click();
      await expect.poll(() => g.room.phase).toBe("prepare");
      await expire(g.room);
      const guesser = pageFor(g, g.room.eligible[0]);
      await expect(guesser.getByLabel("Your private guess")).toBeVisible();
      if (!verifiedAudio) {
        await expect
          .poll(
            async () =>
              guesser.evaluate(async () => {
                const stats = await Promise.all(
                  window.__peers.map((p) => p.getStats()),
                );
                return stats.some((s) =>
                  [...s.values()].some(
                    (v) =>
                      v.type === "inbound-rtp" &&
                      v.kind === "audio" &&
                      v.bytesReceived > 0,
                  ),
                );
              }),
            { timeout: 20000 },
          )
          .toBeTruthy();
        await performer.screenshot({
          path: "../../work/classic-performer.png",
          fullPage: true,
        });
        await guesser.screenshot({
          path: "../../work/classic-guesser.png",
          fullPage: true,
        });
        verifiedAudio = true;
      }
      const answer = g.room.prompt.phrase;
      await Promise.all(
        g.room.eligible.map(async (id) => {
          const page = pageFor(g, id);
          await page.getByLabel("Your private guess").fill(answer);
          await page
            .getByRole("button", { name: "Guess", exact: true })
            .click();
        }),
      );
      await expect.poll(() => g.room.phase).toBe("roundReveal");
      await g.pages[0]
        .getByRole("button", { name: "Next", exact: true })
        .click();
    }
    await expect(
      g.pages[0].getByRole("heading", { name: "A round of applause." }),
    ).toBeVisible();
    await g.pages[0].screenshot({
      path: "../../work/results.png",
      fullPage: true,
    });
    await g.pages[0]
      .getByRole("button", { name: "Play again", exact: true })
      .click();
    await expect(g.pages[0].getByText("Tonight’s game")).toBeVisible();
    expect(g.errors).toEqual([]);
  } finally {
    await g.close();
  }
});
test("Gartic: real MediaRecorder upload, preview, private routing, text/audio alternation and synchronized reveal", async ({
  browser,
}) => {
  const g = await group(browser);
  try {
    await configure(g, "gartic");
    await g.pages[0].screenshot({
      path: "../../work/gartic-record.png",
      fullPage: true,
    });
    for (let r = 0; r < 4; r++) {
      if (r % 2 === 0) await recordAll(g);
      else {
        await Promise.all(
          g.pages.map(async (page, i) => {
            await expect(page.locator("audio")).toBeVisible();
            await page
              .getByLabel("Your interpretation")
              .fill(`A robot with hiccups ${r} ${i}`);
            await page
              .getByRole("button", { name: "Submit", exact: true })
              .click();
          }),
        );
        await expire(g.room);
      }
    }
    await expect.poll(() => g.room.phase).toBe("chainReveal");
    while (g.room.phase === "chainReveal") {
      const first = g.pages[0];
      const entries =
        g.room.chains[g.room.ids[g.room.revealChain]].entries.length;
      if (g.room.revealStep === 2)
        await first.screenshot({
          path: "../../work/gartic-reveal.png",
          fullPage: true,
        });
      if (g.room.revealStep < entries - 1)
        await first
          .getByRole("button", { name: "Reveal next step", exact: true })
          .click();
      else
        await first
          .getByRole("button", {
            name: g.room.revealChain === 3 ? "Finish the show" : "Next chain",
            exact: true,
          })
          .click();
    }
    await expect(
      g.pages[0].getByRole("heading", { name: "You made quite a story." }),
    ).toBeVisible();
    expect(g.room.audio.size).toBe(8);
    expect(g.errors).toEqual([]);
  } finally {
    await g.close();
  }
});
test("Gartic awards: friendly vote after the reveal, self-votes blocked, winners on results", async ({
  browser,
}) => {
  const g = await group(browser);
  try {
    await configure(g, "gartic", async (host) => {
      const box = host.getByLabel("Friendly awards vote after the reveal");
      await box.click();
      await expect(box).toBeChecked();
    });
    await expect.poll(() => g.room.settings.awards).toBe(true);
    for (let r = 0; r < 4; r++) {
      if (r % 2 === 0) await recordAll(g);
      else {
        await Promise.all(
          g.pages.map(async (page, i) => {
            await expect(page.locator("audio")).toBeVisible();
            await page
              .getByLabel("Your interpretation")
              .fill(`Awards guess ${r} ${i}`);
            await page
              .getByRole("button", { name: "Submit", exact: true })
              .click();
          }),
        );
        await expire(g.room);
      }
    }
    await expect.poll(() => g.room.phase).toBe("chainReveal");
    while (g.room.phase === "chainReveal") {
      const entries =
        g.room.chains[g.room.ids[g.room.revealChain]].entries.length;
      if (g.room.revealStep < entries - 1)
        await g.pages[0]
          .getByRole("button", { name: "Reveal next step", exact: true })
          .click();
      else
        await g.pages[0]
          .getByRole("button", {
            name: g.room.revealChain === 3 ? "Finish the show" : "Next chain",
            exact: true,
          })
          .click();
    }
    await expect(
      g.pages[0].getByRole("heading", { name: "Hand out some tiny trophies." }),
    ).toBeVisible();
    // Everyone's own chain is disabled; pick the first enabled chain for "Funniest".
    await Promise.all(
      g.pages.map(async (page) => {
        const group = page.getByRole("group", {
          name: "Funniest transformation",
        });
        await expect(group.locator("button:disabled")).toHaveCount(1);
        await group.locator("button:not(:disabled)").first().click();
        await page.getByRole("button", { name: /Send my picks/ }).click();
      }),
    );
    await expect(
      g.pages[0].getByRole("heading", { name: "You made quite a story." }),
    ).toBeVisible();
    await expect(g.pages[0].getByText("Funniest transformation")).toBeVisible();
    expect(g.errors).toEqual([]);
  } finally {
    await g.close();
  }
});
test("two players can play Gartic Sounds to the end", async ({ browser }) => {
  const g = await group(browser, 2);
  try {
    await expect(g.pages[0].getByText("2–8 players").first()).toBeVisible();
    await configure(g, "gartic");
    await recordAll(g);
    await Promise.all(
      g.pages.map(async (page, i) => {
        await expect(page.locator("audio")).toBeVisible();
        await page
          .getByLabel("Your interpretation")
          .fill(`Two player guess ${i}`);
        await page.getByRole("button", { name: "Submit", exact: true }).click();
      }),
    );
    await expire(g.room);
    await expect.poll(() => g.room.phase).toBe("chainReveal");
    while (g.room.phase === "chainReveal") {
      const entries =
        g.room.chains[g.room.ids[g.room.revealChain]].entries.length;
      if (g.room.revealStep < entries - 1)
        await g.pages[0]
          .getByRole("button", { name: "Reveal next step", exact: true })
          .click();
      else
        await g.pages[0]
          .getByRole("button", {
            name: g.room.revealChain === 1 ? "Finish the show" : "Next chain",
            exact: true,
          })
          .click();
    }
    await expect(
      g.pages[0].getByRole("heading", { name: "You made quite a story." }),
    ).toBeVisible();
    expect(g.errors).toEqual([]);
  } finally {
    await g.close();
  }
});
test("Gartic own-word mode: type one or two words, sentences are refused, shuffle is limited", async ({
  browser,
}) => {
  const g = await group(browser, 2);
  try {
    const [host, guest] = g.pages;
    await host
      .locator(".lobby-mode")
      .filter({ hasText: "Gartic Sounds" })
      .click();
    await host.getByRole("button", { name: "Room settings" }).click();
    await host.getByRole("radio", { name: /We write our own/ }).click();
    await expect.poll(() => g.room.settings.customPrompts).toBe(true);
    await host.keyboard.press("Escape");
    await configure(g, "gartic");
    await expect.poll(() => g.room.phase).toBe("seed");

    const box = host.getByLabel("Your starting word");
    await box.fill("a very loud dog");
    await expect(host.getByText("That’s a sentence")).toBeVisible();
    await expect(
      host.getByRole("button", { name: "Start this chain" }),
    ).toBeDisabled();
    await box.fill("Disco llama");
    await expect(host.getByText("2 / 2 words")).toBeVisible();
    await host.getByRole("button", { name: "Start this chain" }).click();
    await expect(
      host.getByRole("heading", { name: "Beautifully done." }),
    ).toBeVisible();

    await guest.getByRole("button", { name: /Shuffle/ }).click();
    await expect.poll(() => Object.values(g.room.shuffles || {})[0]).toBe(1);
    await guest.getByRole("button", { name: /^Keep/ }).click();
    await expect.poll(() => g.room.phase).toBe("record");
    const hostId = g.room.players[0].id;
    expect(g.room.chains[hostId].entries[0].text).toBe("Disco llama");
    expect(g.errors).toEqual([]);
  } finally {
    await g.close();
  }
});
test("word library browser opens, shows packs with samples, and the host can pick one", async ({
  browser,
}) => {
  const g = await group(browser, 2);
  try {
    const host = g.pages[0];
    await host
      .locator(".lobby-mode")
      .filter({ hasText: "Gartic Sounds" })
      .click();
    await host.getByRole("button", { name: "Room settings" }).click();
    await host.getByRole("button", { name: "Browse the word library" }).click();
    await expect(
      host.getByRole("heading", { name: "Word library" }),
    ).toBeVisible();
    await expect(host.getByText(/words across \d+ packs/)).toBeVisible();
    await expect(host.getByRole("heading", { name: "Animals" })).toBeVisible();
    await expect(
      host.getByRole("list", { name: "Sample words from Animals" }),
    ).toBeVisible();
    await host
      .locator(".lib-card")
      .filter({ hasText: "Famous people" })
      .getByRole("button")
      .click();
    await expect.poll(() => g.room.settings.wordPacks).toEqual(["people"]);
    // a second pack is added to the mix, not swapped in
    await host
      .locator(".lib-card")
      .filter({ hasText: "Animals" })
      .getByRole("button", { name: "Add to the mix" })
      .click();
    await expect
      .poll(() => g.room.settings.wordPacks)
      .toEqual(["people", "animals"]);
    await expect(host.locator(".lib-card.chosen")).toHaveCount(2);
    // tapping a chosen pack removes it again
    await host
      .locator(".lib-card")
      .filter({ hasText: "Famous people" })
      .getByRole("button", { name: /remove/ })
      .click();
    await expect.poll(() => g.room.settings.wordPacks).toEqual(["animals"]);
    await host.keyboard.press("Escape");
    await expect(host.locator(".settings-summary")).toContainText(
      "Animals words",
    );
    expect(g.errors).toEqual([]);
  } finally {
    await g.close();
  }
});
test("mic check lists the available microphones before any test", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ permissions: ["microphone"] });
  const page = await ctx.newPage();
  try {
    await page.goto(base);
    await page
      .getByRole("button", { name: "Create a room", exact: true })
      .click();
    await page.getByLabel("Your nickname").fill("Mic tester");
    await page
      .getByRole("button", { name: "Create room", exact: true })
      .click();
    await page.getByText("Tonight’s game").waitFor();
    await page.getByRole("button", { name: "A quick mic check?" }).click();
    const options = page.locator("dialog[open] select option");
    await expect
      .poll(() => options.count(), { timeout: 15000 })
      .toBeGreaterThan(1);
    await expect(options.first()).toHaveText("System default");
  } finally {
    await ctx.close();
  }
});
test("Classic: the performer picks from 4 or 5 one-or-two-word choices, easiest first", async ({
  browser,
}) => {
  const g = await group(browser, 3);
  try {
    const host = g.pages[0];
    await host.getByRole("button", { name: "Room settings" }).click();
    await host.getByRole("radio", { name: "5 words" }).click();
    await expect.poll(() => g.room.settings.choices).toBe(5);
    await host.keyboard.press("Escape");
    await configure(g, "classic");
    await expect.poll(() => g.room.phase).toBe("choose");
    const performer = pageFor(g, g.room.performerIds[0]);
    const cards = performer.locator(".prompt-choices button");
    await expect(cards).toHaveCount(5);
    const phrases = await cards.locator("strong").allTextContents();
    for (const phrase of phrases)
      expect(phrase.trim().split(/\s+/).length).toBeLessThanOrEqual(2);
    await expect(cards.first().locator(".diff b")).toBeVisible();
    await cards.nth(2).click();
    await expect.poll(() => g.room.phase).toBe("prepare");
    expect(g.errors).toEqual([]);
  } finally {
    await g.close();
  }
});
test("room settings drawer: timing, shuffles and helpers are tunable and the lobby summary follows", async ({
  browser,
}) => {
  const g = await group(browser, 3);
  try {
    const [host, guest] = g.pages;
    await host.getByRole("button", { name: "Room settings" }).click();
    await host
      .getByRole("radiogroup", { name: "Performance time" })
      .getByRole("radio", { name: "60s" })
      .click();
    await host.getByRole("radio", { name: "3 shuffles" }).click();
    await host.getByRole("radio", { name: "30s" }).last().click();
    await host.getByLabel("Show guessers a small hint").uncheck();
    await host.getByLabel("Faster guesses earn more points").uncheck();
    await expect.poll(() => g.room.settings.performanceSeconds).toBe(60);
    await expect.poll(() => g.room.settings.shuffles).toBe(3);
    await expect.poll(() => g.room.settings.chooseSeconds).toBe(30);
    await expect.poll(() => g.room.settings.hints).toBe(false);
    await expect.poll(() => g.room.settings.speedBonus).toBe(false);
    await host.keyboard.press("Escape");
    await expect(host.locator(".settings-summary")).toContainText("60s turns");
    await expect(guest.locator(".settings-summary")).toContainText("60s turns");
    await configure(g, "classic");
    await expect.poll(() => g.room.phase).toBe("choose");
    const performer = pageFor(g, g.room.performerIds[0]);
    await expect(
      performer.getByRole("button", { name: /Shuffle words \(3 left\)/ }),
    ).toBeVisible();
    expect(g.errors).toEqual([]);
  } finally {
    await g.close();
  }
});
test("Classic: every player gets turns, even one who never did a mic check", async ({
  browser,
}) => {
  const g = await group(browser, 2);
  try {
    // pretend nobody did the mic check; turns must still alternate between both players
    g.room.players.forEach((p) => (p.mic = false));
    await configure(g, "classic");
    const performers = [];
    for (let turn = 0; turn < 4; turn++) {
      await expect.poll(() => g.room.phase).toBe("choose");
      const id = g.room.performerIds[0];
      performers.push(id);
      const page = pageFor(g, id);
      await expect(
        page.getByRole("heading", { name: "What’s your noise?" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Pass this turn" }).click();
      await expect.poll(() => g.room.phase).toBe("roundReveal");
      await g.pages[0].getByRole("button", { name: "Next" }).click();
    }
    await expect.poll(() => g.room.phase).toBe("results");
    expect(new Set(performers).size).toBe(2);
    expect(performers[0]).not.toBe(performers[1]);
    expect(g.errors).toEqual([]);
  } finally {
    await g.close();
  }
});
test("face editor: build a look, it reaches the room, and a copycat gets a different face", async ({
  browser,
}) => {
  const contexts = [];
  try {
    const join = async (create, code) => {
      const context = await browser.newContext();
      contexts.push(context);
      await context.addInitScript(() =>
        localStorage.setItem("sd-avatar", "cat.3.2.4.5.1"),
      );
      const page = await context.newPage();
      await page.goto(base);
      await page
        .getByRole("button", {
          name: create ? "Create a room" : "Join a room",
          exact: true,
        })
        .click();
      return page;
    };
    const host = await join(true);
    await expect(
      host.getByRole("img", { name: "Cat avatar" }).first(),
    ).toBeVisible();
    await expect(host.getByLabel("Hat", { exact: true })).toHaveText(
      "Cowboy hat",
    );
    await host.getByRole("button", { name: "Next hat" }).click();
    await expect(host.getByLabel("Hat", { exact: true })).toHaveText(
      "Chef hat",
    );
    await host.getByRole("button", { name: "Previous eyes" }).click();
    await expect(host.getByLabel("Eyes", { exact: true })).toHaveText("Googly");
    await host.getByRole("radio", { name: "Mint" }).click();
    await host.getByLabel("Your nickname").fill("Face host");
    await host
      .getByRole("button", { name: "Create room", exact: true })
      .click();
    await host.getByText("Tonight’s game").waitFor();
    await expect
      .poll(() => new URL(host.url()).searchParams.get("room"))
      .toBeTruthy();
    const code = new URL(host.url()).searchParams.get("room");
    const room = app.rooms.get(code);
    expect(room.players[0].avatar).toBe("cat.2.1.4.6.1");

    // a second player who saved the very same face as the host
    const guest = await join(false);
    await guest.getByLabel("Your nickname").fill("Copycat");
    await guest.getByLabel("Room code").fill(code);
    await guest.getByRole("button", { name: "Join room", exact: true }).click();
    await guest.getByText("Tonight’s game").waitFor();
    const faces = room.players.map((p) => p.avatar);
    expect(faces).toHaveLength(2);
    expect(new Set(faces).size).toBe(2);
    expect(faces[1].startsWith("cat.")).toBe(true);
    await expect(guest.locator(".player-card")).toHaveCount(2);
  } finally {
    for (const c of contexts) await c.close();
  }
});
test("spicy pack needs the 18+ confirmation and shows a banner to everyone", async ({
  browser,
}) => {
  const g = await group(browser, 2);
  try {
    const [host, guest] = g.pages;
    await host.getByRole("button", { name: "Room settings" }).click();
    await host.getByRole("button", { name: "Browse the word library" }).click();
    await expect(
      host.getByRole("heading", { name: "Word library" }),
    ).toBeVisible();
    const card = host.locator(".lib-card").filter({ hasText: "Spicy" });
    await expect(card.getByText("18+").first()).toBeVisible();
    await expect(card.locator(".lib-samples")).toHaveCount(0);
    await card.getByRole("button", { name: "Add to the mix" }).click();
    await expect(host.getByText("Is everyone here 18 or older?")).toBeVisible();
    expect(g.room.settings.wordPacks).not.toContain("spicy");
    await host.getByRole("button", { name: "We’re all adults" }).click();
    // Spicy stacks on top of Everything; it does not replace it
    await expect
      .poll(() => g.room.settings.wordPacks)
      .toEqual(["mixed", "spicy"]);
    await expect(
      host.locator(".lib-card.chosen").filter({ hasText: "Everything" }),
    ).toHaveCount(1);
    await expect(host.locator(".lib-card.chosen")).toHaveCount(2);
    expect(g.room.settings.adultsOnly).toBe(true);
    await host.keyboard.press("Escape");
    await expect(guest.getByText("Spicy words are on.")).toBeVisible();
    expect(g.errors).toEqual([]);
  } finally {
    await g.close();
  }
});
test("every game mode on the landing page is clickable and starts a room in that mode", async ({
  browser,
}) => {
  const names = {
    classic: "Classic",
    gartic: "Gartic Sounds",
    duo: "Duo Orchestra",
    detective: "Sound Detective",
    foley: "Five-Second Foley",
    ranking: "Blind Ranking",
  };
  for (const [key, name] of Object.entries(names)) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(base);
      const trigger = page
        .locator(".posters .poster")
        .filter({ hasText: name });
      await expect(trigger).toBeVisible();
      await expect(trigger).toBeEnabled();
      await trigger.click();
      await expect(page.getByText(`Starting with ${name}`)).toBeVisible();
      await page.getByLabel("Your nickname").fill("Mode tester");
      await page
        .getByRole("button", { name: "Create room", exact: true })
        .click();
      await page.getByText("Tonight’s game").waitFor();
      await expect(
        page.locator(".poster[aria-pressed='true']").filter({ hasText: name }),
      ).toBeVisible();
    } finally {
      await ctx.close();
    }
  }
});
for (const mode of ["duo", "detective", "foley", "ranking"])
  test(`${mode}: complete browser match to results`, async ({ browser }) => {
    const g = await group(browser);
    try {
      await configure(g, mode);
      if (mode === "duo") {
        await expire(g.room);
        const audience = pageFor(g, g.room.eligible[0]);
        await expect(audience.getByLabel("Your private guess")).toBeVisible();
        await expect
          .poll(
            async () =>
              audience.evaluate(async () => {
                const stats = await Promise.all(
                  window.__peers.map((p) => p.getStats()),
                );
                return stats.filter((s) =>
                  [...s.values()].some(
                    (v) =>
                      v.type === "inbound-rtp" &&
                      v.kind === "audio" &&
                      v.bytesReceived > 0,
                  ),
                ).length;
              }),
            { timeout: 20000 },
          )
          .toBe(2);
        await Promise.all(
          g.room.eligible.map(async (id) => {
            const p = pageFor(g, id);
            await p.getByLabel("Your private guess").fill(g.room.prompt.phrase);
            await p.getByRole("button", { name: "Guess", exact: true }).click();
          }),
        );
      } else if (mode === "detective") {
        await expire(g.room);
        for (let i = 0; i < 4; i++) {
          await expect.poll(() => g.room.phase).toBe("perform");
          await expire(g.room);
        }
        await expect.poll(() => g.room.phase).toBe("vote");
        await Promise.all(
          g.pages.map((p) =>
            p.getByRole("button", { name: "Abstain", exact: true }).click(),
          ),
        );
        const outsider = pageFor(g, g.room.outsider);
        await outsider
          .getByLabel("Your final guess")
          .fill(g.room.prompt.phrase);
        await outsider
          .getByRole("button", { name: "Reveal the truth" })
          .click();
      } else {
        await recordAll(g);
        while (g.room.phase === "listening") {
          await g.pages[0]
            .getByRole("button", { name: "Next", exact: true })
            .click();
          await g.pages[0].waitForTimeout(150);
        }
        await expect.poll(() => g.room.phase).toBe("vote");
        await g.pages[0].screenshot({
          path: `../../work/${mode}-vote.png`,
          fullPage: true,
        });
        await Promise.all(
          g.pages.map(async (p) => {
            if (mode === "foley") {
              await p.locator("input[type=radio]").first().check();
              await p.getByRole("button", { name: "Lock my vote" }).click();
            } else
              await p
                .getByRole("button", { name: "Lock this ranking" })
                .click();
          }),
        );
      }
      await expect.poll(() => g.room.phase).toBe("roundReveal");
      await g.pages[0]
        .getByRole("button", { name: "Next", exact: true })
        .click();
      await expect(
        g.pages[0].getByRole("heading", { name: "A round of applause." }),
      ).toBeVisible();
      expect(g.errors).toEqual([]);
    } finally {
      await g.close();
    }
  });
