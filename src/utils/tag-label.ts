/**
 * A stored tag, as a reader should see it.
 *
 * Event types arrive as slugs the club never typed — "tournament", "social" —
 * while formats and game names arrive as somebody wrote them, "Wargaming" and
 * "Warhammer 40,000". Title-casing everything would turn the second group into
 * "Warhammer 40,000" at best and mangle it at worst, so a value that already
 * carries a capital is left exactly as it is.
 */
export function tagLabel(value: string): string {
  const clean = value.trim();
  if (!clean) return "";
  // Somebody has already made a decision about this string. Respect it.
  if (/[A-Z]/.test(clean)) return clean;

  return clean.replace(/(^|[\s\-/])([a-z])/g, (_m, lead: string, letter: string) =>
    lead + letter.toUpperCase());
}
