/** Pure formatting helpers. No I/O, no React. */

/** "Thursday" + "19:00 - 22:30" -> "Thu 19:00" */
export function formatMeeting(day: string, time: string): string | null {
  const shortDay = day ? day.slice(0, 3) : "";
  const start = time?.split(/[-–]/)[0]?.trim() ?? "";
  return [shortDay, start].filter(Boolean).join(" ") || null;
}

/**
 * Source data mixes "GBP 8", "GBP 22 / month", "£8", a bare "20", "Pay what
 * you can" and "TBC" — three clubs were entered by hand and eight were seeded.
 * Everything renders as sterling; free text is left as written.
 */
export function formatPrice(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value || ["TBC", "N/A", "-"].includes(value.toUpperCase())) return null;

  // Keeps any suffix, so "GBP 22 / month" becomes "£22 / month".
  const gbp = value.match(/^GBP\s*([\d.]+)(.*)$/i);
  if (gbp) return `£${gbp[1]}${gbp[2]}`;

  // A bare figure. Every club in the directory is UK-based and prices in GBP.
  if (/^[\d.]+$/.test(value)) return `£${value}`;

  return value;
}

/** Eight clubs stored the raw field name as the label: "dropIn" -> "Drop-in". */
export function formatPricingLabel(label: string): string {
  const known: Record<string, string> = { dropin: "Drop-in", membership: "Membership" };
  const value = label.trim();
  const known_ = known[value.toLowerCase()];
  if (known_) return known_;
  const spaced = value.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Legacy data has "warhammer 40k" next to "Star Wars: Shatterpoint". */
export function titleCase(value: string): string {
  return value
    .split(" ")
    .map((w) => (w.length > 3 && w === w.toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
