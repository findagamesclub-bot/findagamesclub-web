/**
 * One disposition for a whole army, over several detachments.
 *
 * The client's words: *"Only one disposition should be selected overall, but
 * multiple detachments can be selected."* The builder asked for one per
 * detachment, so a list with three detachments could carry three, which is
 * not a thing the game allows.
 *
 * The stored shape does not change. `army_lists.payload` has held
 * `{ detachment, disposition }` per row since 0143, `army_list_canonical`
 * builds the version signature out of it by hand in SQL, and
 * `src/utils/__tests__/army-versions.test.ts` pins that string against the
 * one the database pins. Moving the disposition to a key of its own would
 * mean changing both readings of that signature in step, a migration and a
 * backfill, to store the same fact. So the one disposition is written onto
 * every row instead: the payload says the same thing it always did, and every
 * reader of it, here and in the Meta Tracker, goes on working untouched.
 */

export type DetachmentRow = { detachment: string; disposition: string };

/**
 * The army's disposition, or "" where it has none.
 *
 * The first row that carries one wins. They are all written together, so they
 * agree; a list saved before this change can carry several, and answering
 * with the first is better than answering with nothing on a list somebody is
 * halfway through editing.
 */
export function oneDisposition(rows: DetachmentRow[]): string {
  return rows.find((row) => row.disposition.trim())?.disposition ?? "";
}

/** Whether a list saved before this change carries more than one. */
export function mixedDispositions(rows: DetachmentRow[]): boolean {
  const held = new Set(
    rows.map((row) => row.disposition.trim()).filter(Boolean));
  return held.size > 1;
}

/**
 * Put one disposition on every detachment.
 *
 * Including the ones added after it was chosen, which is why the builder
 * calls this on both changes rather than only on the picker: a detachment
 * added at step three and left blank would otherwise be a row the rollups
 * count as having no disposition at all.
 */
export function withDisposition(
  rows: DetachmentRow[], disposition: string,
): DetachmentRow[] {
  return rows.map((row) => ({ ...row, disposition }));
}

/**
 * The disposition still on offer once the detachments have changed.
 *
 * Dropping a detachment can take the only detachment that offered the chosen
 * disposition with it, and a list left pointing at one nothing offers is a
 * list the picker cannot show and the database would refuse. Empty rather
 * than wrong: the step says what is missing and somebody picks again.
 */
export function heldDisposition(
  disposition: string, offered: string[],
): string {
  const fold = (value: string) => value.trim().toLowerCase();
  const clean = fold(disposition);
  if (!clean) return "";
  return offered.find((one) => fold(one) === clean) ?? "";
}
