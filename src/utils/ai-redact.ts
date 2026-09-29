/**
 * Take the personal details out of a prompt before it leaves the building.
 *
 * A prompt is a copy of somebody's data, it goes to a third party, and
 * `army_ai_jobs.request_payload` keeps it long after the run. None of the four
 * features needs an email address, a postcode or a phone number to do its job,
 * so none of them gets one.
 *
 * Names are deliberately NOT redacted. The scouting pack is about a named
 * opponent and a briefing that says "your opponent" four times is a briefing
 * nobody reads. That is a decision, not an oversight.
 */

const PATTERNS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  // UK postcodes, both halves or just the outcode with a space after it.
  [/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "[postcode]"],
  // Enough digits together to be a phone number, however it is spaced.
  [/\b(?:\+?\d[\d\s-]{8,}\d)\b/g, "[phone]"],
];

export function redactText(value: string): string {
  return PATTERNS.reduce((said, [pattern, replacement]) =>
    said.replace(pattern, replacement), String(value ?? ""));
}

/** The same, through a whole payload, keys included. */
export function redact<T>(value: T): T {
  if (typeof value === "string") return redactText(value) as T;
  if (Array.isArray(value)) return value.map((one) => redact(one)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, one]) => [key, redact(one)]),
    ) as T;
  }
  return value;
}
