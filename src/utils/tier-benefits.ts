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

/**
 * Which heading a perk sits under.
 *
 * Legacy's three (detail.js:5424): money off, what you can do more of, and
 * features you unlock. A flat list of twenty-two truncated at eight told a
 * member "and 14 more" and never what they were.
 */
export type PerkGroup = "savings" | "access" | "tools";

type Rule = {
  key: string;
  group: PerkGroup;
  /** How the editor asks for it: a percentage, a number, or a switch. */
  kind: PerkKind;
  /** What the editor calls it. The rendered sentence is for members. */
  label: string;
  /** Returns the sentence to show, or null when this perk is not switched on. */
  render: (value: unknown) => string | null;
};

export type PerkKind = "percent" | "count" | "flag";

/** One perk, as a form needs to ask about it. */
export type PerkField = { key: string; group: PerkGroup; kind: PerkKind; label: string };

const num = (value: unknown): number => (typeof value === "number" ? value : Number(value) || 0);
const on = (value: unknown): boolean => value === true || value === "true";

/**
 * Two audiences, two wordings. `render` is the sentence a member reads on a
 * tier card ("10% off table bookings"); `label` is what the club is asked for
 * when setting it ("Off table bookings"). Deriving one from the other reads
 * badly the moment the number is in the middle of the sentence.
 */
const EDITOR_LABELS: Record<string, string> = {"bookingDiscountPercent": "Off table bookings", "eventDiscountPercent": "Off event tickets", "merchandiseDiscountPercent": "Off merchandise", "coachingDiscountPercent": "Off coaching", "waiveGameBookingFee": "No table booking fee", "maxUpcomingBookings": "Bookings they can hold at once", "extraAdvanceBookingDates": "Extra days they can book ahead", "priorityEventAdvanceDays": "Days they get event tickets early", "lookingForGamePostLimit": "Looking-for-a-game posts at once", "lookingForGameFutureDates": "Extra days they can post ahead", "bonusMembershipApprovalPoints": "Bonus points for joining", "bonusGameBookingPoints": "Bonus points per booking", "bonusEventBookingPoints": "Bonus points per event", "bonusAnniversaryPoints": "Bonus points each year", "premiumTicketAccess": "Member-only event tickets", "priorityLeagueAccess": "Priority league entry", "merchandiseAccess": "Club merchandise", "coachingBookingAccess": "Book coaching sessions", "listCoachingAccess": "Offer coaching to others", "rivalryToolsAccess": "Rivalry tracking", "priorityOpponentFinderPlacement": "Listed first when finding opponents"};

const labelFor = (key: string) => EDITOR_LABELS[key] ?? key;

const percent = (key: string, group: PerkGroup, text: (n: number) => string): Rule => ({
  key, group, kind: "percent", label: labelFor(key),
  render: (v) => (num(v) > 0 ? text(num(v)) : null),
});

const count = (key: string, group: PerkGroup, text: (n: number) => string): Rule => ({
  key, group, kind: "count", label: labelFor(key),
  render: (v) => (num(v) > 0 ? text(num(v)) : null),
});

const flag = (key: string, group: PerkGroup, text: string): Rule => ({
  key, group, kind: "flag", label: labelFor(key),
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
  percent("bookingDiscountPercent", "savings", (n) => `${n}% off table bookings`),
  percent("eventDiscountPercent", "savings", (n) => `${n}% off event tickets`),
  percent("merchandiseDiscountPercent", "savings", (n) => `${n}% off merchandise`),
  percent("coachingDiscountPercent", "savings", (n) => `${n}% off coaching`),
  flag("waiveGameBookingFee", "savings", "No table booking fee"),

  count("maxUpcomingBookings", "access", (n) => `Up to ${n} upcoming bookings`),
  count("extraAdvanceBookingDates", "access", (n) => `Book ${n} ${n === 1 ? "day" : "days"} further ahead`),
  count("priorityEventAdvanceDays", "access", (n) => `Event tickets ${n} days early`),
  count("lookingForGamePostLimit", "access", (n) => `${n} looking for game ${n === 1 ? "post" : "posts"} at once`),
  count("lookingForGameFutureDates", "access", (n) => `Post ${n} ${n === 1 ? "day" : "days"} further ahead`),

  { key: "loyaltyEarnMultiplier", group: "savings",
    kind: "count", label: "Loyalty points multiplier",
    render: (v) => (num(v) > 1 ? `${num(v)}x loyalty points` : null) },
  count("bonusMembershipApprovalPoints", "savings", (n) => `${n} bonus points when you join`),
  count("bonusGameBookingPoints", "savings", (n) => `${n} bonus points per booking`),
  count("bonusEventBookingPoints", "savings", (n) => `${n} bonus points per event`),
  count("bonusAnniversaryPoints", "savings", (n) => `${n} bonus points each year`),

  flag("premiumTicketAccess", "tools", "Member-only event tickets"),
  flag("priorityLeagueAccess", "tools", "Priority league entry"),
  flag("merchandiseAccess", "tools", "Club merchandise"),
  flag("coachingBookingAccess", "tools", "Book coaching sessions"),
  flag("listCoachingAccess", "tools", "Offer coaching to others"),
  flag("rivalryToolsAccess", "tools", "Rivalry tracking"),
  flag("priorityOpponentFinderPlacement", "tools", "Listed first when finding opponents"),
  {
    // Not in the editor: which categories a tier reserves is set on the board's
    // own categories, and a free-text list here would drift from them.
    key: "privateDiscussionCategories", group: "access",
    kind: "flag", label: "Private boards",
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

export const PERK_GROUP_LABELS: Record<PerkGroup, string> = {
  savings: "Savings",
  access: "Access",
  tools: "Tools",
};

/**
 * The same perks, under their headings, empty groups dropped.
 *
 * Order is savings, access, tools: money is the most concrete reason to pick a
 * tier, and the tools are the least.
 */
export function groupTierBenefits(
  benefits: unknown,
): { group: PerkGroup; label: string; items: string[] }[] {
  if (!benefits || typeof benefits !== "object" || Array.isArray(benefits)) return [];
  const values = benefits as TierBenefits;

  const order: PerkGroup[] = ["savings", "access", "tools"];
  return order
    .map((group) => ({
      group,
      label: PERK_GROUP_LABELS[group],
      items: RULES.filter((r) => r.group === group)
        .map((r) => r.render(values[r.key]))
        .filter((line): line is string => Boolean(line)),
    }))
    .filter((g) => g.items.length > 0);
}


/** Every perk a tier can carry, for the editor that sets them. */
export const PERK_FIELDS: PerkField[] = RULES
  // The private boards list is set from the board's categories, not here.
  .filter((rule) => rule.key !== "privateDiscussionCategories")
  .map((rule) => ({
    key: rule.key, group: rule.group, kind: rule.kind, label: rule.label,
  }));
