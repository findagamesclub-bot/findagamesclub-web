"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import * as repo from "@/repositories/shopEditor.repository";
import { sizesRefusal } from "@/utils/shop-sizes";
import { itemRefusal, tidyItemPrice, uniqueItemSlug } from "@/utils/shop-item";

export type ShopEditState = { error?: string; notice?: string };

/**
 * The sizes on one item.
 *
 * Sizes rather than the item itself: adding a shirt is a different job with a
 * picture and a price, and the thing a club does weekly is count what is left.
 */
export async function saveSizesAction(
  _prev: ShopEditState, data: FormData,
): Promise<ShopEditState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const slug = String(data.get("slug") ?? "");
  const club = slug ? await getClubDetail(slug) : null;
  if (!club) return { error: "That club is not here any more." };

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("shop.manage")) {
    return { error: "You do not have permission to change this." };
  }

  const itemId = Number(data.get("itemId"));
  if (!Number.isFinite(itemId)) return { error: "Something went wrong. Reload and try again." };

  const at = (key: string, index: number) => String(data.getAll(key)[index] ?? "").trim();
  const rows = data.getAll("sizeLabel").map((_, index) => ({
    id: Number(at("sizeId", index)) || null,
    label: at("sizeLabel", index),
    stock: Math.max(0, Math.floor(Number(at("sizeStock", index)) || 0)),
    active: data.getAll("sizeActive")[index] === "yes",
    position: index,
  }));

  // A size typed into the add boxes and never added. Losing it because
  // somebody pressed Save instead of Enter would be the form's fault.
  const pending = String(data.get("newSizeLabel") ?? "").trim();
  if (pending) {
    rows.push({
      id: null, label: pending,
      stock: Math.max(0, Math.floor(Number(data.get("newSizeStock")) || 0)),
      active: true, position: rows.length,
    });
  }

  // The same rules the browser runs. It is the browser that is optional here:
  // the form posts to an endpoint anybody with an account can reach.
  const refusal = sizesRefusal(rows);
  if (refusal) return { error: refusal };

  const dropped = data.getAll("droppedSizeId")
    .map((id) => Number(String(id)))
    .filter((id) => Number.isFinite(id) && id > 0);

  try {
    // Dropped first, so removing "M" and adding a fresh "M" in the same save
    // cannot collide, and so the stock trigger settles once at the end.
    await repo.removeSizes(itemId, dropped);
    await repo.saveSizes(rows.filter((row): row is typeof row & { id: number } =>
      row.id !== null));
    await repo.addSizes(itemId, rows.filter((row) => row.id === null));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[shop] sizes did not save:", message);

    // Sizes are unique per item, and the rows are updated one at a time, so
    // two swapping names collide halfway through.
    if (message.includes("club_merchandise_variants_one_label") || message.includes("23505")) {
      return { error: "Two sizes cannot swap names in one save. "
        + "Rename one, save, then rename the other." };
    }
    // In development the cause goes on screen as well as in the log.
    const detail = process.env.NODE_ENV === "development" ? ` [${message}]` : "";
    return { error: `That did not save. Try again.${detail}` };
  }

  revalidatePath(`/clubs/${slug}/shop`);
  revalidatePath(`/clubs/${slug}/manage/shop`);
  return { notice: "Saved." };
}

/** Everything about an item except its sizes, which have their own form. */
export async function saveItemAction(
  _prev: ShopEditState, data: FormData,
): Promise<ShopEditState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const slug = String(data.get("slug") ?? "");
  const club = slug ? await getClubDetail(slug) : null;
  if (!club) return { error: "That club is not here any more." };

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("shop.manage")) {
    return { error: "You do not have permission to change this." };
  }

  const text = (key: string) => String(data.get(key) ?? "").trim();
  const draft = {
    name: text("name"),
    category: text("category"),
    description: text("description"),
    price: text("price"),
    imageSrc: text("imageSrc"),
    imageAlt: text("imageAlt"),
    minimumTierKey: text("minimumTierKey"),
  };

  // The same rules the dialog runs. The browser's copy is the courtesy; this
  // one is the rule, because the form posts to an endpoint any account reaches.
  const refusal = itemRefusal(draft, club.membershipTiers.map((tier) => tier.key));
  if (refusal) return { error: refusal };

  const fields = {
    name: draft.name,
    category: draft.category,
    description: draft.description,
    image_src: draft.imageSrc || null,
    // An alt of nothing on a picture that exists is a photo a screen reader
    // cannot describe, so the name stands in.
    image_alt: draft.imageSrc ? (draft.imageAlt || draft.name) : null,
    price: tidyItemPrice(draft.price),
    minimum_tier_key: draft.minimumTierKey || null,
    active: String(data.get("active") ?? "") === "yes",
  };

  const itemId = Number(data.get("itemId")) || null;

  try {
    if (itemId) {
      await repo.updateItem(club.id, itemId, fields);
    } else {
      const taken = await repo.findItemSlugs(club.id);
      await repo.createItem(club.id, uniqueItemSlug(draft.name, taken), taken.length, fields);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[shop] item did not save:", message);
    const detail = process.env.NODE_ENV === "development" ? ` [${message}]` : "";
    return { error: `That did not save. Try again.${detail}` };
  }

  revalidatePath(`/clubs/${slug}/shop`);
  revalidatePath(`/clubs/${slug}/manage/shop`);
  return { notice: itemId ? "Saved." : `${draft.name} is in your shop.` };
}

export async function deleteItemAction(
  _prev: ShopEditState, data: FormData,
): Promise<ShopEditState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const slug = String(data.get("slug") ?? "");
  const club = slug ? await getClubDetail(slug) : null;
  if (!club) return { error: "That club is not here any more." };

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("shop.manage")) {
    return { error: "You do not have permission to change this." };
  }

  const itemId = Number(data.get("itemId"));
  if (!Number.isFinite(itemId)) return { error: "That item is already gone." };

  try {
    await repo.deleteItem(club.id, itemId);
  } catch (error) {
    console.error("[shop] item did not delete:", error);
    return { error: "That did not delete. Try again." };
  }

  revalidatePath(`/clubs/${slug}/shop`);
  revalidatePath(`/clubs/${slug}/manage/shop`);
  return { notice: "Removed from your shop." };
}
