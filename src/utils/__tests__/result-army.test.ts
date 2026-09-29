import assert from "node:assert/strict";
import {
  totalVp, readScore, scoreProblem, isEmptyArmy, armyLabel, armyFromRow,
  isTurnOrder, isBattleRole, EMPTY_ARMY, PRIMARY_MAX, SECONDARY_MAX,
} from "../result-army";
import { readArmies } from "../result-form";
import {
  factionsIn, findFaction, detachmentsFor, dispositionsFor, unitsFor,
  isOfferable, pointsOptionsIn, type Catalogue,
} from "../army-catalogue";

// ------------------------------------------------------------- the total
{
  // Legacy's rule: primary + secondary + 10 when painted (club_store.py:6437).
  assert.equal(totalVp({ primaryScore: 45, secondaryScore: 30, painted: true }), 85);
  assert.equal(totalVp({ primaryScore: 45, secondaryScore: 30, painted: false }), 75);
  // The most anybody can score.
  assert.equal(totalVp({ primaryScore: 50, secondaryScore: 40, painted: true }), 100);
  assert.equal(totalVp({ primaryScore: 0, secondaryScore: 0, painted: false }), 0);
}
{
  // One score alone leaves it blank rather than reading as a result.
  assert.equal(totalVp({ primaryScore: 45, secondaryScore: null, painted: true }), null);
  assert.equal(totalVp({ primaryScore: null, secondaryScore: 30, painted: false }), null);
  assert.equal(totalVp({ primaryScore: null, secondaryScore: null, painted: true }), null);
}

// -------------------------------------------------------- reading a box
{
  assert.equal(readScore("45", PRIMARY_MAX), 45);
  assert.equal(readScore(" 45 ", PRIMARY_MAX), 45);
  assert.equal(readScore("0", PRIMARY_MAX), 0);
  // An empty box is nothing, never nought. `Number("")` being 0 is how a
  // listing price shipped as free in stage 5.
  assert.equal(readScore("", PRIMARY_MAX), null);
  assert.equal(readScore("   ", PRIMARY_MAX), null);
  assert.equal(readScore("abc", PRIMARY_MAX), null);
  assert.equal(readScore("4.5", PRIMARY_MAX), null);
  assert.equal(readScore("-5", PRIMARY_MAX), null);
  // Over the cap is not a score.
  assert.equal(readScore("51", PRIMARY_MAX), null);
  assert.equal(readScore("41", SECONDARY_MAX), null);
  assert.equal(readScore("40", SECONDARY_MAX), 40);
}

// ------------------------------------------------------- saying what is wrong
{
  assert.equal(scoreProblem("", PRIMARY_MAX, "Primary score"), "");
  assert.equal(scoreProblem("45", PRIMARY_MAX, "Primary score"), "");
  assert.equal(scoreProblem("51", PRIMARY_MAX, "Primary score"),
    "Primary score cannot be more than 50.");
  assert.equal(scoreProblem("41", SECONDARY_MAX, "Secondary score"),
    "Secondary score cannot be more than 40.");
  assert.equal(scoreProblem("x", PRIMARY_MAX, "Primary score"),
    "Primary score has to be a whole number.");
}

// ------------------------------------------------------------- closed sets
{
  assert.equal(isTurnOrder("first"), true);
  assert.equal(isTurnOrder("second"), true);
  assert.equal(isTurnOrder("third"), false);
  assert.equal(isTurnOrder(""), false);
  assert.equal(isBattleRole("attacker"), true);
  assert.equal(isBattleRole("defender"), true);
  assert.equal(isBattleRole("umpire"), false);
}

// -------------------------------------------------------------- empty
{
  assert.equal(isEmptyArmy(EMPTY_ARMY), true);
  assert.equal(isEmptyArmy({ ...EMPTY_ARMY, factionId: "adepta-sororitas" }), false);
  assert.equal(isEmptyArmy({ ...EMPTY_ARMY, primaryScore: 0 }), false);
  assert.equal(isEmptyArmy({ ...EMPTY_ARMY, mvpUnits: ["Castigator"] }), false);
  // Painted alone is not a result. Nobody plays a game to tick a box.
  assert.equal(isEmptyArmy({ ...EMPTY_ARMY, painted: true }), true);
}

// --------------------------------------------------------------- the label
{
  assert.equal(armyLabel({ factionLabel: "Adepta Sororitas", detachment: "Hallowed Martyrs" }),
    "Adepta Sororitas · Hallowed Martyrs");
  assert.equal(armyLabel({ factionLabel: "Adepta Sororitas" }), "Adepta Sororitas");
  assert.equal(armyLabel({ detachment: "Hallowed Martyrs" }), "Hallowed Martyrs");
  assert.equal(armyLabel({}), "");
}

// ------------------------------------------------------------- the catalogue
const catalogue: Catalogue = {
  editionId: "warhammer-40k-11th",
  catalogueVersion: "11th-test-2026-07-27",
  systems: [{
    id: "warhammer-40k",
    label: "Warhammer 40,000",
    pointsOptions: ["1000", "1500", "2000", "3000"],
    factions: [
      {
        id: "adepta-sororitas",
        label: "Adepta Sororitas",
        detachmentOptions: [
          { id: "hallowed-martyrs", label: "Hallowed Martyrs",
            dispositions: ["Priority Assets"] },
          { id: "army-of-faith", label: "Army of Faith",
            dispositions: ["Take and Hold"] },
        ],
        units: [{ name: "Castigator", points: "165" }],
      },
      { id: "necrons", label: "Necrons", detachmentOptions: [], units: [] },
    ],
  }],
};

{
  assert.equal(factionsIn(catalogue).length, 2);
  assert.equal(factionsIn(null).length, 0);
  assert.deepEqual(pointsOptionsIn(catalogue), [1000, 1500, 2000, 3000]);
  assert.deepEqual(pointsOptionsIn(null), []);
}
{
  assert.equal(findFaction(catalogue, "adepta-sororitas")?.label, "Adepta Sororitas");
  // Case and spacing do not decide a match.
  assert.equal(findFaction(catalogue, " Adepta-Sororitas ")?.id, "adepta-sororitas");
  assert.equal(findFaction(catalogue, "space-marines"), null);
  assert.equal(findFaction(catalogue, ""), null);
}
{
  assert.equal(detachmentsFor(catalogue, "adepta-sororitas").length, 2);
  assert.equal(detachmentsFor(catalogue, "necrons").length, 0);
  assert.equal(detachmentsFor(catalogue, "space-marines").length, 0);
}
{
  // The rule the whole design turns on: a disposition belongs to a detachment.
  assert.deepEqual(dispositionsFor(catalogue, "adepta-sororitas", "Hallowed Martyrs"),
    ["Priority Assets"]);
  assert.deepEqual(dispositionsFor(catalogue, "adepta-sororitas", "Army of Faith"),
    ["Take and Hold"]);
  // By id as well as by label, because a result stores one and a picker the other.
  assert.deepEqual(dispositionsFor(catalogue, "adepta-sororitas", "hallowed-martyrs"),
    ["Priority Assets"]);
  assert.deepEqual(dispositionsFor(catalogue, "adepta-sororitas", ""), []);
}
{
  const units = unitsFor(catalogue, "adepta-sororitas");
  assert.equal(units.length, 1);
  // Points are strings in the file and integers here, once.
  assert.equal(units[0]!.basePoints, 165);
  assert.equal(unitsFor(catalogue, "necrons").length, 0);
}

// ------------------------------------------- a faction by name or by id
{
  // A league table has held a typed faction name since 0024, and a picker
  // holds the id. `resolve_result_army` matches both ways, so this has to.
  assert.equal(findFaction(catalogue, "Adepta Sororitas")?.id, "adepta-sororitas");
  assert.equal(findFaction(catalogue, "adepta sororitas")?.id, "adepta-sororitas");
  assert.equal(findFaction(catalogue, "adepta-sororitas")?.id, "adepta-sororitas");
  assert.equal(findFaction(catalogue, "Sisters of Battle"), null);

  // Which means a detachment list can be drawn for a row typed as a name.
  assert.equal(detachmentsFor(catalogue, "Adepta Sororitas").length,
               detachmentsFor(catalogue, "adepta-sororitas").length);
}

// --------------------------------------------------- what may be offered
{
  const yes = (f: string, d: string, p: string) =>
    isOfferable(catalogue, { factionId: f, detachment: d, disposition: p });

  assert.equal(yes("adepta-sororitas", "Hallowed Martyrs", "Priority Assets"), true);
  // Every field optional: nothing said is always offerable.
  assert.equal(yes("", "", ""), true);
  assert.equal(yes("adepta-sororitas", "", ""), true);
  assert.equal(yes("adepta-sororitas", "Hallowed Martyrs", ""), true);

  assert.equal(yes("space-marines", "", ""), false);
  assert.equal(yes("adepta-sororitas", "Not A Detachment", ""), false);
  // The one that matters: right faction, right detachment, a disposition that
  // belongs to the other one.
  assert.equal(yes("adepta-sororitas", "Hallowed Martyrs", "Take and Hold"), false);
}

// ------------------------------------------------- a row read back in
{
  // A saved result reopens with what was recorded. Starting from EMPTY_ARMY
  // instead would delete the row on the next save, because an empty army is
  // what `put_result_army` removes.
  const army = armyFromRow({
    faction_id: "adepta-sororitas", faction_label: "Adepta Sororitas",
    detachment: "Hallowed Martyrs", disposition: "Priority Assets",
    mvp_units: ["Castigator"], underwhelming_units: null,
    primary_score: 45, secondary_score: 30, painted: true,
    first_turn: "first", battle_role: "attacker",
  });
  assert.equal(army.factionLabel, "Adepta Sororitas");
  assert.deepEqual(army.mvpUnits, ["Castigator"]);
  assert.deepEqual(army.underwhelmingUnits, []);
  assert.equal(totalVp(army), 85);

  // Nothing at all is the empty army, not a crash.
  assert.deepEqual(armyFromRow(null), EMPTY_ARMY);
  assert.deepEqual(armyFromRow(undefined), EMPTY_ARMY);
  assert.equal(isEmptyArmy(armyFromRow({})), true);

  // A closed set that has drifted reads as nothing said rather than as a value
  // the database will refuse.
  const odd = armyFromRow({ first_turn: "third", battle_role: "spectator" });
  assert.equal(odd.firstTurn, "");
  assert.equal(odd.battleRole, "");
}

// ------------------------------------------------ what the form posted
{
  const both = readArmies(JSON.stringify({ one: { factionId: "a" }, two: {} }));
  assert.equal(both?.one?.factionId, "a");

  // Undefined, not an empty object. The two mean different things to
  // `record_booking_result`: absent leaves an army alone, present with nothing
  // in it deletes it.
  assert.equal(readArmies(undefined), undefined);
  assert.equal(readArmies(""), undefined);
  assert.equal(readArmies("   "), undefined);
  assert.equal(readArmies("not json"), undefined);
  assert.equal(readArmies("[1,2]"), undefined);
  assert.equal(readArmies("null"), undefined);
  assert.equal(readArmies(42), undefined);
}

console.log("result-army: all pass");
