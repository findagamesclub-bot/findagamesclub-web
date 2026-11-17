/**
 * Drop any suggestion naming a unit the catalogue does not have.
 *
 * Folded on both sides, because a model that gets the unit right often gets
 * its capitalisation wrong, and refusing "castigator" for a catalogue holding
 * "Castigator" would throw away a good suggestion.
 *
 * A suggestion often names a CHOICE rather than one unit:
 *
 *     "Mortifiers / Paragon Warsuits / Immolator (choose based on availability)"
 *     "Dialogus / Ministorum Priest / Imagifier"
 *
 * Matching that whole string against the catalogue never hits, so every one of
 * them was thrown away and the card said "3 suggestions named units this
 * catalogue does not have" about units that were all in it. That is the
 * client's item 7, and from their side it read as the coach not recognising
 * its own catalogue.
 *
 * So a name is read as the list of alternatives it is, and the suggestion is
 * kept when EVERY alternative exists. Every one, not any one: the whole point
 * of this check is that a model told three times not to invent units invents
 * units, and a choice between two real units and one made-up one still puts a
 * made-up one in front of somebody.
 */

/** "Immolator (choose based on availability)" is one unit and an aside. */
const ASIDE = /\s*\([^)]*\)\s*$/;

/**
 * The units a suggestion names.
 *
 * The whole string first, so a catalogue entry that genuinely contains a
 * slash still matches itself before anything is split.
 */
export function namedUnits(name: string, known: Set<string>): string[] {
  const whole = name.trim();
  if (!whole) return [];
  if (known.has(whole.toLowerCase())) return [whole];

  const withoutAside = whole.replace(ASIDE, "").trim();
  if (withoutAside && known.has(withoutAside.toLowerCase())) return [withoutAside];

  return withoutAside
    .split("/")
    .map((one) => one.replace(ASIDE, "").trim())
    .filter(Boolean);
}

export function pruneUnknownUnits(
  value: unknown, knownUnits: string[],
): { json: unknown; dropped: string[] } {
  const known = new Set(knownUnits.map((one) => one.trim().toLowerCase()));
  if (!known.size || !value || typeof value !== "object") {
    return { json: value, dropped: [] };
  }

  const body = value as Record<string, unknown>;
  const suggestions = body.unitChangeSuggestions;
  if (!Array.isArray(suggestions)) return { json: value, dropped: [] };

  const dropped: string[] = [];
  const kept = suggestions.filter((one) => {
    const name = String((one as { unitName?: unknown })?.unitName ?? "").trim();
    if (!name) return true;

    const parts = namedUnits(name, known);
    // Nothing recognisable in it at all. Keeping it would be keeping a name
    // the catalogue has never heard of, which is what this exists to stop.
    if (!parts.length) {
      dropped.push(name);
      return false;
    }
    if (parts.every((part) => known.has(part.toLowerCase()))) return true;

    dropped.push(name);
    return false;
  });

  return { json: { ...body, unitChangeSuggestions: kept }, dropped };
}
