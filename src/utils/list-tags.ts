/**
 * What job a unit does, guessed from its name.
 *
 * Legacy's own keyword table (`ARMY_LIST_COACH_UNIT_TAG_KEYWORDS`,
 * club_store.py:117) and its matching rule: a substring, case-insensitive, and
 * a unit can carry several tags. Copied rather than improved because it is the
 * evidence the coaching thresholds are built on, and changing a keyword
 * silently changes every verdict downstream.
 *
 * It is a heuristic and it is meant to be. The fallback is the tell: anything
 * it cannot place counts as a body on an objective rather than being dropped,
 * so an unrecognised unit still occupies space in the analysis.
 */

export const PRIMARY_TAGS = [
  "antiTank", "objective", "action", "mobility", "support", "durable",
] as const;

export type Tag = (typeof PRIMARY_TAGS)[number];

const KEYWORDS: Record<Tag, string[]> = {
  antiTank: ["tank", "dreadnought", "eradicator", "lancer", "annihilator",
    "predator", "ballistus", "broadside", "rail", "melta", "lascannon",
    "grav-tank", "gunship", "knight", "destroyer", "defiler"],
  objective: ["intercessor", "guard", "scout", "battleline", "prosecutor",
    "cultist", "breacher", "strike team", "guardian", "ranger", "gaunt",
    "warrior", "kroot", "infantry"],
  action: ["scout", "intercessor", "infiltrator", "reiver", "ranger",
    "guardian", "prosecutor", "cultist", "kroot", "strike team", "breacher",
    "gaunt"],
  mobility: ["bike", "jetbike", "jump", "outrider", "speeder", "cavalry",
    "wing", "gunship", "fly", "hawk", "seraphim", "warp"],
  support: ["captain", "lieutenant", "chaplain", "librarian", "apothecary",
    "techmarine", "marshal", "commander", "farseer", "sorcerer", "warboss"],
  durable: ["land raider", "tank", "dreadnought", "terminator", "knight",
    "monster", "daemon prince", "c'tan", "carnifex", "grav-tank", "gunship",
    "bladeguard", "allarus", "custodian"],
};

export function tagsFor(unitName: string): Set<Tag> {
  const name = String(unitName ?? "").trim().toLowerCase();
  const found = new Set<Tag>();
  for (const tag of PRIMARY_TAGS) {
    if (KEYWORDS[tag].some((word) => name.includes(word))) found.add(tag);
  }
  // Nothing matched. A terminator is an anchor; anything else is a body on an
  // objective. Never nothing, so an unknown unit is still counted.
  if (!found.size) found.add(name.includes("terminator") ? "durable" : "objective");
  return found;
}

/** The one tag a unit is counted under for the points split. */
export function primaryTagFor(unitName: string): Tag {
  const tags = tagsFor(unitName);
  return PRIMARY_TAGS.find((tag) => tags.has(tag)) ?? "objective";
}
