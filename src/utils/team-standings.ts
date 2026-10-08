/**
 * The team table as it stands, worked out from the fixtures.
 *
 * Guidance, not the result. What a team actually finished is `final_rank`, and
 * the club types that, because a final table needs tiebreakers only the
 * organiser knows and a tournament often has a rule this cannot see. So this
 * is the running table an organiser reads between rounds, and the podium is
 * still theirs to declare.
 *
 * A fixture is won on points, with tables won shown beside it. Team formats
 * split on which of the two decides, and points is what a 40k team event
 * usually totals; the column next to it is there so a club running the other
 * way can read their own answer off the same table. Neither decides anything
 * on its own, for the reason above.
 */

export type StandingFixture = {
  teamOne: number | null;
  teamTwo: number | null;
  scoreOne: number | null;
  scoreTwo: number | null;
  gamesOne: number;
  gamesTwo: number;
};

export type TeamStanding = {
  teamId: number;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  /** Points scored by this team's players, and against them. */
  points: number;
  against: number;
  tablesWon: number;
  finalRank: number | null;
};

const EMPTY = {
  played: 0, won: 0, drawn: 0, lost: 0, points: 0, against: 0, tablesWon: 0,
};

export function teamStandings(
  teams: readonly { id: number; name: string; finalRank: number | null }[],
  fixtures: readonly StandingFixture[],
): TeamStanding[] {
  const table = new Map<number, TeamStanding>();
  for (const team of teams) {
    table.set(team.id, {
      teamId: team.id, name: team.name, finalRank: team.finalRank, ...EMPTY,
    });
  }

  const count = (
    id: number | null, mine: number, theirs: number, tables: number,
  ) => {
    if (id === null) return;
    const row = table.get(id);
    if (!row) return;
    row.played += 1;
    row.points += mine;
    row.against += theirs;
    row.tablesWon += tables;
    if (mine > theirs) row.won += 1;
    else if (mine < theirs) row.lost += 1;
    else row.drawn += 1;
  };

  for (const fixture of fixtures) {
    // A fixture nobody has played is not a draw, and a bye is not a win.
    if (fixture.scoreOne === null || fixture.scoreTwo === null) continue;
    if (fixture.teamOne === null || fixture.teamTwo === null) continue;
    count(fixture.teamOne, fixture.scoreOne, fixture.scoreTwo, fixture.gamesOne);
    count(fixture.teamTwo, fixture.scoreTwo, fixture.scoreOne, fixture.gamesTwo);
  }

  // The club's own order once it has said one, and the running order until
  // then. Mixing the two would put a team the club has placed fourth above one
  // it has not placed at all, for no reason a reader could work out.
  return [...table.values()].sort((a, b) => {
    if (a.finalRank !== null || b.finalRank !== null) {
      return (a.finalRank ?? 9999) - (b.finalRank ?? 9999)
        || a.name.localeCompare(b.name);
    }
    return b.won - a.won
      || (b.points - b.against) - (a.points - a.against)
      || b.points - a.points
      || a.name.localeCompare(b.name);
  });
}
