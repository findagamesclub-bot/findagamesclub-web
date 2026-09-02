/**
 * A link a club typed, made safe to put in an href.
 *
 * These arrive from club input and the legacy import, so they are not to be
 * trusted: `javascript:` in an href runs when somebody clicks it, and a bare
 * "bestcoastpairings.com/event/123" navigates inside our own site and 404s.
 *
 * Returns null when there is nothing usable, so the caller hides the control
 * rather than rendering a link that goes nowhere.
 */
export function externalUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  // A protocol-relative or scheme-less address is almost always a real site
  // somebody typed without the prefix, so it gets one rather than being lost.
  const withScheme = /^https?:\/\//i.test(value)
    ? value
    : value.startsWith("//") ? `https:${value}`
    : /^[a-z][a-z0-9+.-]*:/i.test(value) ? value
    : `https://${value}`;

  try {
    const url = new URL(withScheme);
    // Anything but the web is not something we will send a reader to.
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
