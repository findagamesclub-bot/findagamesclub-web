/**
 * Whether a season plan has been overtaken by events.
 *
 * Legacy's two thresholds, whichever comes first
 * (`SEASON_COACH_STALE_MATCH_THRESHOLD` and `SEASON_COACH_STALE_AGE_DAYS`,
 * club_store.py:214): **three matches** since it was written, or **twenty-one
 * days**. A plan is advice about a season, so it goes off in two ways, and
 * saying which one happened is what makes it worth re-running rather than
 * re-reading.
 *
 * The list's signature is the third way. A plan written for v2 of a list is
 * not advice about v5.
 */

export const STALE_AFTER_MATCHES = 3;
export const STALE_AFTER_DAYS = 21;

export type Staleness = {
  stale: boolean;
  reason: string;
  matchesSince: number;
  daysSince: number;
};

export function stalenessFor(params: {
  writtenAt: string;
  matchesAtWrite: number;
  matchesNow: number;
  /** The signature of the list it was written for, and the one it has now. */
  signatureAtWrite?: string;
  signatureNow?: string;
  now: Date;
}): Staleness {
  const written = new Date(params.writtenAt).getTime();
  const days = Number.isFinite(written)
    ? Math.floor((params.now.getTime() - written) / (24 * 60 * 60 * 1000))
    : 0;
  const since = Math.max(0,
    Math.floor(params.matchesNow || 0) - Math.floor(params.matchesAtWrite || 0));

  const moved = Boolean(params.signatureAtWrite && params.signatureNow
    && params.signatureAtWrite !== params.signatureNow);

  // Named in the order somebody would act on: the list changing beats the
  // clock, and the clock is the weakest of the three.
  const reason = moved
    ? "The list has changed since this plan was written."
    : since >= STALE_AFTER_MATCHES
      ? `${since} games have been played since this plan was written.`
      : days >= STALE_AFTER_DAYS
        ? `This plan is ${days} days old.`
        : "";

  return {
    stale: Boolean(reason),
    reason,
    matchesSince: since,
    daysSince: Math.max(0, days),
  };
}
