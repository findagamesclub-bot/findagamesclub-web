/**
 * Membership tier perks.
 *
 * The importer stores these as the legacy object of 29 typed keys, but the read
 * in `clubDetail.service.ts` tested `Array.isArray` and fell back to an empty
 * list, so every tier card on the site has been rendering with no benefits at
 * all. Nobody spotted it because only two of eleven clubs sell a paid tier.
 *
 * Basic tiers carry the same keys with every value at zero or false, which is
 * what makes "only show what is switched on" the right rule rather than a
 * shortcut.
 */

export type TierBenefits = Record<string, unknown>;

type Rule = {
  key: string;
  /** Returns the sentence to show, or null when this perk is not switched on. */
  render: (value: unknown) => string | null;
};

const num = (value: unknown): number => (typeof value === "number" ? value : Number(value) || 0);
const on = (value: unknown): boolean => value === true || value === "true";

const percent = (key: string, text: (n: number) => string): Rule => ({
  key,
  render: (v) => (num(v) > 0 ? text(num(v)) : null),
});

const count = (key: string, text: (n: number) => string): Rule => ({
  key,
  render: (v) => (num(v) > 0 ? text(num(v)) : null),
});

const flag = (key: string, text: string): Rule => ({
  key,
  render: (v) => (on(v) ? text : null),
});

/**
 * Order is the order they are shown in, most concrete first: money off, then
 * how much more you can do, then access.
 *
 * Deliberately missing: armyBuilderAccess, matchupAnalysisAccess,
 * opponentScoutingAccess, seasonCoachAccess and detailedAnalytics. Those are
 * milestone 3 features, and listing a perk the site cannot yet deliver invites
 * "so where is it?" from the first member who pays for it.
 */
const RULES: Rule[] = [
  percent("bookingDiscountPercent", (n) => `${n}% off table bookings`),
  percent("eventDiscountPercent", (n) => `${n}% off event tickets`),
  percent("merchandiseDiscountPercent", (n) => `${n}% off merchandise`),
  percent("coachingDiscountPercent", (n) => `${n}% off coaching`),
  flag("waiveGameBookingFee", "No table booking fee"),

  count("maxUpcomingBookings", (n) => `Up to ${n} upcoming bookings`),
  count("extraAdvanceBookingDates", (n) => `Book ${n} ${n === 1 ? "day" : "days"} further ahead`),
  count("priorityEventAdvanceDays", (n) => `Event tickets ${n} days early`),
  count("lookingForGamePostLimit", (n) => `${n} looking for game ${n === 1 ? "post" : "posts"} at once`),
  count("lookingForGameFutureDates", (n) => `Post ${n} ${n === 1 ? "day" : "days"} further ahead`),

  { key: "loyaltyEarnMultiplier", render: (v) => (num(v) > 1 ? `${num(v)}x loyalty points` : null) },
  count("bonusMembershipApprovalPoints", (n) => `${n} bonus points when you join`),
  count("bonusGameBookingPoints", (n) => `${n} bonus points per booking`),
  count("bonusEventBookingPoints", (n) => `${n} bonus points per event`),
  count("bonusAnniversaryPoints", (n) => `${n} bonus points each year`),

  flag("premiumTicketAccess", "Member-only event tickets"),
  flag("priorityLeagueAccess", "Priority league entry"),
  flag("merchandiseAccess", "Club merchandise"),
  flag("coachingBookingAccess", "Book coaching sessions"),
  flag("listCoachingAccess", "Offer coaching to others"),
  flag("rivalryToolsAccess", "Rivalry tracking"),
  flag("priorityOpponentFinderPlacement", "Listed first when finding opponents"),
  {
    key: "privateDiscussionCategories",
    render: (v) =>
      Array.isArray(v) && v.length > 0 ? `Private boards: ${v.join(", ")}` : null,
  },
];

/** The perks this tier actually switches on, as sentences, in display order. */
export function describeTierBenefits(benefits: unknown): string[] {
  if (!benefits || typeof benefits !== "object" || Array.isArray(benefits)) return [];
  const values = benefits as TierBenefits;

  return RULES.map((rule) => rule.render(values[rule.key])).filter(
    (line): line is string => Boolean(line),
  );
}
