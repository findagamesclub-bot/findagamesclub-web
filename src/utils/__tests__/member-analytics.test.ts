import assert from "node:assert/strict";
import { byOpponent, byGame, byClub, mostWins, mostPlayed,
         type AnalyticsGame } from "../member-analytics";

const didcot = { slug: "didcot", name: "Didcot Wargames" };
const wharf = { slug: "wharf", name: "Mana Wharf" };

const game = (p: Partial<AnalyticsGame>): AnalyticsGame => ({
  club: didcot, title: "Warhammer 40,000", opponentId: null,
  opponentName: "Joe Matthews", outcome: "won", ...p,
});

// An opponent with an account is keyed on the id, so a rename does not split
// them into two people.
{
  const rows = byOpponent([
    game({ opponentId: "joe", opponentName: "Joe Matthews", outcome: "won" }),
    game({ opponentId: "joe", opponentName: "Joe M", outcome: "lost" }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.played, 2);
  assert.equal(rows[0]!.record, "1-0-1");
  assert.equal(rows[0]!.winRate, 50);
  assert.equal(rows[0]!.profileId, "joe");
}

// A guest with no account is keyed on the folded name.
{
  const rows = byOpponent([
    game({ opponentName: "Peter Hill" }),
    game({ opponentName: "peter hill", outcome: "lost" }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.record, "1-0-1");
  assert.equal(rows[0]!.profileId, null);
}

// Nobody named is nobody: an unnamed opponent is not a row called "".
assert.equal(byOpponent([game({ opponentName: "  " })]).length, 0);

// An unscored game counts as played and towards nothing else, so it cannot
// drag a win rate down.
{
  const rows = byOpponent([
    game({ opponentId: "joe", outcome: "won" }),
    game({ opponentId: "joe", outcome: null }),
  ]);
  assert.equal(rows[0]!.played, 2);
  assert.equal(rows[0]!.record, "1-0-0");
  assert.equal(rows[0]!.winRate, 100);
}

// Nothing scored at all leaves the rate null rather than 0%, which would read
// as "loses every game" instead of "nobody filled the scores in".
assert.equal(byOpponent([game({ opponentId: "joe", outcome: null })])[0]!.winRate, null);

// Every club the pair met at is listed.
{
  const rows = byOpponent([
    game({ opponentId: "joe", club: didcot }),
    game({ opponentId: "joe", club: wharf }),
  ]);
  assert.deepEqual(rows[0]!.clubs, ["Didcot Wargames", "Mana Wharf"]);
}

// Games and clubs tally the same way.
{
  const games = [
    game({ title: "Warhammer 40,000" }),
    game({ title: "Warhammer 40,000", outcome: "drew" }),
    game({ title: "Kill Team", club: wharf, outcome: "lost" }),
  ];
  const titles = byGame(games);
  assert.equal(titles.length, 2);
  assert.equal(titles.find((r) => r.label === "Warhammer 40,000")!.record, "1-1-0");

  const clubs = byClub(games);
  assert.deepEqual(mostPlayed(clubs).map((r) => r.label), ["Didcot Wargames", "Mana Wharf"]);
}

// The two orderings really are different: most played is not most won.
{
  const rows = byOpponent([
    game({ opponentId: "a", opponentName: "Ann", outcome: "won" }),
    game({ opponentId: "a", opponentName: "Ann", outcome: "won" }),
    game({ opponentId: "b", opponentName: "Bob", outcome: "lost" }),
    game({ opponentId: "b", opponentName: "Bob", outcome: "lost" }),
    game({ opponentId: "b", opponentName: "Bob", outcome: "lost" }),
  ]);
  assert.deepEqual(mostWins(rows).map((r) => r.label), ["Ann", "Bob"]);
  assert.deepEqual(mostPlayed(rows).map((r) => r.label), ["Bob", "Ann"]);
}

// A tie breaks the same way every render rather than however the Map ordered it.
{
  const rows = byOpponent([
    game({ opponentId: "z", opponentName: "Zoe", outcome: "won" }),
    game({ opponentId: "a", opponentName: "Adam", outcome: "won" }),
  ]);
  assert.deepEqual(mostWins(rows).map((r) => r.label), ["Adam", "Zoe"]);
}

console.log("member-analytics: all assertions passed");
