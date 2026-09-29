"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubDetail } from "@/services/clubDetail.service";
import * as lists from "@/services/armyLists.service";

export type SaveDraft = {
  listId: number | null;
  slug: string;
  name: string;
  listType: "army-list" | "collection";
  pointsLimit: string;
  factionId: string;
  factionLabel: string;
  detachments: { detachment: string; disposition: string }[];
  units: { unitName: string; optionLabel?: string; quantity: number }[];
};

/**
 * Save a draft.
 *
 * Takes an object rather than FormData: the wizard holds a shape, and posting
 * a shape through a form means one hidden field holding JSON, which is what
 * the result dialog already has to do and is not worth repeating where there
 * is no form. Everything it decides on is re-decided in SQL, so what arrives
 * here is a claim and not a fact.
 */
export async function saveArmyList(draft: SaveDraft) {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to access the army builder." };

  const club = await getClubDetail(draft.slug);
  if (!club) return { error: "That club is not here any more." };

  const result = await lists.saveList({
    listId: draft.listId, club: club.id, viewer: viewer.id,
    draft: {
      name: draft.name, listType: draft.listType, pointsLimit: draft.pointsLimit,
      factionId: draft.factionId, factionLabel: draft.factionLabel,
      detachments: draft.detachments, units: draft.units,
    },
  });
  if (!result.ok) return { error: result.error };

  revalidatePath(`/clubs/${draft.slug}/army-builder`);
  revalidatePath(`/clubs/${draft.slug}/army-builder/${result.listId}`);
  revalidatePath("/account/armies");
  return { notice: result.notice, listId: result.listId };
}

export async function deleteArmyList(slug: string, listId: number) {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to access the army builder." };

  const result = await lists.removeList(listId);
  if (!result.ok) return { error: result.notice };

  revalidatePath(`/clubs/${slug}/army-builder`);
  revalidatePath("/account/armies");
  return { notice: result.notice };
}
