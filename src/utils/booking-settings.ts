import type { MembershipSettings } from "@/types/booking";

/**
 * Club booking settings, with legacy's defaults.
 *
 * Ported from MEMBERSHIP_DEFAULT_SETTINGS (club_store.py:69-76).
 */
export const DEFAULT_SETTINGS: MembershipSettings = {
  basicLabel: "Basic Member",
  advanceBookingDates: 4,
  upcomingBookingLimit: 0,
  eventAdvanceDays: 365,
  lookingForGameFutureDates: 2,
  lookingForGamePostLimit: 1,
  loyaltyRedemptionCapPercent: 100,
};

function nonNegative(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Read a club's settings row, applying legacy's defaults.
 *
 * There is one asymmetry here and everything downstream depends on it. Legacy
 * writes `parse(x) or DEFAULT` for five of the six numbers, so a stored 0 falls
 * back to the default — a club cannot switch those off through the number
 * field. `upcomingBookingLimit` is written WITHOUT the `or` (club_store.py:14009),
 * so its 0 survives, and at the check site `if max > 0 and ...`
 * (club_store.py:3259) that 0 means UNLIMITED rather than "none allowed".
 *
 * Iron Dice is stored as 0 and therefore has no booking cap at all. Coercing it
 * to a default would silently cap a club that chose not to.
 */
export function resolveMembershipSettings(
  row: Partial<Record<keyof MembershipSettings, unknown>> | null | undefined,
): MembershipSettings {
  const r = row ?? {};
  const orDefault = (value: unknown, fallback: number) => nonNegative(value) || fallback;

  return {
    basicLabel: String(r.basicLabel ?? "").trim() || DEFAULT_SETTINGS.basicLabel,
    advanceBookingDates: orDefault(r.advanceBookingDates, DEFAULT_SETTINGS.advanceBookingDates),
    // No `or` — see above. 0 is a real value meaning unlimited.
    upcomingBookingLimit: nonNegative(r.upcomingBookingLimit),
    eventAdvanceDays: orDefault(r.eventAdvanceDays, DEFAULT_SETTINGS.eventAdvanceDays),
    lookingForGameFutureDates: orDefault(
      r.lookingForGameFutureDates, DEFAULT_SETTINGS.lookingForGameFutureDates),
    lookingForGamePostLimit: orDefault(
      r.lookingForGamePostLimit, DEFAULT_SETTINGS.lookingForGamePostLimit),
    loyaltyRedemptionCapPercent: Math.min(
      100, orDefault(r.loyaltyRedemptionCapPercent, DEFAULT_SETTINGS.loyaltyRedemptionCapPercent)),
  };
}

/** The shape `club_membership_settings` actually returns. */
export type MembershipSettingsRow = {
  basic_label?: string | null;
  advance_booking_dates?: number | null;
  upcoming_booking_limit?: number | null;
  event_advance_days?: number | null;
  looking_for_game_future_dates?: number | null;
  looking_for_game_post_limit?: number | null;
  loyalty_redemption_cap_percent?: number | null;
};

/**
 * Map a database row into the shape the rules work on.
 *
 * Kept separate so the rules stay testable with plain objects and never have to
 * know a column name.
 */
export function settingsFromRow(row: MembershipSettingsRow | null | undefined): MembershipSettings {
  if (!row) return resolveMembershipSettings(null);
  return resolveMembershipSettings({
    basicLabel: row.basic_label,
    advanceBookingDates: row.advance_booking_dates,
    upcomingBookingLimit: row.upcoming_booking_limit,
    eventAdvanceDays: row.event_advance_days,
    lookingForGameFutureDates: row.looking_for_game_future_dates,
    lookingForGamePostLimit: row.looking_for_game_post_limit,
    loyaltyRedemptionCapPercent: row.loyalty_redemption_cap_percent,
  });
}
