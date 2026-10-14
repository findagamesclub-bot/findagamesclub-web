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
  /**
   * What they took. Free text at a club with the army builder off, and the
   * catalogue's own spelling at one that runs it. The link to a stored army
   * list is stage 10.
   */
  faction: string;
  detachment: string;
  disposition: string;
};

export type CompetitionMatch = {
  /** Stable since 0181, which is what lets a game own what was played in it. */
  id: number;
  playerOne: string;
  playerOneScore: string;
  /** The account behind the name, where the club named a member. */
  playerOneId: string | null;
  playerTwo: string;
  playerTwoScore: string;
  playerTwoId: string | null;
  /** How the game was set up. 40k's own three, empty at every other game. */
  mission: string;
  deployment: string;
  terrain: string;
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
