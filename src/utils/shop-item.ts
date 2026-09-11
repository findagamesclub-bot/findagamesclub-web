/**
 * What a shop item is allowed to be.
 *
 * Legacy edits these as a row inside the listing editor and drops anything it
 * does not like without saying so (`_normalise_merchandise_items`,
 * club_store.py:13939). The rules are the same; the silence is not, because a
 * club that types a name too long should be told rather than left wondering
 * where its shirt went.
 */

export type ItemDraft = {
  name: string;
  category: string;
  description: string;
  price: string;
  imageSrc: string;
  imageAlt: string;
  minimumTierKey: string;
};

export const MAX_ITEM_NAME = 80;
export const MAX_ITEM_CATEGORY = 40;
export const MAX_ITEM_PRICE = 40;
export const MAX_ITEM_DESCRIPTION = 400;

/** Legacy's own slug, character for character (export-legacy-data.py:30). */
export function slugifyItem(value: string): string {
  return (value || "").trim().toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A key no other item at this club is using.
 *
 * `(club_id, legacy_id)` is unique, so two items called the same thing need
 * telling apart. A name of only punctuation slugifies to nothing, which is why
 * there is a fallback rather than an empty key.
 */
export function uniqueItemSlug(name: string, taken: string[]): string {
  const base = slugifyItem(name) || "item";
  const used = new Set(taken);
  if (!used.has(base)) return base;

  for (let n = 2; n < 500; n++) {
    const next = `${base}-${n}`;
    if (!used.has(next)) return next;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Legacy writes "TBC" for a price nobody has set, and the whole app already
 * reads that as "ask the club" rather than as free.
 */
export function tidyItemPrice(price: string): string {
  return price.trim() || "TBC";
}

/** Why this item cannot be saved, in words for the person who typed it. */
export function itemRefusal(draft: ItemDraft, tierKeys: string[]): string | null {
  const name = draft.name.trim();
  if (!name) return "Give the item a name.";
  if (name.length > MAX_ITEM_NAME) {
    return `Names are at most ${MAX_ITEM_NAME} characters.`;
  }
  if (draft.category.trim().length > MAX_ITEM_CATEGORY) {
    return `Categories are at most ${MAX_ITEM_CATEGORY} characters.`;
  }
  if (draft.price.trim().length > MAX_ITEM_PRICE) {
    return `Prices are at most ${MAX_ITEM_PRICE} characters.`;
  }
  if (draft.description.trim().length > MAX_ITEM_DESCRIPTION) {
    return `Descriptions are at most ${MAX_ITEM_DESCRIPTION} characters.`;
  }
  // An unknown tier would hide the item from everybody, including the tier the
  // club meant, and nothing on the page would say why.
  if (draft.minimumTierKey && !tierKeys.includes(draft.minimumTierKey)) {
    return "That membership tier is not one of yours any more.";
  }
  // A picture nobody can fetch is a broken image on the shop page.
  const image = draft.imageSrc.trim();
  if (image && !/^https?:\/\//i.test(image)) {
    return "An image address has to start with https://";
  }
  return null;
}
