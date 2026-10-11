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
  position: number;
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
