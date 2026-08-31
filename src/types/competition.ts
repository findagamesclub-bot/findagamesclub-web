/** Leagues, ladders and campaigns. See migration 0024. */

export type CompetitionStanding = {
  rank: number;
  memberName: string;
  profileId: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  /** "4-0-1" as the club writes it, which is not always W-D-L. */
  recordLabel: string;
  notes: string;
  /** Text only. The link to a stored army list is Milestone 3. */
  faction: string;
  detachment: string;
};

export type CompetitionMatch = {
  playerOne: string;
  playerOneScore: string;
  playerTwo: string;
  playerTwoScore: string;
};

export type CompetitionUpdate = {
  id: number;
  postedOn: string | null;
  title: string;
  summary: string;
  matches: CompetitionMatch[];
};

export type Competition = {
  id: number;
  title: string;
  typeLabel: string;
  statusLabel: string;
  isCompleted: boolean;
  season: string;
  game: string;
  summary: string;
  startDate: string | null;
  endDate: string | null;
  standings: CompetitionStanding[];
  updates: CompetitionUpdate[];
};
