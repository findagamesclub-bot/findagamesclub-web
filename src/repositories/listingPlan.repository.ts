import "server-only";

import { callRpc } from "@/lib/supabase/table";

/**
 * Which plan a club is on.
 *
 * A function rather than a column write: `listing_subscriptions` has insert,
 * update and delete revoked from `authenticated` (0111) and that is right, so
 * 0161's definer is the only way an owner reaches their own plan. It changes
 * the interval and the price and deliberately leaves the period alone, because
 * the switch takes effect at renewal.
 */
export const setListingPlan = (clubId: number, interval: "monthly" | "yearly") =>
  callRpc<void>("set_listing_plan", { p_club: clubId, p_interval: interval });
