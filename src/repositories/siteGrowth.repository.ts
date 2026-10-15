import "server-only";

import { callRpc } from "@/lib/supabase/table";

/**
 * How the site itself is doing (0191).
 *
 * Two calls, fired together: a run of months for the charts and one jsonb for
 * the figures. The months carry every series rather than one read per line,
 * because they all come out of the same run of calendar buckets and three
 * round trips for three columns is three times the wall clock for nothing.
 */

export type GrowthMonthRow = {
  month_start: string;
  clubs_listed: number;
  events_added: number;
  accounts_joined: number;
  listing_pence: number;
  featured_pence: number;
};

export type GrowthSummaryRow = {
  window: Record<string, number>;
  before: Record<string, number>;
  beforeFrom: string;
  beforeTo: string;
  now: Record<string, number>;
};

export const findGrowthMonths = (from: string, to: string) =>
  callRpc<GrowthMonthRow[]>("admin_growth_months", { p_from: from, p_to: to });

export const findGrowthSummary = (from: string, to: string) =>
  callRpc<GrowthSummaryRow>("admin_growth_summary", { p_from: from, p_to: to });
