import type { MembershipTier } from "@/types/clubDetail";

/**
 * Every tier's privileges, side by side.
 *
 * Ported from legacy's comparison table (membership-comparison.js:175). Two
 * rules there are easy to miss and both matter:
 *
 * - **A row only appears if some tier has it.** A club that does not run
 *   coaching should not show an empty "Coaching discount" row across six
 *   columns.
 * - **The basic tier never counts as having an extra.** It is what you get for
 *   nothing, so a paid tier offering the same thing has to say so itself.
 *
 * Rows marked `always` are what club membership includes at any tier, so they
 * are stated rather than left blank and inferred.
 */
export type ComparisonRow = {
  label: string;
  /** One cell per tier, in tier order. Null renders as "not included". */
  values: (string | null)[];
};

type Reader = (b: Record<string, unknown>) => string | null;

const n = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const yes = (v: unknown): boolean => v === true || v === "true";

const pct = (key: string): Reader => (b) => (n(b[key]) > 0 ? `${n(b[key])}%` : null);
const some = (key: string, unit: (v: number) => string): Reader =>
  (b) => (n(b[key]) > 0 ? unit(n(b[key])) : null);
const flag = (key: string): Reader => (b) => (yes(b[key]) ? "Yes" : null);

/** What every member gets, whatever they pay. */
const ALWAYS: string[] = [
  "Club member access",
  "Table booking",
  "Event booking",
  "Discussion board",
  "Message members",
  "Earn loyalty points",
];

const EXTRAS: { label: string; read: Reader }[] = [
  { label: "Table booking discount", read: pct("bookingDiscountPercent") },
  { label: "Event ticket discount", read: pct("eventDiscountPercent") },
  { label: "Merchandise discount", read: pct("merchandiseDiscountPercent") },
  { label: "Coaching discount", read: pct("coachingDiscountPercent") },
  { label: "No table booking fee", read: flag("waiveGameBookingFee") },
  { label: "Loyalty earn multiplier",
    read: (b) => (n(b.loyaltyEarnMultiplier) > 1 ? `${n(b.loyaltyEarnMultiplier)}x` : null) },
  { label: "Bonus loyalty points", read: (b) => {
      const parts = [
        n(b.bonusMembershipApprovalPoints) ? `join +${n(b.bonusMembershipApprovalPoints)}` : "",
        n(b.bonusGameBookingPoints) ? `booking +${n(b.bonusGameBookingPoints)}` : "",
        n(b.bonusEventBookingPoints) ? `event +${n(b.bonusEventBookingPoints)}` : "",
        n(b.bonusAnniversaryPoints) ? `year +${n(b.bonusAnniversaryPoints)}` : "",
      ].filter(Boolean);
      return parts.length ? parts.join(", ") : null;
    } },
  { label: "Upcoming bookings", read: some("maxUpcomingBookings", (v) => `${v}`) },
  { label: "Extra booking days", read: some("extraAdvanceBookingDates", (v) => `${v}`) },
  { label: "Event tickets early", read: some("priorityEventAdvanceDays", (v) => `${v} days`) },
  { label: "Open looking-for-game posts", read: some("lookingForGamePostLimit", (v) => `${v}`) },
  { label: "Looking-for-game days ahead", read: some("lookingForGameFutureDates", (v) => `${v}`) },
  { label: "Member-only event tickets", read: flag("premiumTicketAccess") },
  { label: "Priority league entry", read: flag("priorityLeagueAccess") },
  { label: "Club merchandise", read: flag("merchandiseAccess") },
  { label: "Book coaching sessions", read: flag("coachingBookingAccess") },
  { label: "Offer coaching to others", read: flag("listCoachingAccess") },
  { label: "Rivalry tracking", read: flag("rivalryToolsAccess") },
  { label: "Priority in opponent finder", read: flag("priorityOpponentFinderPlacement") },
  { label: "Private boards", read: (b) =>
      Array.isArray(b.privateDiscussionCategories) && b.privateDiscussionCategories.length
        ? `${b.privateDiscussionCategories.length}`
        : null },
];

export function buildTierComparison(tiers: MembershipTier[]): ComparisonRow[] {
  if (!tiers.length) return [];

  const always: ComparisonRow[] = ALWAYS.map((label) => ({
    label,
    values: tiers.map(() => "Yes"),
  }));

  const extras = EXTRAS.map(({ label, read }) => ({
    label,
    // A free tier is what nothing buys you, so it never counts as an extra.
    // Keyed on the price rather than on which tier is the default: Didcot's
    // entry tier costs £10 a month, and every perk it includes was blanked.
    values: tiers.map((t) => (t.isFree ? null : read(t.benefitValues ?? {}))),
  })).filter((row) => row.values.some(Boolean));

  return [...always, ...extras];
}
