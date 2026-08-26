/**
 * Loyalty points.
 *
 * Two counters per member per club, and the difference matters: `available` is
 * what they can spend and goes down when they do; `lifetime` only ever goes up
 * and is what the tier badge is read from. Spending points must never demote
 * somebody — that is the whole reason legacy carries both deltas on every row
 * (club_store.py:18403).
 *
 * Defaults are legacy's, at club_store.py:48-62. A club overrides any of them.
 */

export type LoyaltyTier = { label: string; pointsRequired: number; tone: string };
export type Anniversary = { years: number; points: number };

export const DEFAULT_MILESTONES = {
  membershipApproved: 25,
  gameBooking: 5,
  eventBooking: 10,
  merchandisePurchase: 0,
} as const;

export const DEFAULT_ANNIVERSARIES: Anniversary[] = [
  { years: 1, points: 20 },
  { years: 2, points: 30 },
  { years: 3, points: 40 },
  { years: 5, points: 60 },
  { years: 10, points: 100 },
];

export const DEFAULT_TIERS: LoyaltyTier[] = [
  { label: "Bronze", pointsRequired: 0, tone: "bronze" },
  { label: "Silver", pointsRequired: 100, tone: "silver" },
  { label: "Gold", pointsRequired: 250, tone: "gold" },
  { label: "Platinum", pointsRequired: 500, tone: "platinum" },
  { label: "Legend", pointsRequired: 1000, tone: "legend" },
];

/**
 * What an event is worth to this member.
 *
 * (base + their tier's bonus) × their tier's multiplier, rounded. The
 * multiplier floors at 1 so a badly typed benefit cannot cost somebody points
 * they would otherwise have earned (club_store.py:_calculate_loyalty_earned_points).
 */
export function earnedPoints(params: {
  base: number;
  tierBonus?: number;
  multiplier?: number;
}): number {
  const base = Math.trunc(params.base || 0);
  if (base <= 0) return 0;

  const bonus = Math.trunc(params.tierBonus || 0);
  const multiplier = Math.max(1, Number(params.multiplier ?? 1) || 1);
  return Math.max(0, Math.round((base + bonus) * multiplier));
}

/** The highest tier their lifetime points have reached. */
export function tierFor(lifetimePoints: number, tiers: LoyaltyTier[] = DEFAULT_TIERS) {
  const ladder = [...tiers].sort((a, b) => a.pointsRequired - b.pointsRequired);
  let held = ladder[0] ?? null;
  for (const tier of ladder) {
    if (lifetimePoints >= tier.pointsRequired) held = tier;
  }
  const next = ladder.find((t) => t.pointsRequired > lifetimePoints) ?? null;

  return {
    tier: held,
    next,
    /** Points still to go, or null at the top of the ladder. */
    toNext: next ? Math.max(0, next.pointsRequired - lifetimePoints) : null,
    /** 0–1 through the current band, for the progress rule. */
    progress: next && held
      ? Math.min(1, Math.max(0,
          (lifetimePoints - held.pointsRequired) /
          Math.max(1, next.pointsRequired - held.pointsRequired)))
      : 1,
  };
}

/** Add whole years to a YYYY-MM-DD, clamping 29 February onto the 28th. */
function addYears(day: string, years: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const target = new Date(Date.UTC(y + years, m - 1, 1));
  const lastDay = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * Anniversaries that have come round and have not been paid yet.
 *
 * Legacy works these out lazily whenever the wallet is read rather than on a
 * schedule, so a club that nobody visits for a year still owes the right
 * points the moment somebody looks (club_store.py:18569).
 */
export function dueAnniversaries(params: {
  /** YYYY-MM-DD. */
  joinedOn: string | null;
  anniversaries: Anniversary[];
  /** Source keys already in the ledger. */
  awarded: Set<string>;
  membershipId: number;
  today: string;
}): { years: number; points: number; sourceKey: string; awardedOn: string }[] {
  if (!params.joinedOn) return [];

  return params.anniversaries
    .filter((a) => a.years > 0 && a.points > 0)
    .map((a) => ({
      years: a.years,
      points: a.points,
      sourceKey: `membership:${params.membershipId}::anniversary:${a.years}`,
      awardedOn: addYears(params.joinedOn!, a.years),
    }))
    .filter((a) => a.awardedOn <= params.today && !params.awarded.has(a.sourceKey))
    .sort((a, b) => a.years - b.years);
}

/**
 * What a redemption is worth, and what it is allowed to be worth.
 *
 * The cap is a percentage of the bill, so a member cannot pay for a whole
 * ticket in points unless the club has said they may.
 */
export function redemption(params: {
  points: number;
  /** Pounds per point, e.g. 0.01. */
  pointValue: number;
  availablePoints: number;
  subtotal: number;
  capPercent: number;
}): { points: number; amount: number; error?: string } {
  const wanted = Math.trunc(params.points || 0);
  if (wanted <= 0) return { points: 0, amount: 0 };

  if (!(params.pointValue > 0)) {
    return { points: 0, amount: 0, error: "This club has not set what a point is worth." };
  }
  if (wanted > params.availablePoints) {
    return { points: 0, amount: 0, error: "You do not have that many points." };
  }

  const cap = Math.max(0, Math.min(100, params.capPercent));
  const ceiling = Math.round(params.subtotal * cap) / 100;
  const asked = Math.round(wanted * params.pointValue * 100) / 100;

  if (asked > ceiling) {
    return {
      points: 0,
      amount: 0,
      error: cap === 0
        ? "This club does not take points off the price."
        : `Points can cover at most ${cap}% of this. That is ${ceiling.toFixed(2)}.`,
    };
  }

  return { points: wanted, amount: asked };
}
