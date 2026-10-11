import assert from "node:assert/strict";
import { fixtureScores, teamStandings, type StandingFixture } from "../team-standings";

const TEAMS = [
  { id: 1, name: "Oxford Oathsworn", finalRank: null },
  { id: 2, name: "Didcot Dreadnoughts", finalRank: null },
];

const base: StandingFixture = {
  teamOne: 1, teamTwo: 2,
  scoreOne: 200, scoreTwo: 190,
  gamesOne: 2, gamesTwo: 1,
};

// Nothing typed, so the players' total is what a fixture counts for.
assert.deepEqual(fixtureScores(base), { one: 200, two: 190 });

// The client's own example: the players totalled 200 to 190 and the club
// scores the round 5 to 4. The club's figure is the one that counts.
const typed: StandingFixture = { ...base, pointsOne: 5, pointsTwo: 4 };
assert.deepEqual(fixtureScores(typed), { one: 5, two: 4 });

// Both or neither. One side alone would mix a club's 5 with a players' 190 in
// the same fixture, so a half-typed pair falls back to the total.
assert.deepEqual(fixtureScores({ ...base, pointsOne: 5 }), { one: 200, two: 190 });
assert.deepEqual(fixtureScores({ ...base, pointsTwo: 4 }), { one: 200, two: 190 });

// Nil is a real answer and is not "not said". A club can score a round 0-0.
assert.deepEqual(fixtureScores({ ...base, pointsOne: 0, pointsTwo: 0 }),
  { one: 0, two: 0 });

// An unplayed fixture stays unplayed whichever way it is read.
assert.deepEqual(fixtureScores({ ...base, scoreOne: null, scoreTwo: null }),
  { one: null, two: null });

// The table counts the club's figure, not the total.
{
  const table = teamStandings(TEAMS, [typed]);
  const oxford = table.find((row) => row.teamId === 1)!;
  const didcot = table.find((row) => row.teamId === 2)!;

  assert.equal(oxford.points, 5, "the club's own score is what the table counts");
  assert.equal(oxford.against, 4);
  assert.equal(didcot.points, 4);
  assert.equal(didcot.against, 5);

  // Who won is unchanged: 5 beats 4 exactly as 200 beat 190.
  assert.equal(oxford.won, 1);
  assert.equal(didcot.lost, 1);

  // Tables won is about the games underneath and is never the typed figure.
  assert.equal(oxford.tablesWon, 2);
  assert.equal(didcot.tablesWon, 1);
}

// And a club can reverse a fixture the players won: the whole reason the
// figure is typed is that the format may not total the scores.
{
  const upset: StandingFixture = { ...base, pointsOne: 2, pointsTwo: 7 };
  const table = teamStandings(TEAMS, [upset]);
  assert.equal(table[0]!.teamId, 2, "the team the club scored higher leads");
  assert.equal(table.find((r) => r.teamId === 1)!.lost, 1);
}

// Untyped fixtures still behave exactly as they did before 0176.
{
  const table = teamStandings(TEAMS, [base]);
  assert.equal(table.find((r) => r.teamId === 1)!.points, 200);
  assert.equal(table.find((r) => r.teamId === 2)!.points, 190);
  assert.equal(table[0]!.teamId, 1);
}

// A bye counts for nobody, typed or not.
{
  const table = teamStandings(TEAMS, [
    { teamOne: 1, teamTwo: null, scoreOne: null, scoreTwo: null,
      gamesOne: 0, gamesTwo: 0, pointsOne: 3, pointsTwo: 0 },
  ]);
  assert.equal(table.find((r) => r.teamId === 1)!.played, 0);
}

console.log("team-standings: all pass");
