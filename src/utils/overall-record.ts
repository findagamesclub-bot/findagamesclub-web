/**
 * A member's record, added up from the three places games are recorded.
 *
 * The three are kept apart as well as added together, because they are not
 * the same kind of evidence: a club night is one table two people booked, an
 * event game is one scored table of a draw, and a league figure is the club's
 * own tally on a standings table rather than a game anybody can point at. A
 * single number would hide that, and the client's own sentence names all
 * three.
 */

export type RecordSource = "club" | "event" | "league";

export type SourceRecord = {
  source: RecordSource;
  played: number;
  wins: number;
  draws: number;
  losses: number;
};

/** Fixed order, nearest to furthest from an ordinary week at the club. */
export const SOURCES: RecordSource[] = ["club", "event", "league"];

export const SOURCE_LABELS: Record<RecordSource, string> = {
  club: "Club nights",
  event: "Event games",
  league: "Leagues and competitions",
};

/** What each figure is counting, so the panel does not have to guess. */
export const SOURCE_NOTES: Record<RecordSource, string> = {
  club: "Table bookings with a score on them.",
  event: "Scored tables from an event draw.",
  league: "The club's own tally on a standings table.",
};

const EMPTY = { played: 0, wins: 0, draws: 0, losses: 0 };

/** One source's figures, zeroed when nothing came back for it. */
export function sourceOf(rows: SourceRecord[], source: RecordSource): SourceRecord {
  const found = rows.find((row) => row.source === source);
  return { source, ...EMPTY, ...(found ?? {}) };
}

/** Every source in their fixed order, including the ones with nothing in. */
export function allSources(rows: SourceRecord[]): SourceRecord[] {
  return SOURCES.map((source) => sourceOf(rows, source));
}

export function combine(rows: SourceRecord[]): Omit<SourceRecord, "source"> {
  return rows.reduce((total, row) => ({
    played: total.played + (Number(row.played) || 0),
    wins: total.wins + (Number(row.wins) || 0),
    draws: total.draws + (Number(row.draws) || 0),
    losses: total.losses + (Number(row.losses) || 0),
  }), { ...EMPTY });
}

/** How a wargamer writes a record down. */
export function recordLine(r: { wins: number; draws: number; losses: number }): string {
  return `${r.wins}-${r.draws}-${r.losses}`;
}
