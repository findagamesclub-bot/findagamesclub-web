/**
 * Cookie consent, as a value.
 *
 * **Today the site sets no cookie that needs consent.** The only ones are
 * Supabase's session cookies, which are strictly necessary and exempt. The
 * banner exists so that the day analytics is added the consent is already
 * being collected and honoured, rather than being retrofitted across a live
 * site. `DEFERRED.md` says the same, so nobody later reads the banner as
 * evidence of tracking that is not happening.
 */

export const CONSENT_COOKIE = "fagc_consent";

/** Twelve months, which is the longest a consent should be assumed to hold. */
export const CONSENT_MONTHS = 12;

export type Consent = "necessary" | "all";

export function parseConsent(raw: string | undefined): Consent | null {
  const value = (raw ?? "").trim();
  return value === "necessary" || value === "all" ? value : null;
}

/** Whether the optional categories may run. Nothing reads this yet. */
export function analyticsAllowed(raw: string | undefined): boolean {
  return parseConsent(raw) === "all";
}

/**
 * How long a consent lasts, in seconds.
 *
 * UTC, not local. `setMonth` reads the server's timezone, so under
 * TZ=America/New_York a consent taken at 00:00 UTC on 1 March expired a day
 * early. Vercel runs in UTC and it would never have shown there.
 */
export function consentMaxAge(now = new Date()): number {
  const until = new Date(now);
  until.setUTCMonth(until.getUTCMonth() + CONSENT_MONTHS);
  return Math.round((until.getTime() - now.getTime()) / 1000);
}

