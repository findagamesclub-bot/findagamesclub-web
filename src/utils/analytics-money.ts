/**
 * What counts as revenue, and in what order.
 *
 * In a util rather than beside the reads, and that is load-bearing: the chart
 * is a client component and `analytics.service` is `server-only`, so importing
 * the list from there pulled `next/headers` into the browser bundle and took
 * the whole page down with a build error. The same trap `MAX_NOTICES` fell
 * into. A list three things read is a list none of them should own.
 *
 * One list, walked by the totals on the page, the stacked chart and the
 * spreadsheet, so a stream added to the schema and forgotten by a report
 * cannot happen the way coaching did: 0157 priced it and the accounts were
 * never told.
 */
export const MONEY_STREAMS = [
  { key: "membership", label: "Memberships", column: "membership_in" },
  { key: "tables", label: "Table bookings", column: "tables_in" },
  { key: "tickets", label: "Event tickets", column: "tickets_in" },
  { key: "shop", label: "Merchandise", column: "shop_in" },
  { key: "coaching", label: "Coaching", column: "coaching_in" },
] as const;

/** Just the money columns of a month, which is all this needs to know. */
export type MonthMoney = {
  [K in (typeof MONEY_STREAMS)[number]["column"]]: number;
};

/** What one month brought in, across every stream. */
export function monthRevenue(month: MonthMoney): number {
  return MONEY_STREAMS.reduce((sum, s) => sum + Number(month[s.column] ?? 0), 0);
}
