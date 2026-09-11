/**
 * What a club's list of sizes is allowed to be.
 *
 * A size with no name is the item itself, which is what every item had before
 * sizes existed. That only makes sense on its own: the shop's picker offers
 * named sizes only, so an unnamed size sitting beside S, M and L is stock
 * counted in the item's total that nobody can ever buy.
 *
 * Pure, because the same answer has to reach the browser as you type and the
 * server action that actually writes.
 */

export type SizeDraft = { label: string };

/** The longest a size name can be. "Extra extra large" fits; a sentence does not. */
export const MAX_SIZE_LABEL = 24;

export const sameSize = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** Why this list cannot be saved, in words for the person who typed it. */
export function sizesRefusal(rows: SizeDraft[]): string | null {
  if (!rows.length) {
    return "An item needs at least one size. Leave one unnamed if it does not come in sizes.";
  }

  const named = rows.filter((row) => row.label.trim());
  const unnamed = rows.length - named.length;

  if (unnamed > 0 && rows.length > 1) {
    return "Only an item with one size can leave it unnamed. Name every size, "
      + "or remove the unnamed one.";
  }

  const tooLong = named.find((row) => row.label.trim().length > MAX_SIZE_LABEL);
  if (tooLong) {
    return `Size names are at most ${MAX_SIZE_LABEL} characters, and `
      + `"${tooLong.label.trim()}" is longer.`;
  }

  const seen = new Set<string>();
  for (const row of named) {
    const key = row.label.trim().toLowerCase();
    if (seen.has(key)) return `You have two sizes called "${row.label.trim()}".`;
    seen.add(key);
  }

  return null;
}

/** Why this new name cannot be added to what is already there. */
export function addRefusal(rows: SizeDraft[], label: string): string | null {
  const clean = label.trim();
  if (!clean) return null;

  if (clean.length > MAX_SIZE_LABEL) {
    return `Size names are at most ${MAX_SIZE_LABEL} characters.`;
  }
  if (rows.some((row) => sameSize(row.label, clean))) {
    return `You already have a size called "${clean}".`;
  }
  return null;
}
