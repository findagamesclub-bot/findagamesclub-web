import assert from "node:assert/strict";

import { foldGames, worthSplittingByDay } from "../fold-rows";

{
  // The bug the client saw: one game, two spellings, two rows, and neither
  // row is the club's real figure for it.
  const folded = foldGames([
    { label: "Warhammer 40k", value: 3 },
    { label: "Warhammer 40,000", value: 2 },
    { label: "Kill Team", value: 1 },
  ]);
  assert.deepEqual(folded, [
    { label: "Warhammer 40,000", value: 5 },
    { label: "Kill Team", value: 1 },
  ]);
}

{
  // Case and spacing are not a different game either.
  const folded = foldGames([
    { label: "  warhammer 40K  ", value: 1 },
    { label: "Warhammer 40,000", value: 1 },
  ]);
  assert.equal(folded.length, 1);
  assert.equal(folded[0]!.value, 2);
}

{
  // A game nobody has a synonym for keeps the spelling it arrived with.
  const folded = foldGames([{ label: "Blood Bowl", value: 4 }]);
  assert.deepEqual(folded, [{ label: "Blood Bowl", value: 4 }]);
  // And an empty title is named rather than blank, so no bar is unlabelled.
  assert.equal(foldGames([{ label: "", value: 2 }])[0]!.label, "Club game");
}

{
  // Folding happens after counting, so the trim comes last: six raw rows that
  // fold to three must not lose one to the limit before folding.
  const raw = [
    { label: "warhammer 40k", value: 1 }, { label: "Warhammer 40,000", value: 1 },
    { label: "aos", value: 1 }, { label: "Age of Sigmar", value: 1 },
    { label: "Kill Team", value: 1 }, { label: "Blood Bowl", value: 1 },
  ];
  const folded = foldGames(raw, 5);
  assert.equal(folded.length, 4, "six rows fold to four games");
  assert.equal(folded[0]!.value, 2);
  // Ties break by name, so the order is stable between loads.
  assert.deepEqual(foldGames(raw, 5).map((r) => r.label),
    foldGames(raw, 5).map((r) => r.label));
}

{
  // Casual free text is tidied so one chart does not mix three conventions.
  assert.deepEqual(foldGames([{ label: "cards", value: 2 }]),
    [{ label: "Cards", value: 2 }]);
  assert.deepEqual(foldGames([{ label: "kill game", value: 1 }]),
    [{ label: "Kill Game", value: 1 }]);

  // But a name that already carries capitals is left alone, acronyms included.
  for (const kept of ["Kill Team", "D&D", "Warhammer 40,000", "Age of Sigmar"]) {
    assert.equal(foldGames([{ label: kept, value: 1 }])[0]!.label, kept,
      `${kept} was rewritten`);
  }
  // And tidying must not split a game back into two rows.
  assert.equal(foldGames([{ label: "cards", value: 1 }, { label: "Cards", value: 1 }]).length,
    1, "two casings of one game are still one game");
}

{
  assert.equal(foldGames([], 5).length, 0);
  assert.equal(foldGames([{ label: "A", value: 1 }, { label: "B", value: 2 },
    { label: "C", value: 3 }], 2).length, 2, "the limit still applies");
}

{
  // One night a week means the weekday chart repeats the nights chart.
  assert.equal(worthSplittingByDay([{ bookings: 10 }]), false);
  assert.equal(worthSplittingByDay([{ bookings: 10 }, { bookings: 0 }]), false);
  assert.equal(worthSplittingByDay([{ bookings: 10 }, { bookings: 3 }]), true);
  assert.equal(worthSplittingByDay([]), false);
}

console.log("fold-rows: all assertions passed");
