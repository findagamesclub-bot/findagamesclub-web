import "server-only";

import * as repo from "@/repositories/armyLists.repository";
import { getBuilderFor } from "./armyBuilder.service";
import { getSnapshot } from "./armyCatalogue.service";
import { describeChange, type VersionShape } from "@/utils/army-diff";
import { armyRefusalFrom } from "./armyRefusals";
import type { ListLine } from "@/utils/army-list";
import type { ArmyList, ArmySaveResult, ArmyVersion } from "@/types/army";

export type { ArmyList, ArmyVersion } from "@/types/army";

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const toVersion = (row: repo.VersionRow): ArmyVersion => ({
  id: row.id,
  versionNumber: row.version_number,
  name: row.name,
  listType: row.list_type === "collection" ? "collection" : "army-list",
  factionId: row.faction_id,
  factionLabel: row.faction_label || row.faction_id,
  detachments: asArray<{ detachment: string; disposition: string }>(row.detachment_selections),
  units: asArray<ListLine>(row.units),
  pointsLimit: row.points_limit,
  totalPoints: Number(row.total_points) || 0,
  catalogueVersion: row.catalogue_version,
  changeSummary: row.change_summary,
  createdAt: row.created_at,
});

function assemble(
  lists: repo.ListRow[], versions: repo.VersionRow[], viewer: string,
): ArmyList[] {
  const byList = new Map<number, repo.VersionRow[]>();
  for (const row of versions) {
    byList.set(row.list_id, [...(byList.get(row.list_id) ?? []), row]);
  }
  return lists.map((row) => {
    const mine = byList.get(row.id) ?? [];
    const current = mine.find((v) => v.id === row.current_version_id) ?? mine[0];
    return {
      id: row.id,
      clubId: row.club_id,
      profileId: row.profile_id,
      name: row.name,
      listType: row.list_type === "collection" ? "collection" : "army-list",
      factionLabel: row.faction_label || row.faction_id,
      pointsLimit: row.points_limit,
      updatedAt: row.updated_at,
      isOwner: row.profile_id === viewer,
      current: current ? toVersion(current) : null,
      versionCount: mine.length,
      clubSlug: row.club?.slug ?? "",
      clubName: row.club?.name ?? "",
    };
  });
}

/**
 * Every list at a club, the reader's own first.
 *
 * Legacy's own order (`list_visible_army_lists`, club_store.py:6825): yours
 * newest first, then everybody else's newest first. Two reads, not one per
 * list: the versions the cards need come back in a single query.
 */
export async function getClubLists(club: number, viewer: string): Promise<ArmyList[]> {
  const lists = await repo.findClubLists(club).catch(() => []);
  const versions = await repo.findVersionsFor(lists.map((l) => l.id)).catch(() => []);
  const all = assemble(lists, versions, viewer);
  return [...all.filter((l) => l.isOwner), ...all.filter((l) => !l.isOwner)];
}

/** One person's lists, across every club they belong to. */
export async function getMyLists(viewer: string): Promise<ArmyList[]> {
  const lists = await repo.findMyLists(viewer).catch(() => []);
  const versions = await repo.findVersionsFor(lists.map((l) => l.id)).catch(() => []);
  return assemble(lists, versions, viewer);
}

/** One list with every version it has had, newest first. */
export async function getList(id: number, viewer: string) {
  const row = await repo.findList(id).catch(() => null);
  if (!row) return null;
  const versions = await repo.findVersionsFor([id]).catch(() => []);
  const [list] = assemble([row], versions, viewer);
  return { list, versions: versions.map(toVersion) };
}

const shapeOf = (version: ArmyVersion | null): VersionShape | null =>
  version
    ? {
        factionLabel: version.factionLabel,
        detachment: version.detachments[0]?.detachment ?? "",
        disposition: version.detachments[0]?.disposition ?? "",
        pointsLimit: version.pointsLimit,
        units: version.units,
      }
    : null;

/**
 * Save a draft, and say which of the two things happened.
 *
 * The change summary is written here rather than in SQL because the wording is
 * legacy's and lives in one tested place (`army-diff.ts`). The database still
 * decides whether a version happens at all, by comparing signatures, so a
 * caller cannot talk it into one.
 */
export async function saveList(params: {
  listId: number | null;
  club: number;
  viewer: string;
  draft: {
    name: string;
    listType: "army-list" | "collection";
    pointsLimit: string;
    factionId: string;
    factionLabel: string;
    detachments: { detachment: string; disposition: string }[];
    units: { unitName: string; optionLabel?: string; quantity: number }[];
  };
}): Promise<ArmySaveResult> {
  try {
    let summary = "";
    if (params.listId) {
      const held = await getList(params.listId, params.viewer);
      const previous = shapeOf(held?.list.current ?? null);
      summary = describeChange(previous, {
        factionLabel: params.draft.factionLabel,
        detachment: params.draft.detachments[0]?.detachment ?? "",
        disposition: params.draft.detachments[0]?.disposition ?? "",
        pointsLimit: params.draft.pointsLimit,
        // Quantities are what the diff reads, and the database re-prices
        // anyway, so the draft's own lines are enough to describe the change.
        units: params.draft.units.map((one) => ({
          unitName: one.unitName,
          optionLabel: one.optionLabel ?? "Default",
          quantity: one.quantity,
        })),
      });
    }

    const out = await repo.saveList(params.listId, params.club, params.draft, summary);
    return {
      ok: true,
      listId: out.listId,
      versionNumber: out.versionNumber,
      notice: out.createdVersion
        ? `Saved as v${out.versionNumber}${
            out.versionNumber > 1 && summary ? ` · ${summary}` : ""}`
        : "Saved. Nothing changed, so no new version.",
    };
  } catch (error) {
    return { ok: false, error: armyRefusalFrom(error) };
  }
}

export async function removeList(id: number): Promise<{ ok: boolean; notice: string }> {
  try {
    await repo.removeList(id);
    return { ok: true, notice: "That list is gone." };
  } catch (error) {
    return { ok: false, notice: armyRefusalFrom(error) };
  }
}

/** What a club builds against, or null when it does not build at all. */
export async function getBuildContext(club: number) {
  const builder = await getBuilderFor(club);
  if (!builder.enabled || !builder.editionId || !builder.catalogueVersion) return null;
  const catalogue = await getSnapshot(builder.editionId, builder.catalogueVersion);
  return catalogue ? { ...builder, catalogue } : null;
}
