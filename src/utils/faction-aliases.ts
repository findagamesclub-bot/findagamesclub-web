import { fold } from "./text";

/**
 * Turning what somebody typed into a faction the catalogue knows.
 *
 * Members have been typing armies into a free-text box since Milestone 2, so
 * `booked_by_army` holds "tau", "Custodes" and "Adepta Sororitas · Hallowed
 * Martyrs" in the same column. The backfill has to turn as much of that into
 * real factions as it honestly can, and print the rest.
 *
 * Legacy's own aliases, copied from `_normalise_club_meta_faction_label`
 * (club_store.py:20538), plus its fallback of title-casing anything unknown.
 * Nothing invented: a wrong guess here is a game filed under the wrong faction
 * in the meta tracker, which is worse than no game at all.
 */

const ALIASES: Record<string, string> = {
  "tau": "T'au Empire",
  "t'au": "T'au Empire",
  "t'au empire": "T'au Empire",
  "adeptus custodes": "Adeptus Custodes",
  "custodes": "Adeptus Custodes",
  "space marines": "Space Marines",
  "salamanders": "Salamanders",
  "dark angels": "Dark Angels",
  "aos": "Age of Sigmar",
  "age of sigmar": "Age of Sigmar",
};

const titleCase = (value: string) =>
  value.split(" ").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");

/** Legacy's label folding, so "tau" and "T'au" are one faction. */
export function factionLabel(raw: string): string {
  const clean = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const key = clean.toLowerCase();
  return ALIASES[key] ?? titleCase(key);
}

/**
 * The half of a free-text army that names the faction.
 *
 * The result writers have written `faction · detachment` since 0136, and
 * members typed the same shape by hand before that. Anything after the first
 * separator is the detachment, which the backfill deliberately does not guess
 * at: a detachment has to be one this faction actually has.
 */
export function splitArmyText(raw: string): { faction: string; rest: string } {
  const clean = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return { faction: "", rest: "" };
  // A comma attaches to the word it follows, so it needs no space in front of
  // it. A dash and a pipe do: "T'au-Empire" is one faction, not two.
  const at = clean.search(/\s[·|-]\s|,\s|\s\(/);
  if (at === -1) return { faction: clean, rest: "" };
  return { faction: clean.slice(0, at).trim(), rest: clean.slice(at).replace(/^[\s·|,(-]+/, "").trim() };
}

/**
 * Match free text to one of the catalogue's factions, or nothing.
 *
 * `fold()` normalises both sides, the way every other comparison in this app
 * does. Two factions matching is no match: the backfill prints it and a person
 * decides, which is the same discipline `canonicalGame` uses.
 */
export function matchFaction(
  raw: string, factions: { id: string; label: string }[],
): { id: string; label: string } | null {
  const wanted = factionLabel(splitArmyText(raw).faction);
  if (!wanted) return null;

  const folded = fold(wanted);
  const hits = factions.filter(
    (one) => fold(one.label) === folded || fold(one.id) === fold(wanted.replace(/\s+/g, "-")));
  return hits.length === 1 ? hits[0]! : null;
}
