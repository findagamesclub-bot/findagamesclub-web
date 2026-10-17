import type { ResultArmy } from "./event";

/**
 * A team event, at both of its levels.
 *
 * A fixture owns the player tables inside it, and those tables are ordinary
 * pairing matches with a parent (0168). Everything that already works on a
 * table, armies, scores, publishing, the Meta Tracker, keeps working here
 * without knowing a team exists.
 */

export type TeamPlayer = {
  id: number;
  profileId: string | null;
  name: string;
  position: number;
};

export type EventTeam = {
  id: number;
  name: string;
  position: number;
  /** Where the club says they finished, once it has said. */
  finalRank: number | null;
  placement: string;
  /**
   * The figure beside their finishing place, in whatever the format counts.
   * Typed by the club, never derived: a final table has tiebreakers only the
   * organiser knows, which is what `finalRank` already says.
   */
  finalScore: number | null;
  captainProfileId: string | null;
  players: TeamPlayer[];
};

export type TeamTable = {
  id: number;
  tableLabel: string;
  playerOne: string;
  playerOneId: string | null;
  playerTwo: string;
  playerTwoId: string | null;
  scoreOne: number | null;
  scoreTwo: number | null;
  /**
   * What the format scored this one table at, where that is not the victory
   * points: 3 against 1 on a table that went 80 to 60. 0176 gave the fixture
   * the same pair for the same reason and the client asked for it a level
   * down. Null means the club has not said, which is not nil.
   */
  pointsOne: number | null;
  pointsTwo: number | null;
  position: number;
  /**
   * What was played on it, attached by `eventDetail.service` from the same
   * two reads the flat draw uses (0172). The fixture read cannot carry them:
   * it is one jsonb per fixture and the armies are rows of their own.
   *
   * Without these a team event's tables were the one part of the site with no
   * way into a match, which is what the client asked for: "the draw and teams
   * sections on the front end should show a list/game icon".
   */
  armyOne?: ResultArmy | null;
  armyTwo?: ResultArmy | null;
  setup?: { mission: string; deployment: string; terrain: string } | null;
};

export type TeamFixture = {
  id: number;
  pairingId: number;
  round: number;
  tableLabel: string;
  teamOne: number | null;
  teamOneName: string;
  teamTwo: number | null;
  teamTwoName: string;
  /** Added up from the tables below, never typed. Null until one is scored. */
  scoreOne: number | null;
  scoreTwo: number | null;
  gamesOne: number;
  gamesTwo: number;
  /**
   * The club's own score for this fixture, where a format does not decide it
   * by totalling the players: 5 against 4 rather than 200 against 190. Null
   * means they have not said, and the players' total stands (0176).
   */
  pointsOne: number | null;
  pointsTwo: number | null;
  position: number;
  /** Whether the round it belongs to is on show. */
  published: boolean;
  tables: TeamTable[];
};
