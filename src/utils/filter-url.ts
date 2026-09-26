/**
 * The address a filter bar writes.
 *
 * Pure, because getting this wrong is silent: the page still renders, it just
 * renders something else. Rebuilding the query from the filters alone dropped
 * `tab=bookings`, so changing "To pay" to "Paid" quietly threw the reader back
 * to the events list.
 *
 * Three rules:
 *   - anything the bar does not own is left exactly as it was
 *   - a value equal to its default comes out, so a plain list has a plain URL
 *   - any change goes back to page one, because page four of a different
 *     filter is somebody staring at an empty list
 */

export function nextSearch(
  current: URLSearchParams | string,
  /** The params this bar owns. An empty value removes one. */
  owned: Record<string, string | undefined>,
  defaults: Record<string, string> = {},
): string {
  const params = new URLSearchParams(
    typeof current === "string" ? current : current.toString());

  for (const [key, value] of Object.entries(owned)) {
    if (!value || value === defaults[key]) params.delete(key);
    else params.set(key, value);
  }

  params.delete("page");
  return params.toString();
}

/** `/path?a=b`, or `/path` when nothing is left to say. */
export function withSearch(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname;
}

/**
 * A page's resolved `searchParams` as a `URLSearchParams`.
 *
 * Next hands a plain object whose values are `string | string[] | undefined`,
 * and `nextSearch` needs the real thing. Without this every caller writes the
 * same flatMap, and the one that gets it wrong drops a repeated param.
 */
export function searchFrom(
  params: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const one of Array.isArray(value) ? value : [value]) out.append(key, one);
  }
  return out;
}
