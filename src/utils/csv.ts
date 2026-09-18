/**
 * A spreadsheet the club opens in Excel or Numbers.
 *
 * Two things that look like fussiness and are not:
 *
 *   - Excel on Windows reads a UTF-8 file as Windows-1252 unless it finds a
 *     byte order mark, so a name with an accent in it arrives mangled.
 *   - A field is quoted whenever it holds a comma, a quote or a newline, and a
 *     quote inside is doubled. A club's note saying `He said "maybe"` is the
 *     row that breaks a naive join.
 */

export const CSV_BOM = "﻿";

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // A leading =, +, - or @ is read as a formula by Excel and Sheets, which is
  // how a name typed into a booking form becomes code somebody runs.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /["\n\r,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(
  headers: string[], rows: (string | number | null | undefined)[][],
): string {
  // CRLF, which is what the spec says and what older Excel needs.
  return CSV_BOM + [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** A filename a club can find again: "door-list-autumn-open-2026-09-26.csv". */
export function csvFilename(parts: (string | null | undefined)[]): string {
  const slug = parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "export"}.csv`;
}
