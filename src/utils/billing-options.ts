/**
 * How a membership tier can be paid for.
 *
 * A tier is not one price. Legacy gives every tier a list of billing options
 * (`_normalise_membership_billing_options`, club_store.py:13854) so a club can
 * sell the same membership monthly, yearly and as a one-off, and Didcot's own
 * data has exactly that. The column has been here since 0008 and the editor
 * carried it through as a hidden field it could not change, so an owner could
 * only ever set one price and the club's real prices were whatever the import
 * had put there.
 *
 * **The headline price is the first option, never typed separately.** That is
 * legacy's rule (`primary_billing_option`, 13811) and it is the whole answer to
 * the client's "it does not align": a tier whose own price is independent of
 * its payment options is a tier that can disagree with itself.
 *
 * Pure. The write side lives here; `membership-billing.ts` reads the same jsonb
 * for display and deliberately filters harder, because a half-finished option
 * must be editable without being offered to a member.
 */

export const CADENCES = [
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
  { value: "one-off", label: "One-off" },
] as const;

export type Cadence = (typeof CADENCES)[number]["value"];

/** One row of the editor. `id` rides along so an untouched option keeps it. */
export type OptionRow = { id: string; label: string; price: string; cadence: string };

/** What goes into the jsonb column, in legacy's shape, key for key. */
export type StoredOption = {
  id: string;
  label: string;
  price: string;
  priceDuration: string;
  cadence: string;
  position: number;
};

/**
 * Legacy accepts eight spellings and answers with three
 * (`_normalise_membership_price_duration`, 13836). Anything else is "", which
 * is how a club says "ask us".
 */
export function cadenceOf(raw: unknown): string {
  const value = String(raw ?? "").trim().toLowerCase();
  if (["month", "monthly", "per-month", "per_month"].includes(value)) return "month";
  if (["year", "yearly", "annual", "annually", "per-year", "per_year"].includes(value)) {
    return "year";
  }
  if (["one-off", "oneoff", "one_off", "once"].includes(value)) return "one-off";
  return "";
}

/** A typed label wins; otherwise the cadence names itself. */
export function cadenceLabel(cadence: string, typed = ""): string {
  const said = typed.trim();
  if (said) return said;
  const found = CADENCES.find((one) => one.value === cadenceOf(cadence));
  return found ? found.label : "Offline payment";
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * The editor's rows, ready for the column.
 *
 * An option with neither a price nor a cadence is dropped rather than refused,
 * which is what lets somebody press Add and then change their mind. Ids follow
 * legacy: the one that was there, else `<tier>-<cadence>`, deduped by position.
 */
export function normaliseOptions(
  raw: unknown, tierKey: string, fallbackPrice = "", fallbackDuration = "",
): StoredOption[] {
  const rows = Array.isArray(raw) ? raw : [];
  const options: StoredOption[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    if (!row || typeof row !== "object") return;
    const held = row as Record<string, unknown>;
    const cadence = cadenceOf(held.cadence ?? held.priceDuration ?? held.duration);
    const price = text(held.price);
    if (!price && !cadence) return;

    const label = cadenceLabel(cadence, text(held.label));
    let id = text(held.id) || (cadence ? `${tierKey}-${cadence}` : "")
      || `${tierKey}-billing-${index + 1}`;
    if (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);

    options.push({
      id, label, price, priceDuration: cadence, cadence,
      position: options.length + 1,
    });
  });

  // An older club carries a bare price and no list. Legacy synthesises one
  // rather than leaving the tier free, which it is not.
  if (!options.length && fallbackPrice.trim()) {
    const cadence = cadenceOf(fallbackDuration);
    options.push({
      id: cadence ? `${tierKey}-${cadence}` : `${tierKey}-offline`,
      label: cadenceLabel(cadence),
      price: fallbackPrice.trim(),
      priceDuration: cadence,
      cadence,
      position: 1,
    });
  }

  return options;
}

/**
 * The tier's own headline, which is the first option.
 *
 * Both columns move together or neither does: `price` without
 * `price_duration` is what printed "Life Member · £120" beside a payment list
 * that said £15 a month.
 */
export function headlineOf(
  options: StoredOption[], fallbackPrice = "", fallbackDuration = "",
): { price: string; price_duration: string } {
  const first = options[0];
  if (!first) {
    return { price: fallbackPrice.trim(), price_duration: cadenceOf(fallbackDuration) };
  }
  return { price: first.price, price_duration: first.priceDuration };
}

/**
 * The stored jsonb read back into editor rows.
 *
 * Seeded from the bare price when the tier has no list, so a club that has only
 * ever had one price sees it in the new editor rather than an empty box over
 * the top of it.
 */
export function optionRows(raw: unknown, price = "", duration = ""): OptionRow[] {
  const rows = Array.isArray(raw) ? raw : [];
  const read = rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      id: text(row.id),
      label: text(row.label),
      price: text(row.price),
      cadence: cadenceOf(row.cadence ?? row.priceDuration ?? row.duration),
    }));

  if (read.length) return read;
  if (!price.trim()) return [];
  return [{ id: "", label: "", price: price.trim(), cadence: cadenceOf(duration) }];
}

/**
 * What the club page will say, so the owner can see the derived headline rather
 * than wondering which of three prices leads.
 */
export function headlineLine(rows: OptionRow[]): string {
  const live = rows.filter((row) => row.price.trim() || row.cadence);
  if (!live.length) return "No fee, so there is nothing to record against it.";

  const first = live[0]!;
  const price = first.price.trim();
  if (!price) return "Add a price and your club page will show it.";

  const shown = /^[\d.]+$/.test(price) ? `£${price}` : price;
  const cadence = cadenceOf(first.cadence);
  const tail = cadence === "month" ? " a month"
    : cadence === "year" ? " a year"
      : cadence === "one-off" ? ", one-off" : "";
  // The noun and the verb both have to move. "2 other ways to pay sits under
  // it" went in front of the client, which is the stage 5 singular slip from
  // the other end: pluralising half a sentence.
  const more = live.length - 1;
  const others = more === 0 ? ""
    : more === 1 ? " 1 other way to pay sits under it."
      : ` ${more} other ways to pay sit under it.`;
  return `Your club page leads with ${shown}${tail}.${others}`;
}
