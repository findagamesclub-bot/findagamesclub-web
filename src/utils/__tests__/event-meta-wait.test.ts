import assert from "node:assert/strict";
import { armyMetaWait } from "../event-meta";

// Rows win over every other reason: there is nothing to explain.
assert.equal(armyMetaWait({ games: ["Blood Bowl"], rows: 3 }), null);

// A named game list without 40k is the client's own rule: a Blood Bowl
// weekend never gets analytics, and the sentence has to say so rather than
// leaving the club waiting for something that will not come.
const notFortyK = armyMetaWait({ games: ["Blood Bowl"], rows: 0 });
assert.ok(notFortyK && /Warhammer 40,000/.test(notFortyK), notFortyK ?? "null");

// Named nothing is unknown rather than "not 40k", so it falls through to
// "nothing recorded". Every imported event is in that state.
const unknown = armyMetaWait({ games: [], rows: 0 });
assert.ok(unknown && /names a faction/.test(unknown), unknown ?? "null");

// The date no longer comes into it. An event months away that already has
// armies against it shows them, and one that does not says what is missing
// rather than telling the club to wait for a start date. That gate is what
// the client reported twice: placings typed in, panel empty, no reason given.
assert.equal(armyMetaWait({ games: ["Warhammer 40,000"], rows: 2 }), null);
const future = armyMetaWait({ games: ["Warhammer 40,000"], rows: 0 });
assert.ok(future && /names a faction/.test(future), future ?? "null");
assert.ok(future && !/started/.test(future), "no date excuse is left");

console.log("event-meta-wait: all pass");
