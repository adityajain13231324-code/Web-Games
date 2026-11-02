# Test report

| Check                                                                                                                                                                                  | Type                                 | Result                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------- |
| 50 unit and socket tests (including Gartic awards) (routing, scoring, matching, rate limits, host migration, late join, timeouts)                                                      | Automated                            | Pass                               |
| 18 browser tests (including the awards flow and the room settings drawer): four independent Chrome sessions per mode (Classic with real WebRTC, then Duo, Detective, Foley, Ranking, Gartic), full match to results | Automated, **simulated microphones** | Pass                               |
| Theme and layout screenshots at 1280 and 390 px (`scripts/shots.mjs`)                                                                                                                  | Visual, manual review                | Reviewed                           |
| Real microphones on real phones, across different networks                                                                                                                             | Manual                               | **Not done**                       |
| Human listening check of the sound effects and the reveal show                                                                                                                         | Manual                               | **Not done**                       |
| TURN relay behavior on restrictive networks                                                                                                                                            | Manual                               | **Not done** (no relay configured) |

Not yet verified by a human: the three generated announcer lines and the synthesized music need a listening check.
