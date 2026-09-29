import assert from "node:assert/strict";
import { usageFor, durationLabel } from "../ai-usage";
import { aiBlockedReason, FEATURE_META } from "../ai-access";
import { coverageFor } from "../scouting-coverage";
import { stalenessFor } from "../season-staleness";

const NOW = new Date("2026-09-30T12:00:00.000Z");
const ago = (hours: number) =>
  new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();

// ------------------------------------------------------- the rolling window
{
  const fresh = usageFor({ at: [], limit: 5, noun: "coaching runs", now: NOW });
  assert.equal(fresh.used, 0);
  assert.equal(fresh.remaining, 5);
  assert.equal(fresh.limited, false);
  assert.equal(fresh.message, "5 daily coaching runs left.");
}
{
  // A run 25 hours old has fallen out of the window. This is the whole point
  // of it being rolling: a calendar day would still be counting it at 00:30.
  const out = usageFor({ at: [ago(25), ago(2)], limit: 5, noun: "coaching runs", now: NOW });
  assert.equal(out.used, 1);
  assert.equal(out.remaining, 4);
}
{
  // At the limit, the next run returns 24 hours after the OLDEST run still
  // inside the window, not at midnight and not 24 hours from now.
  const out = usageFor({
    at: [ago(20), ago(10), ago(1)], limit: 3, noun: "coaching runs", now: NOW });
  assert.equal(out.limited, true);
  assert.equal(out.remaining, 0);
  assert.equal(out.nextAvailableAt, new Date(NOW.getTime() + 4 * 3600_000).toISOString());
  assert.equal(out.message,
    "You’ve reached the coaching runs limit for now. Try again in 4 hours.");
}
{
  // One returns at a time. With four in the window and a limit of three, it
  // is the third-newest that has to expire, not the oldest of the four.
  const out = usageFor({
    at: [ago(23), ago(20), ago(10), ago(1)], limit: 3, noun: "coaching runs", now: NOW });
  assert.equal(out.used, 4);
  assert.equal(out.nextAvailableAt, new Date(NOW.getTime() + 4 * 3600_000).toISOString());
}
{
  // Legacy treats 0 as unlimited rather than as "none".
  const out = usageFor({ at: [ago(1), ago(2)], limit: 0, noun: "season plans", now: NOW });
  assert.equal(out.remaining, null);
  assert.equal(out.limited, false);
  assert.equal(out.message, "Unlimited daily season plans available.");
}
{
  // Rubbish in the list is ignored rather than counted or thrown on.
  const out = usageFor({ at: ["", "not a date", ago(1)], limit: 5,
    noun: "coaching runs", now: NOW });
  assert.equal(out.used, 1);
}

// ------------------------------------------------------------ the wording
{
  assert.equal(durationLabel(0), "under a minute");
  assert.equal(durationLabel(59), "under a minute");
  assert.equal(durationLabel(60), "1 minute");
  assert.equal(durationLabel(61), "2 minutes");     // ceil, never rounds down
  assert.equal(durationLabel(3600), "1 hour");
  assert.equal(durationLabel(3660), "1 hour 1 minute");
  assert.equal(durationLabel(7380), "2 hours 3 minutes");
}

// -------------------------------------------------------------- the gate
{
  const open = {
    feature: "coach" as const, enabled: true, signedIn: true,
    canManageClub: false, isApprovedMember: true,
    builderTierAllows: true, featureTierAllows: true,
  };
  assert.equal(aiBlockedReason(open), null);

  // The builder's own rungs come first and in their own order.
  assert.equal(aiBlockedReason({ ...open, enabled: false }),
    "Army builder is not enabled for this club.");
  assert.equal(aiBlockedReason({ ...open, signedIn: false }),
    "Sign in to access the army builder.");
  assert.equal(aiBlockedReason({ ...open, isApprovedMember: false }),
    "Only approved club members can use the army builder.");
  assert.equal(aiBlockedReason({ ...open, builderTierAllows: false }),
    "Your current membership tier does not include army builder access.");

  // Then the feature's own, naming the feature rather than the family.
  assert.equal(aiBlockedReason({ ...open, featureTierAllows: false }),
    "Your current membership tier does not include list coaching.");
  assert.equal(aiBlockedReason({ ...open, feature: "matchup", featureTierAllows: false }),
    "Your current membership tier does not include match-up analysis.");
  assert.equal(aiBlockedReason({ ...open, feature: "scouting", featureTierAllows: false }),
    "Your current membership tier does not include opponent scouting.");
  assert.equal(aiBlockedReason({ ...open, feature: "season", featureTierAllows: false }),
    "Your current membership tier does not include season coach.");

  // A manager skips both tier rungs but not the club's own switch.
  assert.equal(aiBlockedReason({ ...open, canManageClub: true,
    builderTierAllows: false, featureTierAllows: false, isApprovedMember: false }), null);
  assert.equal(aiBlockedReason({ ...open, canManageClub: true, enabled: false }),
    "Army builder is not enabled for this club.");

  // Four keys, four features, no duplicates.
  const keys = Object.values(FEATURE_META).map((one) => one.benefit);
  assert.equal(new Set(keys).size, 4);
}

// --------------------------------------------------------- the coverage
{
  assert.equal(coverageFor({ games: 0, withArmies: 0, opponentName: "Joe" }).thin, true);
  assert.equal(coverageFor({ games: 1, withArmies: 1, opponentName: "Joe" }).label, "One game");
  // Games with no army recorded is its own kind of thin, and says which half.
  const blind = coverageFor({ games: 6, withArmies: 0, opponentName: "Joe" });
  assert.equal(blind.thin, true);
  assert.ok(blind.detail.includes("guesswork"));
  assert.equal(coverageFor({ games: 6, withArmies: 4, opponentName: "Joe" }).thin, false);
  // It never claims more armies than games.
  assert.ok(coverageFor({ games: 2, withArmies: 9, opponentName: "Joe" })
    .detail.includes("2 of which"));
}

// -------------------------------------------------------- the staleness
{
  const base = { writtenAt: "2026-09-29T12:00:00.000Z", matchesAtWrite: 4, now: NOW };
  assert.equal(stalenessFor({ ...base, matchesNow: 4 }).stale, false);
  assert.equal(stalenessFor({ ...base, matchesNow: 7 }).stale, true);
  assert.equal(stalenessFor({ ...base, matchesNow: 6 }).stale, false);

  const old = stalenessFor({ ...base, writtenAt: "2026-09-01T12:00:00.000Z", matchesNow: 4 });
  assert.equal(old.stale, true);
  assert.equal(old.daysSince, 29);

  // The list moving beats both clocks, and is named first because it is what
  // somebody would act on.
  const moved = stalenessFor({ ...base, matchesNow: 99,
    signatureAtWrite: "aaa", signatureNow: "bbb" });
  assert.equal(moved.reason, "The list has changed since this plan was written.");
}

console.log("ai-usage: all pass");
