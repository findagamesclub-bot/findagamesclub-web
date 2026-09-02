import { standing } from "./membership-billing";
import type { ClubMember } from "@/types/membership";
import type { MembershipPayment, PaymentStanding } from "@/types/payment";

/**
 * A club's memberships, as the owner needs to see them.
 *
 * Legacy's Renewals section, ported: the same nine filters and the same search
 * (matchesOwnerMembershipRenewalFilter, club_store.js / directory-v2.js:10106).
 * Everything here is derived from the payments table rather than stored, for
 * the reason membership-billing already gives: a "paid through" column and a
 * ledger disagree the moment anybody corrects a mistake.
 */

/** What state a membership is in. */
export type RenewalFilter = "all" | "due" | "expiring" | "overdue" | "paid";

/**
 * How the member pays, which is a different question from how they stand.
 *
 * These were folded into RenewalFilter, so choosing "Yearly" cleared "Lapsed"
 * and a club could not ask the one thing it actually wants to know: who on a
 * monthly plan has lapsed. Two axes, because they are two questions.
 */
export type RenewalBilling = "any" | "monthly" | "yearly" | "one-off" | "free";

export type RenewalSort = "soonest" | "name" | "joined";

/** How close a renewal has to be before it counts as "expiring soon". */
export const EXPIRING_DAYS = 30;

export type RenewalRow = {
  member: ClubMember;
  tierLabel: string;
  /** The last day this member is paid up to, or null if they never paid. */
  paidThrough: string | null;
  /** Days until paidThrough. Negative when it has passed. Null when unpaid. */
  daysLeft: number | null;
  overdue: boolean;
  /** The club charges nothing for this tier, so renewal does not apply. */
  free: boolean;
  /**
   * Bought outright. A one-off carries no period end, so paidThrough stays
   * null, and without this flag it reads as "never paid" and lands in the
   * club's chase list forever.
   */
  settled: boolean;
  /** monthly, yearly or one-off, from the last payment taken. */
  cadence: string;
  /** What the club last took, for the row to show. */
  lastPrice: string;
  /**
   * Carried so the owner can open the same Manage dialog the roster has
   * without the page fetching every membership's payments a second time. The
   * money is already loaded to work the row out.
   */
  payments: MembershipPayment[];
  standing: PaymentStanding;
};

const fold = (value: string) => value.trim().toLowerCase();

const daysBetween = (from: number, to: number) =>
  Math.floor((to - from) / 86_400_000);

/**
 * One membership, priced and dated.
 *
 * `today` is passed in rather than read, so the same inputs always give the
 * same answer and the tests do not drift at midnight.
 */
export function toRenewalRow(params: {
  member: ClubMember;
  payments: MembershipPayment[];
  tierLabel: string;
  /** True when the tier costs nothing, so nothing can be overdue. */
  free: boolean;
  today?: number;
}): RenewalRow {
  const now = params.today ?? Date.now();
  const paid = standing(
    params.payments, params.member.tierKey, params.member.tierAssignedAt,
  );
  const { paidThrough, overdue, settledOneOff } = paid;

  // Filtered exactly as standing() filters it, tier and assigned-at both. The
  // row was showing the last payment on this tier whether or not it counted,
  // so a member whose tier changed after paying read "ONE-OFF · £500 ... Never
  // paid", which looks like a bug and is really two different questions being
  // answered from two different sets of payments.
  const since = params.member.tierAssignedAt
    ? new Date(params.member.tierAssignedAt).getTime()
    : null;

  const latest = [...params.payments]
    .filter((p) =>
      p.tierKey === params.member.tierKey
      && (since === null || new Date(p.recordedAt).getTime() >= since))
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .at(-1);

  return {
    member: params.member,
    tierLabel: params.tierLabel,
    paidThrough,
    daysLeft: paidThrough ? daysBetween(now, new Date(paidThrough).getTime()) : null,
    // A one-off never lapses, and a free tier has nothing to lapse.
    overdue: overdue && !settledOneOff && !params.free,
    free: params.free,
    settled: settledOneOff,
    cadence: settledOneOff ? "one-off" : fold(latest?.priceDuration ?? ""),
    lastPrice: latest?.price ?? "",
    payments: params.payments,
    standing: paid,
  };
}

function matches(row: RenewalRow, filter: RenewalFilter): boolean {
  switch (filter) {
    case "all": return true;
    // Nothing paid at all, or already past. The club's actual to-do list.
    case "due":
      return !row.free && !row.settled && (row.paidThrough === null || row.overdue);
    case "expiring":
      return !row.free && !row.overdue && row.daysLeft !== null
        && row.daysLeft >= 0 && row.daysLeft <= EXPIRING_DAYS;
    case "overdue": return row.overdue;
    case "paid":
      return row.free || row.settled || (row.paidThrough !== null && !row.overdue);
  }
}

/**
 * What a club typed, read as one of four things.
 *
 * `cadence` comes from the payment's `priceDuration`, which is free text the
 * club wrote: the live data says "month" and "year", not "monthly" and
 * "yearly". Matching the filter name against it exactly found nothing, which
 * is why those two filters never returned a row.
 */
function cadenceKind(cadence: string): RenewalBilling | null {
  const c = fold(cadence);
  if (!c) return null;
  if (c.startsWith("month")) return "monthly";
  if (c.startsWith("year") || c.startsWith("annual")) return "yearly";
  if (c.startsWith("one") || c.startsWith("once")) return "one-off";
  return null;
}

function matchesBilling(row: RenewalRow, billing: RenewalBilling): boolean {
  if (billing === "any") return true;
  // A free tier has no cadence to match, and a paid tier is never "free"
  // however little the club charges, so this is asked first rather than as
  // another cadence string.
  if (billing === "free") return row.free;
  return !row.free && cadenceKind(row.cadence) === billing;
}

/** Name, tier, price and renewal date, so a club can search however it thinks. */
function haystack(row: RenewalRow): string {
  return fold([
    row.member.fullName, row.tierLabel, row.cadence, row.lastPrice,
    row.paidThrough ?? "", row.overdue ? "overdue expired" : "",
    row.paidThrough === null && !row.free ? "never paid unpaid" : "",
  ].filter(Boolean).join(" "));
}

export function filterRenewals(
  rows: RenewalRow[],
  { query = "", filter = "all", billing = "any", sort = "soonest" }: {
    query?: string;
    filter?: RenewalFilter;
    billing?: RenewalBilling;
    sort?: RenewalSort;
  },
): RenewalRow[] {
  const needle = fold(query);

  const kept = rows.filter((row) =>
    matches(row, filter)
    && matchesBilling(row, billing)
    && (!needle || haystack(row).includes(needle)));

  return kept.sort((a, b) => {
    if (sort === "name") return a.member.fullName.localeCompare(b.member.fullName);
    if (sort === "joined") {
      return (b.member.joinedAt ?? "").localeCompare(a.member.joinedAt ?? "");
    }
    // Soonest means whoever needs chasing first. A one-off is bought outright
    // and a free tier costs nothing, so both sit at the bottom whatever their
    // dates say: sorting them by daysLeft would put a one-off paid two years
    // ago above somebody who lapses next week.
    const rank = (r: RenewalRow) =>
      r.free ? 4
        : r.settled ? 3
        : r.paidThrough === null ? 0
        : r.overdue ? 1
        : 2;
    return rank(a) - rank(b) || (a.daysLeft ?? 0) - (b.daysLeft ?? 0);
  });
}

/**
 * How many memberships sit in each tab, counted against the billing type in
 * force. A tab reading "Lapsed 3" while the list shows none is worse than no
 * count at all, and that is what happens if the counts ignore the other axis.
 */
export function countRenewals(rows: RenewalRow[], billing: RenewalBilling = "any") {
  const pool = rows.filter((r) => matchesBilling(r, billing));
  const of = (filter: RenewalFilter) => pool.filter((r) => matches(r, filter)).length;
  return {
    all: pool.length,
    due: of("due"),
    expiring: of("expiring"),
    overdue: of("overdue"),
    paid: of("paid"),
  };
}
