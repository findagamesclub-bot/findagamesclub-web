/** Pure formatting helpers. No I/O, no React. */

/** "Thursday" + "19:00 - 22:30" -> "Thu 19:00" */
export function formatMeeting(day: string, time: string): string | null {
  const shortDay = day ? day.slice(0, 3) : "";
  const start = time?.split(/[-–]/)[0]?.trim() ?? "";
  return [shortDay, start].filter(Boolean).join(" ") || null;
}

/** Source data mixes "GBP 8", "£8", "Pay what you can" and "TBC". */
export function formatPrice(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value || ["TBC", "N/A", "-"].includes(value.toUpperCase())) return null;
  const gbp = value.match(/^GBP\s*([\d.]+)$/i);
  return gbp ? `£${gbp[1]}` : value;
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
