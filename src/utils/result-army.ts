/**
 * What a result may say about the army somebody played.
 *
 * Legacy's closed sets and caps, copied exactly: primary at most 50
 * (club_store.py:6433), secondary at most 40 (6435), and
 * `total = primary + secondary + (painted ? 10 : 0)` (6437). Every field is
 * optional; what is refused is a value that is there and wrong.
 *
 * The same figures are enforced by check constraints in 0135. This is what
 * decides whether a form is ready, not what decides whether it is allowed.
 */

export const PRIMARY_MAX = 50;
export const SECONDARY_MAX = 40;
export const PAINTED_BONUS = 10;

export const TURN_ORDER = [
  { value: "first", label: "Went first" },
  { value: "second", label: "Went second" },
] as const;

export const BATTLE_ROLE = [
  { value: "attacker", label: "Attacker" },
  { value: "defender", label: "Defender" },
] as const;

export type ResultArmy = {
  factionId: string;
  factionLabel: string;
  detachment: string;
  disposition: string;
  mvpUnits: string[];
  underwhelmingUnits: string[];
  primaryScore: number | null;
  secondaryScore: number | null;
  painted: boolean;
  firstTurn: string;
  battleRole: string;
};

export const EMPTY_ARMY: ResultArmy = {
  factionId: "", factionLabel: "", detachment: "", disposition: "",
  mvpUnits: [], underwhelmingUnits: [],
  primaryScore: null, secondaryScore: null, painted: false,
  firstTurn: "", battleRole: "",
};

/**
 * The total, or nothing.
 *
 * Null unless both scores are there, because a total worked out from one of
 * them is a number somebody will read as a result. Legacy leaves it alone for
 * the same reason.
 */
export function totalVp(army: {
  primaryScore: number | null; secondaryScore: number | null; painted: boolean;
}): number | null {
  if (army.primaryScore === null || army.secondaryScore === null) return null;
  return army.primaryScore + army.secondaryScore + (army.painted ? PAINTED_BONUS : 0);
}

/** A score box's value, or null. Never NaN, and never 0 for an empty box. */
export function readScore(raw: string, max: number): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 0 && value <= max ? value : null;
}

/** What is wrong with a score box, in the club's own words. */
export function scoreProblem(raw: string, max: number, label: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  if (!/^\d{1,3}$/.test(trimmed)) return `${label} has to be a whole number.`;
  if (Number(trimmed) > max) return `${label} cannot be more than ${max}.`;
  return "";
}

/** Nothing said. Used to decide whether to write a row at all. */
export function isEmptyArmy(army: ResultArmy): boolean {
  return army.factionId.trim() === ""
    && army.primaryScore === null
    && army.secondaryScore === null
    && army.mvpUnits.length === 0
    && army.underwhelmingUnits.length === 0;
}

export const isTurnOrder = (value: string) =>
  TURN_ORDER.some((one) => one.value === value);
export const isBattleRole = (value: string) =>
  BATTLE_ROLE.some((one) => one.value === value);

/** What a result row shows in one line, matching `result_army_label` in SQL. */
export function armyLabel(army: {
  factionLabel?: string; detachment?: string;
}): string {
  return [army.factionLabel?.trim(), army.detachment?.trim()]
    .filter(Boolean).join(" · ");
}

/**
 * A stored row read back into what the form holds.
 *
 * The dialog starts from this rather than from `EMPTY_ARMY`, because an empty
 * army is what `put_result_army` deletes a row for: reopening a saved result
 * and pressing save would otherwise quietly throw away the army somebody
 * recorded last week.
 */
export function armyFromRow(row: {
  faction_id?: string | null;
  faction_label?: string | null;
  detachment?: string | null;
  disposition?: string | null;
  mvp_units?: string[] | null;
  underwhelming_units?: string[] | null;
  primary_score?: number | null;
  secondary_score?: number | null;
  painted?: boolean | null;
  first_turn?: string | null;
  battle_role?: string | null;
} | null | undefined): ResultArmy {
  if (!row) return EMPTY_ARMY;
  return {
    factionId: row.faction_id ?? "",
    factionLabel: row.faction_label ?? "",
    detachment: row.detachment ?? "",
    disposition: row.disposition ?? "",
    mvpUnits: row.mvp_units ?? [],
    underwhelmingUnits: row.underwhelming_units ?? [],
    primaryScore: row.primary_score ?? null,
    secondaryScore: row.secondary_score ?? null,
    painted: Boolean(row.painted),
    firstTurn: isTurnOrder(row.first_turn ?? "") ? row.first_turn! : "",
    battleRole: isBattleRole(row.battle_role ?? "") ? row.battle_role! : "",
  };
}
