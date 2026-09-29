import "server-only";

import { callRpc, table } from "@/lib/supabase/table";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * The army catalogue.
 *
 * Reads go straight through RLS, which is public select: there is nothing
 * private in a points value, and the meta tracker a visitor reads needs the
 * same rows a member does. Every write goes through a definer function in
 * 0133, because a catalogue is a thing one person maintains.
 */

export type EditionRow = {
  id: string;
  system_id: string;
  label: string;
  catalogue_version: string;
  status: string;
};

export type FactionRow = {
  edition_id: string;
  id: string;
  label: string;
  position: number;
};

export type DetachmentRow = {
  id: number;
  faction_id: string;
  slug: string;
  label: string;
  dispositions: string[];
  position: number;
};

export type UnitRow = {
  id: number;
  faction_id: string;
  name: string;
  base_points: number;
  options: unknown[];
  copy_cost_rules: unknown[];
  position: number;
};

export async function findActiveEdition() {
  const query = await table<EditionRow>("army_editions");
  const { data, error } = await query
    .select("id, system_id, label, catalogue_version, status")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Which (edition, version) pairs have actually been frozen.
 *
 * `army_editions.status` cannot answer it: starting a draft moves the version
 * and leaves the status alone, so an active edition is routinely sitting on a
 * version nobody has published.
 */
export async function findPublishedVersions() {
  const query = await table<{ edition_id: string; catalogue_version: string }>(
    "army_catalogue_snapshots");
  const { data, error } = await query
    .select("edition_id, catalogue_version");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Whatever an admin is editing, which may be a draft nobody has published. */
export async function findEditions() {
  const query = await table<EditionRow>("army_editions");
  const { data, error } = await query
    .select("id, system_id, label, catalogue_version, status")
    .order("status", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Every faction with its counts.
 *
 * Thirty rows, so this is one read rather than a paged one: the counts come
 * back as PostgREST aggregates, which is one index scan per faction and not
 * sixty round trips.
 */
export async function findFactionsWithCounts(edition: string) {
  const query = await table<FactionRow & {
    army_detachments: { count: number }[];
    army_units: { count: number }[];
  }>("army_factions");
  const { data, error } = await query
    .select("edition_id, id, label, position, army_detachments(count), army_units(count)")
    .eq("edition_id", edition)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function findDetachments(edition: string, faction: string) {
  const query = await table<DetachmentRow>("army_detachments");
  const { data, error } = await query
    .select("id, faction_id, slug, label, dispositions, position")
    .eq("edition_id", edition)
    .eq("faction_id", faction)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * A page of one faction's units.
 *
 * 1409 units across the catalogue and up to a couple of hundred in one
 * faction, so this pages and searches in SQL with an exact count. Never a
 * client-side sort of a faction's units.
 */
export async function findUnitsPage(params: {
  edition: string; faction: string; query: string; limit: number; offset: number;
}) {
  const query = await table<UnitRow>("army_units");
  let chain = query
    .select("id, faction_id, name, base_points, options, copy_cost_rules, position",
            { count: "exact" })
    .eq("edition_id", params.edition)
    .eq("faction_id", params.faction);

  if (params.query.trim()) chain = chain.ilike("name", `%${params.query.trim()}%`);

  const { data, error, count } = await chain
    .order("position", { ascending: true })
    .range(params.offset, params.offset + params.limit - 1);

  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0 };
}

/**
 * A published snapshot, read without a session.
 *
 * `unstable_cache` cannot contain `cookies()` and the server client reads them,
 * which is the trap 0104 documents: a cached read that throws falls back to an
 * empty row and the page shows a plausible lie. A snapshot is the same bytes
 * for everybody, so it uses the anon client and RLS still applies.
 */
export async function findSnapshot(edition: string, version: string) {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("army_catalogue_snapshots")
    .select("catalogue")
    .eq("edition_id", edition)
    .eq("catalogue_version", version)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { catalogue: unknown } | null)?.catalogue ?? null;
}

export const saveFaction = (params: {
  edition: string; id: string; label: string; position: number;
}) => callRpc<string>("save_army_faction", {
  p_edition: params.edition, p_id: params.id,
  p_label: params.label, p_position: params.position,
});

export const saveDetachment = (params: {
  edition: string; faction: string; slug: string; label: string;
  dispositions: string[]; position: number;
}) => callRpc<number>("save_army_detachment", {
  p_edition: params.edition, p_faction: params.faction, p_slug: params.slug,
  p_label: params.label, p_dispositions: params.dispositions,
  p_position: params.position,
});

export const saveUnit = (params: {
  edition: string; faction: string; name: string; points: number;
  options: unknown[]; rules: unknown[]; position: number;
}) => callRpc<number>("save_army_unit", {
  p_edition: params.edition, p_faction: params.faction, p_name: params.name,
  p_points: params.points, p_options: params.options, p_rules: params.rules,
  p_position: params.position,
});

export const deleteUnit = (edition: string, unit: number) =>
  callRpc<boolean>("delete_army_unit", { p_edition: edition, p_unit: unit });

export const publishCatalogue = (edition: string, note: string) =>
  callRpc<string>("publish_army_catalogue", { p_edition: edition, p_note: note });

export const startDraft = (edition: string, version: string) =>
  callRpc<string>("start_army_catalogue_draft", { p_edition: edition, p_version: version });

export const saveBuilderSettings = (club: number, enabled: boolean, edition: string | null) =>
  callRpc<boolean>("save_army_builder_settings",
    { p_club: club, p_enabled: enabled, p_edition: edition });

export const findBuilderFor = (club: number) =>
  callRpc<{ enabled: boolean; edition_id: string | null; catalogue_version: string | null }[]>(
    "army_builder_for", { p_club: club });
