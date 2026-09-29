/**
 * How many runs somebody has left, and when the next one comes back.
 *
 * A **rolling 24 hours**, not a calendar day
 * (`_build_army_analysis_usage_summary_from_records`, club_store.py:7635). The
 * difference matters to the person waiting: an allowance that resets at
 * midnight is one cliff, and this returns one run at a time, twenty-four hours
 * after the run that used it. Somebody who spent five at nine in the morning
 * gets one back at nine the next morning, not all five.
 *
 * A failed run is not in `at`. The caller passes only the runs that produced
 * something, because being told you have used your allowance on an answer you
 * never received is the worst version of this.
 */

export type Usage = {
  limit: number;
  used: number;
  /** Null when the limit is 0, which legacy treats as unlimited. */
  remaining: number | null;
  limited: boolean;
  retryAfterSeconds: number;
  retryAfterLabel: string;
  nextAvailableAt: string;
  message: string;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Legacy's own wording, including "under a minute" rather than a countdown:
 * a number of seconds ticking down is a number somebody watches.
 */
export function durationLabel(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  if (seconds < 60) return "under a minute";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hoursSaid = `${hours} hour${hours === 1 ? "" : "s"}`;
  if (rest === 0) return hoursSaid;
  return `${hoursSaid} ${rest} minute${rest === 1 ? "" : "s"}`;
}

export function usageFor(params: {
  /** ISO timestamps of the successful runs of this feature, any order. */
  at: string[];
  limit: number;
  /** Plural, lower case: "coaching runs", "match-up analyses". */
  noun: string;
  now: Date;
}): Usage {
  const limit = Math.max(0, Math.floor(params.limit || 0));
  const now = params.now.getTime();
  const inWindow = params.at
    .map((one) => new Date(one).getTime())
    .filter((one) => Number.isFinite(one) && one >= now - DAY)
    .sort((a, b) => b - a);

  // The run that will fall out of the window first is the one at the limit,
  // counting back from the newest. Its own time plus a day is when one
  // returns, which is why this is not "midnight".
  const boundary = limit > 0 && inWindow.length >= limit
    ? inWindow[limit - 1] + DAY
    : null;

  const retryAfterSeconds = boundary
    ? Math.max(0, Math.ceil((boundary - now) / 1000))
    : 0;
  const retryAfterLabel = retryAfterSeconds ? durationLabel(retryAfterSeconds) : "";
  const remaining = limit <= 0 ? null : Math.max(0, limit - inWindow.length);

  const message = retryAfterSeconds
    ? `You’ve reached the ${params.noun} limit for now. Try again in ${retryAfterLabel}.`
    : limit <= 0
      ? `Unlimited daily ${params.noun} available.`
      : `${remaining} daily ${params.noun} left.`;

  return {
    limit,
    used: inWindow.length,
    remaining,
    limited: retryAfterSeconds > 0,
    retryAfterSeconds,
    retryAfterLabel,
    nextAvailableAt: boundary ? new Date(boundary).toISOString() : "",
    message,
  };
}
