import { titleCase } from "./format";
import { canonicalGame } from "./game-label";

export type Counted = { label: string; value: number };

/**
 * One row per thing, whatever people typed.
 *
 * Members type the game into their own booking, so a club's busiest system
 * arrives as "Warhammer 40k" on three rows and "Warhammer 40,000" on two, and
 * the chart shows them as two different games neither of which is the real
 * figure. `canonicalGame` already holds the synonyms, and it is a JSON file in
 * `src/utils`, which is why this folds here rather than in SQL: one list, not
 * two that drift.
 *
 * Folding happens after the database has counted, so the SQL asks for more rows
 * than the page shows and this trims back. Trimming first would spend two of
 * five slots on the two spellings of one game.
 *
 * A game with no synonym keeps the spelling it arrived with, tidied: "cards"
 * and "kill game" sat in the chart in lower case beside "Kill Team", which
 * reads as three different kinds of thing. `titleCase` only lifts words that
 * are entirely lower case and longer than three letters, so it leaves "Kill
 * Team", "D&D" and "Warhammer 40,000" exactly as they are.
 *
 * Only what somebody typed, though. A name the synonym list supplied is spelled
 * the way that list decided, and so is the placeholder it uses for a booking
 * with no game on it — tidying that turned "Club game" into "Club Game".
 */
export function foldGames(rows: Counted[], limit = 5): Counted[] {
  const total = new Map<string, number>();
  for (const row of rows) {
    const raw = String(row.label ?? "").trim();
    const canonical = canonicalGame(raw);
    const mine = raw !== "" && canonical.toLowerCase() === raw.toLowerCase();
    const label = mine ? titleCase(canonical) : canonical;
    total.set(label, (total.get(label) ?? 0) + Number(row.value ?? 0));
  }
  return [...total.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/**
 * Whether the weekday split is worth showing.
 *
 * A club that meets on one night gets the same single bar twice: "Thursday 10"
 * under Most booked nights and "Thu 10" under By day of the week. The second
 * chart only says something once there is more than one day to compare.
 */
export function worthSplittingByDay(weekdays: { bookings: number }[]): boolean {
  return weekdays.filter((day) => day.bookings > 0).length > 1;
}
