import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The club's own view of its shop: every item including retired ones, and
 * every size including the ones that are out.
 *
 * Separate from `findMerchandise`, which is what members see and deliberately
 * hides both.
 */
export type EditableItem = {
  id: number;
  name: string;
  category: string;
  description: string;
  price: string;
  minimumTierKey: string;
  active: boolean;
  /** What it looks like. The console counts stock, but not from memory. */
  image: { src: string; alt: string } | null;
  sizes: { id: number; label: string; stock: number; active: boolean }[];
};

export async function findEditableShop(clubId: number): Promise<EditableItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_merchandise_items")
    .select(`id, name, category, description, price, minimum_tier_key, active, position,
             image_src, image_alt,
             club_merchandise_variants(id, label, stock, active, position)`)
    .eq("club_id", clubId)
    .order("position");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name ?? "",
    category: row.category ?? "",
    description: row.description ?? "",
    price: row.price ?? "",
    minimumTierKey: row.minimum_tier_key ?? "",
    active: row.active,
    image: row.image_src ? { src: row.image_src, alt: row.image_alt ?? "" } : null,
    sizes: (row.club_merchandise_variants ?? [])
      .sort((a, b) => a.position - b.position)
      .map((v) => ({ id: v.id, label: v.label ?? "", stock: v.stock, active: v.active })),
  }));
}

/** The keys already taken at this club, so a new item can pick a free one. */
export async function findItemSlugs(clubId: number): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_merchandise_items").select("legacy_id, position").eq("club_id", clubId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.legacy_id);
}

export type ItemFields = {
  name: string; category: string; description: string;
  image_src: string | null; image_alt: string | null;
  price: string; minimum_tier_key: string | null; active: boolean;
};

/**
 * A new item.
 *
 * `stock` is not named: it is the sum of the item's sizes, and the trigger in
 * 0088 gives every new item one unnamed size so it is sellable from the moment
 * it exists.
 */
export async function createItem(
  clubId: number, legacyId: string, position: number, fields: ItemFields,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("club_merchandise_items")
    .insert({ club_id: clubId, legacy_id: legacyId, position, ...fields });
  if (error) throw new Error(error.message);
}

export async function updateItem(clubId: number, itemId: number, fields: ItemFields) {
  const supabase = await createClient();
  // Pinned to the club as well as the id. The policy says the same thing; this
  // is the half that does not depend on getting the policy right.
  const { error } = await supabase
    .from("club_merchandise_items")
    .update(fields).eq("id", itemId).eq("club_id", clubId);
  if (error) throw new Error(error.message);
}

/**
 * An item the club has taken off its shop for good.
 *
 * Order lines point at it with `on delete set null` and carry their own copy of
 * the name and the price, so somebody's old order still reads correctly.
 */
export async function deleteItem(clubId: number, itemId: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("club_merchandise_items").delete().eq("id", itemId).eq("club_id", clubId);
  if (error) throw new Error(error.message);
}

/** Change what a size is called and how many are left. */
export async function saveSizes(rows: {
  id: number; label: string; stock: number; active: boolean; position: number;
}[]) {
  const supabase = await createClient();
  for (const row of rows) {
    const { error } = await supabase
      .from("club_merchandise_variants")
      .update({ label: row.label, stock: row.stock, active: row.active, position: row.position })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
  }
}

/** Sizes an item has just gained. */
export async function addSizes(itemId: number, rows: {
  label: string; stock: number; active: boolean; position: number;
}[]) {
  if (!rows.length) return;
  const supabase = await createClient();
  // Named column by column rather than spread: the caller's rows carry an
  // `id: null` for "not saved yet", and `id` is generated always, so sending
  // it refuses the whole insert.
  const { error } = await supabase
    .from("club_merchandise_variants")
    .insert(rows.map((row) => ({
      item_id: itemId,
      label: row.label,
      stock: row.stock,
      active: row.active,
      position: row.position,
    })));
  if (error) throw new Error(error.message);
}

/**
 * Sizes the club has taken off an item.
 *
 * Order lines point at the variant with `on delete set null` and carry their
 * own copy of the label, so a size that has been sold can still be removed and
 * the order still says what was bought.
 */
export async function removeSizes(itemId: number, ids: number[]) {
  if (!ids.length) return;
  const supabase = await createClient();
  for (const id of ids) {
    // Pinned to the item as well as the id. The policy already stops another
    // club's sizes; this stops one card removing a size off another card.
    const { error } = await supabase
      .from("club_merchandise_variants").delete().eq("id", id).eq("item_id", itemId);
    if (error) throw new Error(error.message);
  }
}
