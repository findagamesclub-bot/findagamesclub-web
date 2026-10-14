import assert from "node:assert/strict";
import { armyMetaWait } from "../event-meta";

const TODAY = "2026-10-13";

// Rows win over every other reason: there is nothing to explain.
assert.equal(armyMetaWait({ startDate: "2026-01-01", games: ["Blood Bowl"],
                            today: TODAY, rows: 3 }), null);

// A named game list without 40k is the client's own rule, and it is checked
// BEFORE the date: a Blood Bowl weekend never gets analytics, so telling its
// club to wait for the start date would be a promise that never lands.
const notFortyK = armyMetaWait({ startDate: "2026-12-01", games: ["Blood Bowl"],
                                 today: TODAY, rows: 0 });
assert.ok(notFortyK && /Warhammer 40,000/.test(notFortyK), notFortyK ?? "null");

// Named nothing is unknown rather than "not 40k", so it falls through to the
// date. Every imported event is in that state.
const notStarted = armyMetaWait({ startDate: "2026-12-01", games: [],
                                  today: TODAY, rows: 0 });
assert.ok(notStarted && /once the event has started/.test(notStarted),
          notStarted ?? "null");

// Today counts as started, which is what `hasStarted` says and what somebody
// standing in the hall expects.
const running = armyMetaWait({ startDate: TODAY, games: ["Warhammer 40k"],
                               today: TODAY, rows: 0 });
assert.ok(running && /Nothing to count yet/.test(running), running ?? "null");

// Past, 40k, no rows: the armies were never typed in. This is the one the
// client actually hit, and the sentence has to name what makes a row count.
const empty = armyMetaWait({ startDate: "2026-04-04", games: ["Warhammer 40,000"],
                             today: TODAY, rows: 0 });
assert.ok(empty && /names a faction/.test(empty), empty ?? "null");

console.log("event-meta-wait: all pass");
