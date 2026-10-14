import { DEFAULT_TIERS, tierFor, type LoyaltyTier } from "@/utils/loyalty";

export type LadderRung = { label: string; tone: string; members: number };

/**
 * How a roster sits on a club's loyalty ladder.
 *
 * The rungs come from the club's own jsonb and the mapping from `tierFor`,
 * which is the one implementation of which rung a total reaches. SQL returns
 * the lifetime totals and nothing else, so this stays the only ladder in the
 * codebase: a second copy there would disagree with a member's own page the
 * first time a club edited its tiers.
 *
 * Every rung comes back, including the empty ones. "Nobody has reached Legend"
 * is the answer a club is looking for, and dropping the row turns it into a
 * rung that looks as though it does not exist.
 */
export function ladderSpread(
  lifetime: number[], tiers: LoyaltyTier[] = DEFAULT_TIERS,
): LadderRung[] {
  const ladder = [...(tiers.length ? tiers : DEFAULT_TIERS)]
    .sort((a, b) => a.pointsRequired - b.pointsRequired);

  const counts = new Map<string, number>(ladder.map((t) => [t.label, 0]));
  for (const total of lifetime) {
    const held = tierFor(Math.max(0, Number(total) || 0), ladder).tier;
    if (held) counts.set(held.label, (counts.get(held.label) ?? 0) + 1);
  }

  return ladder.map((t) => ({
    label: t.label, tone: t.tone, members: counts.get(t.label) ?? 0,
  }));
}
