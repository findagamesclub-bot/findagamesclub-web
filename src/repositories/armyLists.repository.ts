import "server-only";

import { callRpc, table } from "@/lib/supabase/table";

/**
 * Army lists and their versions.
 *
 * `src/types/database.ts` has not been regenerated since stage 3, so these go
 * through `table()` with hand-written row shapes rather than the generated
 * ones. Swap them over when the types catch up.
 */

export type ListRow = {
  id: number;
  club_id: number;
  profile_id: string;
  name: string;
  list_type: string;
  faction_id: string;
  faction_label: string;
  points_limit: string;
  edition_id: string;
  current_version_id: number | null;
  updated_at: string;
  /** Embedded so the account hub can address each club without a second read. */
  club?: { slug: string; name: string } | null;
};

export type VersionRow = {
  id: number;
  list_id: number;
  version_number: number;
  name: string;
  list_type: string;
  faction_id: string;
  faction_label: string;
  detachment_selections: unknown;
  units: unknown;
  points_limit: string;
  total_points: number;
  edition_id: string;
  catalogue_version: string;
  change_summary: string;
  created_at: string;
};

const LIST_COLUMNS =
  "id, club_id, profile_id, name, list_type, faction_id, faction_label,"
  + " points_limit, edition_id, current_version_id, updated_at";

const VERSION_COLUMNS =
  "id, list_id, version_number, name, list_type, faction_id, faction_label,"
  + " detachment_selections, units, points_limit, total_points, edition_id,"
  + " catalogue_version, change_summary, created_at";

/** Every list at one club the reader may see. Policy decides which. */
export async function findClubLists(club: number): Promise<ListRow[]> {
  const rows = await (await table<ListRow>("army_lists"))
    .select(LIST_COLUMNS)
    .eq("club_id", club)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  return rows.data ?? [];
}

/** One person's lists across every club, for the account hub. */
export async function findMyLists(profile: string): Promise<ListRow[]> {
  const rows = await (await table<ListRow>("army_lists"))
    .select(`${LIST_COLUMNS}, club:clubs(slug, name)`)
    .eq("profile_id", profile)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  return rows.data ?? [];
}

export async function findList(id: number): Promise<ListRow | null> {
  const row = await (await table<ListRow>("army_lists"))
    .select(LIST_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return row.data ?? null;
}

/** The versions named by a set of lists, in one read rather than one each. */
export async function findVersionsFor(listIds: number[]): Promise<VersionRow[]> {
  if (!listIds.length) return [];
  const rows = await (await table<VersionRow>("army_list_versions"))
    .select(VERSION_COLUMNS)
    .in("list_id", listIds)
    .order("version_number", { ascending: false });
  return rows.data ?? [];
}

export const saveList = (
  list: number | null, club: number, payload: unknown, summary: string,
) => callRpc<{
  listId: number; versionId: number; versionNumber: number;
  createdVersion: boolean; totalPoints: number; dropped: string[];
}>("save_army_list", {
  p_list: list, p_club: club, p_payload: payload, p_summary: summary,
});

export const removeList = (list: number) =>
  callRpc<null>("delete_army_list", { p_list: list });
