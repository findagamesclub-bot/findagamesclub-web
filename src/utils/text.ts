/**
 * Text normalisation shared by the query parser and the search itself.
 *
 * Lived only in the parser at first, so the two layers disagreed: the parser
 * understood that "Wi-Fi" and "wifi" are the same word while the service
 * compared raw lowercased strings. Anything relying on an accent or a hyphen
 * matched in one place and not the other.
 */

/** Lowercase, accents removed, hyphens closed up, everything else to spaces. */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’-]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Padded with spaces so `includes` can only match whole words. */
export function padded(value: string): string {
  return ` ${fold(value)} `;
}
