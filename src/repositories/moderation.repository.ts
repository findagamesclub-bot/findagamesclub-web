import "server-only";

import { callRpc, table } from "@/lib/supabase/table";

/**
 * Reported content, and what was done about it.
 *
 * The queue is paged and filtered in SQL (0122) over six tables at once, so the
 * browser never receives a report it is not showing. `total_count` rides on
 * every row rather than being a second query, the same shape `admin_clubs` uses.
 */

export type FlagRow = {
  id: number;
  target_type: string;
  target_id: number;
  status: string;
  reason: string;
  resolution: string;
  created_at: string;
  reporter_name: string;
  author_name: string;
  author_id: string | null;
  club_slug: string;
  club_name: string;
  body: string;
  title: string;
  /** The words have gone: removed, or deleted with their parent. */
  target_gone: boolean;
  total_count: number;
};

export const findFlags = (params: {
  type: string; status: string; query: string; limit: number; offset: number;
}) => callRpc<FlagRow[]>("moderation_queue", {
  p_type: params.type, p_status: params.status, p_query: params.query,
  p_limit: params.limit, p_offset: params.offset,
});

export const findFlagCounts = (type: string, query: string) =>
  callRpc<Record<string, number>>("moderation_queue_counts",
    { p_type: type, p_query: query });

export const reportContent = (type: string, id: number, reason: string) =>
  callRpc<number | null>("flag_content",
    { p_type: type, p_id: id, p_reason: reason });

export const resolveFlag = (flag: number, action: string, reason: string) =>
  callRpc<boolean>("resolve_moderation_flag",
    { p_flag: flag, p_action: action, p_reason: reason });

/** One row of the reporter's own view of what they reported. */
export type MyReportRow = {
  id: number;
  target_type: string;
  status: string;
  reason: string;
  resolution: string;
  created_at: string;
  resolved_at: string | null;
  club_slug: string;
  club_name: string;
  body: string;
  title: string;
  target_gone: boolean;
  total_count: number;
};

export const findMyReports = (params: {
  status: string; type: string; query: string; sort: string;
  limit: number; offset: number;
}) => callRpc<MyReportRow[]>("my_reports", {
  p_status: params.status, p_type: params.type, p_query: params.query,
  p_sort: params.sort, p_limit: params.limit, p_offset: params.offset,
});

export const findMyReportCounts = (type: string, query: string) =>
  callRpc<Record<string, number>>("my_report_counts",
    { p_type: type, p_query: query });

export const withdrawFlag = (flag: number) =>
  callRpc<boolean>("withdraw_moderation_flag", { p_flag: flag });

/**
 * Which of the things on a page this reader has already reported.
 *
 * A plain select rather than a function: `moderation_flags_select` (0122)
 * already says a reporter may read their own rows, so RLS is the guard and a
 * definer function would only be a second copy of it. The `flagged_by` filter
 * is still written out, because that policy also admits admins and a club's
 * team, and without it a manager would see every flag on their club as their
 * own.
 *
 * Unbounded by target: an open flag is one per person per thing, and somebody
 * with more open reports than this cap is a person for an admin to look at
 * rather than a list to paginate.
 */
export const findMyOpenFlags = async (profileId: string) => {
  const query = await table<{ target_type: string; target_id: number }>("moderation_flags");
  const { data, error } = await query
    .select("target_type, target_id")
    .eq("flagged_by", profileId)
    .eq("status", "open")
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
};

/**
 * A club's own queue, over the flags on its own club.
 *
 * Same row shape as the admin's, so one component draws both. The reporter's
 * name comes back as "Somebody" from SQL rather than being blanked here: a
 * club never learns who reported something, and a rule that only holds in
 * TypeScript is a rule anybody with the anon key can ignore.
 */
export const findClubFlags = (params: {
  club: number; type: string; status: string; query: string;
  limit: number; offset: number;
}) => callRpc<FlagRow[]>("club_moderation_queue", {
  p_club: params.club, p_type: params.type, p_status: params.status,
  p_query: params.query, p_limit: params.limit, p_offset: params.offset,
});

export const findClubFlagCounts = (club: number, type: string, query: string) =>
  callRpc<Record<string, number>>("club_moderation_counts",
    { p_club: club, p_type: type, p_query: query });

export const resolveClubFlag = (flag: number, action: string, reason: string) =>
  callRpc<boolean>("resolve_club_flag",
    { p_flag: flag, p_action: action, p_reason: reason });
