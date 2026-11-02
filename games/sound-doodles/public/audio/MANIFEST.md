# Audio asset manifest

| File        | Used for                         | Bytes  |
| ----------- | -------------------------------- | ------ |
| confirm.mp3 | button confirmation, ready state | 7,880  |
| submit.mp3  | submission confirmation          | 7,880  |
| start.mp3   | round start                      | 9,134  |
| warning.mp3 | time running out                 | 9,134  |
| correct.mp3 | correct guess                    | 12,896 |
| results.mp3 | final results sting              | 12,896 |
| prepare.mp3 | preparation cue                  | 14,777 |
| reveal.mp3  | reveal transition                | 14,777 |

**Provenance:** these eight files were produced during the first build (outside this session). Their generation tool and settings were not
recorded, so they are **not confirmed to be ElevenLabs output**. Treat licensing as unverified until they are regenerated or replaced with
files whose source is recorded here. Player performances are never AI-generated.

## Announcer lines

Generated 2026-11-02 with the official ElevenLabs text-to-speech API (`scripts/generate-announcer.mjs`), model `eleven_multilingual_v2`,
stock premade voice "Roger - Laid-Back, Casual, Resonant". No player voice was cloned. Played only when the Announcer slider is above zero,
and never during a performance, recording or replay.

| File                       | Line                        | Bytes  |
| -------------------------- | --------------------------- | ------ |
| announce/your-turn.mp3     | "Your turn."                | 15,089 |
| announce/time-to-guess.mp3 | "Time to guess."            | 17,597 |
| announce/lets-hear.mp3     | "Let's hear what happened." | 21,776 |

Status: generated and format-checked. **Not yet listened to by a human**; trim or normalize them if they sound off. Licensing follows the
ElevenLabs terms of the account that generated them.

## Music

Background music is synthesized in the browser by `src/ambience.js` (original chord loop, no external assets or licenses).
