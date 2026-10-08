/**
 * Editing a club's own loyalty ladder.
 *
 * `club_loyalty_settings.tiers` has been a jsonb list since 0020 and every
 * reader already uses it: `tierFor(lifetime, programme.tiers)` on the roster,
 * the standings and the wallet. Nothing could write it, so every club in the
 * directory silently ran on `DEFAULT_TIERS` and the client asked for exactly
 * this: "set Loyalty tiers per club, including specific tier names and rewards
 * per tier and points needed to reach each tier".
 *
 * Legacy's rules (`_normalise_loyalty_settings`, club_store.py:13660), with one
 * deliberate departure named below.
 *
 * Pure. No I/O, no React, and no import from `lib`, so the tone is carried as
 * whatever string the club picked and `metalOf` does the falling back.
 */

import {
  DEFAULT_ANNIVERSARIES, DEFAULT_TIERS, type Anniversary, type LoyaltyTier,
} from "./loyalty";

/** One row of the editor. Everything is a string, because a form field is. */
export type TierDraft = {
  label: string;
  points: string;
  tone: string;
  /** One per line, which is how somebody types a short list. */
  rewards: string;
};

export type AnniversaryDraft = { years: string; points: string };

const whole = (raw: string): number => {
  const value = Number(String(raw ?? "").trim());
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : -1;
};

const lines = (raw: string): string[] =>
  String(raw ?? "").split("\n").map((one) => one.trim()).filter(Boolean);

/**
 * What is wrong with the ladder, in the club's own words.
 *
 * Legacy drops a duplicate threshold silently (`seen_thresholds`, 13689), which
 * is the "parsing is not checking" trap: a club types two tiers at 250, saves,
 * and one of them is simply not there. Refused by name instead, the same call
 * STAGE3-SPEC made about a duplicate ticket label.
 */
export function tiersProblem(rows: TierDraft[]): string {
  const live = rows.filter((row) => row.label.trim() || row.points.trim());

  for (const row of live) {
    if (!row.label.trim()) {
      return "One of the tiers has points but no name. Give it a name or take the row out.";
    }
    if (whole(row.points) < 0) {
      return `"${row.label.trim()}" needs a whole number of points, or 0 for the first rung.`;
    }
  }

  const seen = new Map<number, string>();
  for (const row of live) {
    const at = whole(row.points);
    const already = seen.get(at);
    if (already) {
      return `"${already}" and "${row.label.trim()}" both start at ${at} points. `
        + "Two tiers cannot begin at the same total.";
    }
    seen.set(at, row.label.trim());
  }

  return "";
}

/**
 * The rows, ready for the column: sorted by the points they need, lowest first.
 *
 * Sorted on the way in rather than on the way out, so the stored order is the
 * ladder's own order and nothing downstream has to know to sort it.
 */
export function normaliseTiers(rows: TierDraft[]): LoyaltyTier[] {
  const seen = new Set<number>();
  const tiers: LoyaltyTier[] = [];

  rows.forEach((row, index) => {
    const label = row.label.trim();
    const pointsRequired = whole(row.points);
    if (!label || pointsRequired < 0 || seen.has(pointsRequired)) return;
    seen.add(pointsRequired);
    tiers.push({
      label,
      pointsRequired,
      // Legacy's own fallback, so a tone nobody picked is still a key rather
      // than an empty string. `metalOf` turns anything it does not know into
      // bronze, which is why this never has to be validated here.
      tone: row.tone.trim().toLowerCase() || `tier-${index + 1}`,
      rewards: lines(row.rewards),
    });
  });

  return tiers.sort((a, b) =>
    a.pointsRequired - b.pointsRequired || a.label.localeCompare(b.label));
}

/** Years have to be positive and worth something, which is legacy's filter. */
export function normaliseAnniversaries(rows: AnniversaryDraft[]): Anniversary[] {
  const seen = new Set<number>();
  const held: Anniversary[] = [];

  for (const row of rows) {
    const years = whole(row.years);
    const points = whole(row.points);
    if (years <= 0 || points <= 0 || seen.has(years)) continue;
    seen.add(years);
    held.push({ years, points });
  }

  return held.sort((a, b) => a.years - b.years);
}

/**
 * The saved ladder read back into editor rows.
 *
 * Seeded from the defaults when a club has saved none, because that is what it
 * is already running on: an empty editor over a live Bronze-to-Legend ladder
 * would read as "this club has no tiers", and the first save would wipe it.
 * The client asked for base tiers that are then editable, and this is it.
 */
export function tierDrafts(raw: unknown): TierDraft[] {
  const rows = Array.isArray(raw) ? raw : [];
  const read = rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      label: String(row.label ?? "").trim(),
      points: String(Number(row.pointsRequired ?? 0) || 0),
      tone: String(row.tone ?? "").trim().toLowerCase(),
      rewards: (Array.isArray(row.rewards) ? row.rewards.map(String) : []).join("\n"),
    }))
    .filter((row) => row.label);

  if (read.length) return read;
  return DEFAULT_TIERS.map((tier) => ({
    label: tier.label,
    points: String(tier.pointsRequired),
    tone: tier.tone,
    rewards: tier.rewards.join("\n"),
  }));
}

/** Same seeding rule, for the same reason. */
export function anniversaryDrafts(raw: unknown): AnniversaryDraft[] {
  const rows = Array.isArray(raw) ? raw : [];
  const read = rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      years: String(Number(row.years ?? 0) || 0),
      points: String(Number(row.points ?? 0) || 0),
    }))
    .filter((row) => whole(row.years) > 0 && whole(row.points) > 0);

  if (read.length) return read;
  return DEFAULT_ANNIVERSARIES.map((one) => ({
    years: String(one.years), points: String(one.points),
  }));
}

/**
 * Whether anybody starting from nothing has a tier at all.
 *
 * `tierFor` falls back to the lowest rung, so a ladder starting at 100 does not
 * break; it just means a new member is shown a tier they have not reached. Said
 * on the screen rather than refused, because a club is allowed to want that.
 */
export function startsAtZero(rows: TierDraft[]): boolean {
  return normaliseTiers(rows).some((tier) => tier.pointsRequired === 0);
}
