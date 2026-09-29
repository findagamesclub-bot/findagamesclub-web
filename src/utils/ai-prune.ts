/**
 * Drop any suggestion naming a unit the catalogue does not have.
 *
 * Folded on both sides, because a model that gets the unit right often gets
 * its capitalisation wrong, and refusing "castigator" for a catalogue holding
 * "Castigator" would throw away a good suggestion.
 */
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
    if (known.has(name.toLowerCase())) return true;
    dropped.push(name);
    return false;
  });

  return { json: { ...body, unitChangeSuggestions: kept }, dropped };
}
