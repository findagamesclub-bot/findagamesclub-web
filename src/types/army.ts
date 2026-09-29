import type { ListLine } from "@/utils/army-list";

/** One saved state of a list. Immutable once a later one exists. */
export type ArmyVersion = {
  id: number;
  versionNumber: number;
  name: string;
  listType: "army-list" | "collection";
  factionId: string;
  factionLabel: string;
  detachments: { detachment: string; disposition: string }[];
  units: ListLine[];
  pointsLimit: string;
  totalPoints: number;
  catalogueVersion: string;
  changeSummary: string;
  createdAt: string;
};

/** A list as a card or a page reads it, with its current version folded in. */
export type ArmyList = {
  id: number;
  clubId: number;
  profileId: string;
  name: string;
  listType: "army-list" | "collection";
  factionLabel: string;
  pointsLimit: string;
  updatedAt: string;
  isOwner: boolean;
  current: ArmyVersion | null;
  versionCount: number;
  /** Only filled in by the account hub's read, which spans clubs. */
  clubSlug: string;
  clubName: string;
};

export type ArmySaveResult =
  | { ok: true; notice: string; listId: number; versionNumber: number }
  | { ok: false; error: string };
