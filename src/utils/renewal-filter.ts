import { standing } from "./membership-billing";
import type { ClubMember } from "@/types/membership";
import type { MembershipPayment } from "@/types/payment";

/**
 * A club's memberships, as the owner needs to see them.
 *
 * Legacy's Renewals section, ported: the same nine filters and the same search
 * (matchesOwnerMembershipRenewalFilter, club_store.js / directory-v2.js:10106).
 * Everything here is derived from the payments table rather than stored, for
 * the reason membership-billing already gives: a "paid through" column and a
 * ledger disagree the moment anybody corrects a mistake.
 */

export type RenewalFilter =
  | "all" | "due" | "expiring" | "overdue" | "paid"
  | "monthly" | "yearly" | "one-off" | "free";

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
  const { paidThrough, overdue, settledOneOff } = standing(
    params.payments, params.member.tierKey, params.member.tierAssignedAt,
  );

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
    case "free": return row.free;
    default: return row.cadence === filter;
  }
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
  { query = "", filter = "all", sort = "soonest" }: {
    query?: string; filter?: RenewalFilter; sort?: RenewalSort;
  },
): RenewalRow[] {
  const needle = fold(query);

  const kept = rows.filter((row) =>
    matches(row, filter) && (!needle || haystack(row).includes(needle)));

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

/** How many memberships sit in each tab. */
export function countRenewals(rows: RenewalRow[]) {
  const of = (filter: RenewalFilter) => rows.filter((r) => matches(r, filter)).length;
  return {
    all: rows.length,
    due: of("due"),
    expiring: of("expiring"),
    overdue: of("overdue"),
    paid: of("paid"),
  };
}
