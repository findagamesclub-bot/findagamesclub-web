import "server-only";

import { callRpc } from "@/lib/supabase/table";

/**
 * Every club and every event, for the two screens the client asked for.
 *
 * Filtered, counted and paged in SQL (0118). The whole point of these pages is
 * that they hold everything, so shipping five thousand clubs to the browser to
 * hide 4,975 of them is the thing the scale rules exist to stop.
 *
 * The total comes back on every row rather than as a second query: it is the
 * same number on each one, and one round trip beats two for a figure the pager
 * cannot render without.
 */

export type AdminClubRow = {
  id: number; slug: string; name: string; city: string; status: string;
  claimable: boolean; spotlight: boolean; owner_name: string;
  members: number; total_count: number;
};

export type AdminEventRow = {
  id: number; legacy_id: string; title: string; start_date: string; status: string;
  club_slug: string; club_name: string;
  places: number; sold: number; total_count: number;
};

export const findAdminClubs = (params: {
  query: string; status: string; limit: number; offset: number;
}) => callRpc<AdminClubRow[]>("admin_clubs", {
  p_query: params.query, p_status: params.status,
  p_limit: params.limit, p_offset: params.offset,
});

export const findAdminClubCounts = (query: string) =>
  callRpc<Record<string, number>>("admin_club_counts", { p_query: query });

export const findAdminEventCounts = (query: string) =>
  callRpc<Record<string, number>>("admin_event_counts", { p_query: query });

export const findAdminEvents = (params: {
  query: string; status: string; when: string; limit: number; offset: number;
}) => callRpc<AdminEventRow[]>("admin_events", {
  p_query: params.query, p_status: params.status, p_when: params.when,
  p_limit: params.limit, p_offset: params.offset,
});
