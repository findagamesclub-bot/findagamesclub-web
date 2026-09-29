import assert from "node:assert/strict";
import { factionLabel, splitArmyText, matchFaction } from "../faction-aliases";

const factions = [
  { id: "adepta-sororitas", label: "Adepta Sororitas" },
  { id: "tau-empire", label: "T'au Empire" },
  { id: "adeptus-custodes", label: "Adeptus Custodes" },
  { id: "necrons", label: "Necrons" },
];

// ------------------------------------------------------- legacy's aliases
{
  // Every one copied from _normalise_club_meta_faction_label.
  assert.equal(factionLabel("tau"), "T'au Empire");
  assert.equal(factionLabel("T'au"), "T'au Empire");
  assert.equal(factionLabel("t'au empire"), "T'au Empire");
  assert.equal(factionLabel("custodes"), "Adeptus Custodes");
  assert.equal(factionLabel("Adeptus Custodes"), "Adeptus Custodes");
  assert.equal(factionLabel("aos"), "Age of Sigmar");
}
{
  // Legacy's fallback: title case, and whitespace collapsed first.
  assert.equal(factionLabel("necrons"), "Necrons");
  assert.equal(factionLabel("  adepta   sororitas "), "Adepta Sororitas");
  assert.equal(factionLabel(""), "");
  assert.equal(factionLabel("   "), "");
}

// ---------------------------------------------------- splitting free text
{
  // The shape the writers produce since 0136.
  assert.deepEqual(splitArmyText("Adepta Sororitas · Hallowed Martyrs"),
    { faction: "Adepta Sororitas", rest: "Hallowed Martyrs" });
  // And the shapes members typed before there was a picker.
  assert.deepEqual(splitArmyText("Necrons, Awakened Dynasty"),
    { faction: "Necrons", rest: "Awakened Dynasty" });
  assert.deepEqual(splitArmyText("Necrons (Awakened Dynasty)"),
    { faction: "Necrons", rest: "Awakened Dynasty)" });
  assert.deepEqual(splitArmyText("Necrons"), { faction: "Necrons", rest: "" });
  assert.deepEqual(splitArmyText(""), { faction: "", rest: "" });
}
{
  // A hyphenated faction is not split on its own hyphen: the separator has to
  // have spaces round it.
  assert.equal(splitArmyText("T'au-Empire").faction, "T'au-Empire");
}

// ------------------------------------------------------------- matching
{
  assert.equal(matchFaction("Adepta Sororitas", factions)?.id, "adepta-sororitas");
  assert.equal(matchFaction("tau", factions)?.id, "tau-empire");
  assert.equal(matchFaction("custodes", factions)?.id, "adeptus-custodes");
  // The detachment half is ignored, because a detachment has to be one this
  // faction actually has and the backfill does not guess at that.
  assert.equal(matchFaction("Necrons · Awakened Dynasty", factions)?.id, "necrons");
}
{
  // Nothing it cannot be sure of. A wrong guess is a game filed under the
  // wrong faction, which is worse than no game at all.
  assert.equal(matchFaction("Space Marines", factions), null);
  assert.equal(matchFaction("", factions), null);
  assert.equal(matchFaction("   ", factions), null);
  assert.equal(matchFaction("something nobody plays", factions), null);
}
{
  // Two factions matching is no match.
  const ambiguous = [
    { id: "one", label: "Necrons" },
    { id: "two", label: "necrons" },
  ];
  assert.equal(matchFaction("Necrons", ambiguous), null);
}

console.log("faction-aliases: all pass");
