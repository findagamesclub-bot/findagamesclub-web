import "server-only";

import { createClient } from "@/lib/supabase/server";
import { callRpc, table } from "@/lib/supabase/table";

/**
 * Listings being written and listings waiting to be looked at.
 *
 * Shimmed because `club_submissions` arrived with 0099 and the generated types
 * do not carry it yet.
 */
export type SubmissionRow = {
  id: number;
  owner_id: string;
  status: string;
  club_name: string;
  city: string;
  payload: Record<string, unknown>;
  last_step: string;
  club_id: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string;
  decline_reason: string;
  /** The finished listing this one was started again from. */
  restarted_from: number | null;
  created_at: string;
  updated_at: string;
};

/** Everything a list needs. */
export type SubmissionListRow = Omit<SubmissionRow, "payload"> & {
  /**
   * The club this became, once approved.
   *
   * Embedded rather than fetched separately because the owner's own list is the
   * one place that needs to link into a live club's console, and a second round
   * trip to turn an id into a slug is a round trip per page.
   */
  club?: { slug: string; status: string } | null;
};

/**
 * The payload is deliberately absent from the list columns.
 *
 * It is the whole listing as jsonb, tens of kilobytes on a finished one. A
 * queue of twenty-five rows would drag half a megabyte across to draw
 * twenty-five club names. The review screen reads one row and gets it all.
 */
const LIST_COLUMNS =
  `id, owner_id, status, club_name, city, last_step, club_id,
   submitted_at, reviewed_at, review_note, decline_reason, restarted_from,
   created_at, updated_at, club:clubs(slug, status)`;

const FULL_COLUMNS = `${LIST_COLUMNS}, payload`;

export async function findSubmission(id: number): Promise<SubmissionRow | null> {
  const rows = await table<SubmissionRow>("club_submissions");
  const { data, error } = await rows.select(FULL_COLUMNS).eq("id", id).maybeSingle();

  if (error) throw new Error(`Failed to load that listing: ${error.message}`);
  return data;
}

/** Every listing this person has started, newest first. */
export async function findMySubmissions(profileId: string): Promise<SubmissionListRow[]> {
  const rows = await table<SubmissionListRow>("club_submissions");
  const { data, error } = await rows
    .select(LIST_COLUMNS)
    .eq("owner_id", profileId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to load your listings: ${error.message}`);
  return data ?? [];
}

/**
 * The one the resume card points at.
 *
 * Newest first and limited to one, so a person who started three gets the one
 * they touched last rather than the one they started first.
 */
export async function findMyLivestSubmission(profileId: string): Promise<SubmissionListRow | null> {
  const rows = await table<SubmissionListRow>("club_submissions");
  const { data, error } = await rows
    .select(LIST_COLUMNS)
    .eq("owner_id", profileId)
    .in("status", ["draft", "changes_requested", "review_pending"])
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(`Failed to check your listings: ${error.message}`);
  return data?.[0] ?? null;
}

export async function startSubmission(fields: {
  club_name: string; city: string; payload: Record<string, unknown>; last_step: string;
}): Promise<SubmissionListRow> {
  const rows = await table<SubmissionListRow>("club_submissions");
  const { data, error } = await rows.insert(fields).select(LIST_COLUMNS).maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/**
 * Save a step into the draft.
 *
 * Matched on the states the policy allows rather than on the id alone, so a
 * submission an admin picked up while this form was open affects zero rows and
 * says so, instead of quietly reporting a save that never happened.
 */
export async function saveSubmissionDraft(
  id: number,
  patch: Partial<Pick<SubmissionRow, "club_name" | "city" | "payload" | "last_step">>,
): Promise<SubmissionListRow> {
  const rows = await table<SubmissionListRow>("club_submissions");
  const { data, error } = await rows
    .update(patch)
    .eq("id", id)
    .in("status", ["draft", "changes_requested"])
    .select(LIST_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/**
 * One page of the queue.
 *
 * Paged in SQL with an exact count, because a site with five thousand
 * submissions is a site that is working. Oldest first when waiting, which is
 * the order an admin has to work in to be fair; newest first once decided,
 * because then the question is "what happened recently".
 */
export async function findSubmissionsPage(params: {
  status: string;
  query: string;
  /** "oldest" for the queue's own order, "newest" for what happened lately. */
  sort: string;
  from: number;
  to: number;
}): Promise<{ rows: SubmissionListRow[]; total: number }> {
  const rows = await table<SubmissionListRow>("club_submissions");
  let query = rows.select(LIST_COLUMNS, { count: "exact" });

  if (params.status !== "all") query = query.eq("status", params.status);

  const term = params.query.trim();
  if (term) {
    const safe = term.replace(/[%,()]/g, " ").trim();
    if (safe) query = query.or(`club_name.ilike.%${safe}%,city.ilike.%${safe}%`);
  }

  // Oldest first on the waiting list, because that is the only order that is
  // fair to the person who sent theirs in three weeks ago. Everywhere else the
  // question is "what happened lately", so newest leads.
  const waiting = params.status === "review_pending" || params.status === "changes_requested";
  const oldestFirst = params.sort === "oldest" && waiting;
  const { data, error, count } = await query
    .order(waiting ? "submitted_at" : "updated_at", { ascending: oldestFirst })
    .range(params.from, params.to);

  if (error) throw new Error(`Failed to load the queue: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
}

/**
 * How many times each of these requests was sent back.
 *
 * From the log rather than from a column, because the column only ever held the
 * latest note. One query for the whole page, and the rows it returns are one
 * per round, which is a handful even for a listing that went round ten times.
 */
export async function countSendBacks(ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();

  const rows = await table<{ submission_id: number }>("club_submission_events");
  const { data, error } = await rows
    .select("submission_id")
    .eq("kind", "changes_requested")
    .in("submission_id", ids);

  if (error) throw new Error(`Failed to count the rounds: ${error.message}`);

  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    counts.set(row.submission_id, (counts.get(row.submission_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Which of these requests were later started again, and what became of the try
 * that replaced them.
 *
 * One query for the whole page rather than one per row, and only for the ids
 * actually on screen, so it costs the same at a page of fifty as at a page of
 * one and nothing at all on a page with none.
 */
export async function findSuccessors(
  ids: number[],
): Promise<{ id: number; status: string; restarted_from: number }[]> {
  if (ids.length === 0) return [];

  const rows = await table<{ id: number; status: string; restarted_from: number }>(
    "club_submissions");
  const { data, error } = await rows
    .select("id, status, restarted_from")
    .in("restarted_from", ids);

  if (error) throw new Error(`Failed to load what replaced those: ${error.message}`);
  return data ?? [];
}

/**
 * How many are in each state.
 *
 * Index counts over `club_submissions_queue_idx` rather than loading the rows
 * to measure them, and fired as one wave rather than one after another.
 */
export async function countSubmissionsByStatus(
  statuses: string[],
): Promise<Map<string, number>> {
  const rows = await table<{ id: number }>("club_submissions");
  const counted = await Promise.all(statuses.map(async (status) => {
    const query = rows.select("id", { count: "exact" }).limit(1);
    const { count, error } = await (status === "all" ? query : query.eq("status", status));
    if (error) throw new Error(`Failed to count the queue: ${error.message}`);
    return [status, count ?? 0] as const;
  }));
  return new Map(counted);
}

/**
 * Bin one outright.
 *
 * Only a draft or a cancelled one, which the policy in 0101 enforces. The
 * zero-row pattern turns a refusal into a message: a delete the policy filters
 * out removes nothing and returns no error, so the absence of a returned row is
 * how we know it did not happen.
 */
export async function deleteSubmission(id: number): Promise<void> {
  const rows = await table<{ id: number }>("club_submissions");
  const { data, error } = await rows
    .delete()
    .eq("id", id)
    .in("status", ["draft", "cancelled"])
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
}

export const submitSubmission = (id: number) =>
  callRpc<string>("submit_club_submission", { p_id: id });

export const cancelSubmission = (id: number) =>
  callRpc<string>("cancel_club_submission", { p_id: id });

export type SubmissionEventRow = {
  id: number;
  kind: string;
  body: string;
  created_at: string;
  actor: { full_name: string | null } | null;
};

/**
 * Everything that has happened to one listing, oldest first.
 *
 * Read on its own rather than embedded in the submission, because most screens
 * that load a submission do not draw a history and a join would make them all
 * pay for the one that does.
 */
export async function findSubmissionEvents(
  submissionId: number,
): Promise<SubmissionEventRow[]> {
  const rows = await table<SubmissionEventRow>("club_submission_events");
  const { data, error } = await rows
    .select("id, kind, body, created_at, actor:profiles(full_name)")
    .eq("submission_id", submissionId)
    // By time first, id second. The trigger writes in order so the two agree
    // on everything it wrote, but 0107's backfill dated its rows from columns
    // rather than from when the row was inserted, and those two disagree.
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(`Failed to load that history: ${error.message}`);
  return data ?? [];
}

/**
 * The history of several listings at once, oldest first.
 *
 * For the owner's own cards, which are a handful rather than a page: one query
 * for all of them beats one per card, and the card only opens its history when
 * somebody asks for it.
 */
export async function findSubmissionEventsMany(
  ids: number[],
): Promise<(SubmissionEventRow & { submission_id: number })[]> {
  if (ids.length === 0) return [];

  const rows = await table<SubmissionEventRow & { submission_id: number }>(
    "club_submission_events");
  const { data, error } = await rows
    .select("id, submission_id, kind, body, created_at, actor:profiles(full_name)")
    .in("submission_id", ids)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(`Failed to load those histories: ${error.message}`);
  return data ?? [];
}

/**
 * Who is asking, and what else they have here.
 *
 * An admin deciding whether to list a club should be able to see the person
 * behind it without leaving the screen: the same name turning up for a fourth
 * club, or an account made ten minutes ago, is the context the decision
 * actually turns on.
 */
export async function findSubmitter(profileId: string): Promise<{
  name: string; joinedAt: string | null; clubsOwned: number; listings: number;
} | null> {
  const supabase = await createClient();

  const [profile, clubs, listings] = await Promise.all([
    supabase.from("profiles").select("full_name, created_at").eq("id", profileId).maybeSingle(),
    supabase.from("clubs").select("id", { count: "exact", head: true }).eq("owner_id", profileId),
    // The shim's `select` has no `head`, so this reads the ids and counts them.
    // Somebody has a handful of listings, so that is one small row set rather
    // than a second query shape to maintain.
    (await table<{ id: number }>("club_submissions"))
      .select("id").eq("owner_id", profileId),
  ]);

  if (!profile.data) return null;
  return {
    name: profile.data.full_name ?? "",
    joinedAt: profile.data.created_at ?? null,
    clubsOwned: clubs.count ?? 0,
    listings: listings.data?.length ?? 0,
  };
}

/** Returns the id of the new draft, which may be one they already started. */
export const restartSubmission = (id: number) =>
  callRpc<number>("restart_club_submission", { p_id: id });

export const requestSubmissionChanges = (id: number, note: string) =>
  callRpc<string>("request_submission_changes", { p_id: id, p_note: note });

export const declineSubmission = (id: number, reason: string) =>
  callRpc<string>("decline_club_submission", { p_id: id, p_reason: reason });

export const approveSubmission = (id: number) =>
  callRpc<{ club_id: number; slug: string; name: string }>(
    "approve_club_submission", { p_id: id });
