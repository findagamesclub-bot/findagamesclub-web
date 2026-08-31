/**
 * Search terms going into a PostgREST `or=` filter.
 *
 * The filter is parsed as text, so a comma or a bracket in what somebody typed
 * ends the condition early and the query either errors or quietly matches the
 * wrong thing. Quoting the value fixes that; `%` and `_` come out because they
 * are LIKE wildcards, and a search for "%" should not return the whole board.
 */
export function likeTerm(raw: string): string {
  const clean = raw
    .trim()
    .replace(/[%_]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .slice(0, 120);

  return clean;
}

/** `title.ilike."%term%",content.ilike."%term%"` for the columns given. */
export function orIlike(columns: string[], raw: string): string {
  const term = likeTerm(raw);
  return columns.map((column) => `${column}.ilike."%${term}%"`).join(",");
}
