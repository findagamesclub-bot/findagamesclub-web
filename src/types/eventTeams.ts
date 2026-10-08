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
  position: number;
  /** Whether the round it belongs to is on show. */
  published: boolean;
  tables: TeamTable[];
};
