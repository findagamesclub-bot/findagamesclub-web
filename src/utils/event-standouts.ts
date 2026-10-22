import type { EventGroupRow, EventPlayer } from "@/services/meta.service";

/**
 * The headline facts an event's analytics are opened for.
 *
 * The client asked for "most popular faction, detachment and dispositions,
 * number of undefeated players". Those are readings of the groups rather than
 * figures of their own, so they are worked out here instead of in SQL: one
 * place, testable without a database, and it cannot disagree with the lists
 * underneath because it is built from them.
 */

export type Standout = { label: string; value: string; note: string };

/** Most taken, not best: a tie goes to the one more people brought. */
export function mostTaken(rows: EventGroupRow[]): EventGroupRow | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) =>
    b.players - a.players || b.appearances - a.appearances
    || a.label.localeCompare(b.label))[0]!;
}

/**
 * Nobody beat them. Drawn games are not losses, so somebody who drew every
 * round is still undefeated, which is what the word means at a tournament.
 */
export const undefeated = (players: EventPlayer[]): EventPlayer[] =>
  players.filter((p) => p.games > 0 && p.losses === 0);

const people = (n: number) => `${n} ${n === 1 ? "player" : "players"}`;

export function standouts(
  breakdown: {
    factions: EventGroupRow[];
    detachments: EventGroupRow[];
    dispositions: EventGroupRow[];
    players: EventPlayer[];
  },
): Standout[] {
  const out: Standout[] = [];

  const players = breakdown.players.length;
  if (players) {
    const clean = undefeated(breakdown.players);
    out.push({
      label: "Played",
      value: String(players),
      note: players === 1 ? "player scored a game" : "players scored a game",
    });
    out.push({
      label: "Undefeated",
      value: String(clean.length),
      // Said in words as well as in a number, because "0" under a heading is
      // a fact a reader has to work out the meaning of.
      note: clean.length
        ? clean.slice(0, 3).map((p) => p.player).join(", ")
          + (clean.length > 3 ? ` and ${clean.length - 3} more` : "")
        : "somebody beat everybody",
    });
  }

  const pairs: [string, EventGroupRow[]][] = [
    ["Most taken army", breakdown.factions],
    ["Most taken detachment", breakdown.detachments],
    ["Most taken disposition", breakdown.dispositions],
  ];
  for (const [label, rows] of pairs) {
    const top = mostTaken(rows);
    if (top) {
      out.push({ label, value: top.label, note: `taken by ${people(top.players)}` });
    }
  }

  return out;
}
