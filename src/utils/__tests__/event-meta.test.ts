import assert from "node:assert/strict";
import { playsFortyK, hasStarted, mayHaveArmyMeta } from "../event-meta";

{
  // The client's own condition, and the spellings members actually type.
  assert.equal(playsFortyK(["Warhammer 40,000"]), true);
  assert.equal(playsFortyK(["warhammer 40k"]), true);
  assert.equal(playsFortyK(["Kill Team", "Warhammer 40k"]), true);

  assert.equal(playsFortyK(["Age of Sigmar"]), false);
  assert.equal(playsFortyK(["Kill Team"]), false);
  assert.equal(playsFortyK([]), false);
  assert.equal(playsFortyK(null), false);
}

{
  // Today counts: an event running now is one people are at.
  assert.equal(hasStarted("2026-09-27", "2026-09-27"), true);
  assert.equal(hasStarted("2026-09-26", "2026-09-27"), true);
  assert.equal(hasStarted("2026-09-28", "2026-09-27"), false);

  // A timestamp is fine, and nonsense is not a start.
  assert.equal(hasStarted("2026-09-26T19:00:00Z", "2026-09-27"), true);
  assert.equal(hasStarted("", "2026-09-27"), false);
  assert.equal(hasStarted(null, "2026-09-27"), false);
  assert.equal(hasStarted("soon", "2026-09-27"), false);
}

{
  const today = "2026-09-27";
  assert.equal(mayHaveArmyMeta({
    startDate: "2026-04-04", games: ["Warhammer 40,000"], today }), true);

  // An event that names its games and leaves 40k out is not a 40k event, and
  // one that has not started is nobody's business yet. Both closed.
  assert.equal(mayHaveArmyMeta({
    startDate: "2026-04-04", games: ["Age of Sigmar"], today }), false);
  assert.equal(mayHaveArmyMeta({
    startDate: "2026-11-14", games: ["Warhammer 40,000"], today }), false);

  // Every imported event: no games named at all. Open, and the armies
  // recorded against it decide. This is the case that was shipping closed.
  assert.equal(mayHaveArmyMeta({ startDate: "2026-04-04", games: [], today }), true);
  assert.equal(mayHaveArmyMeta({ startDate: "2026-04-04", games: null, today }), true);
  assert.equal(mayHaveArmyMeta({ startDate: "2026-11-14", games: [], today }), false);
}

console.log("event-meta: all pass");
