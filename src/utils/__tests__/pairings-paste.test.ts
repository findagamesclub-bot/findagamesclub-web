import assert from "node:assert/strict";
import { parsePastedPairings, pasteSummary } from "../pairings-paste";

const at = (raw: string) => parsePastedPairings(raw).map(
  (m) => `${m.table}|${m.playerOne}|${m.playerTwo}|${m.problem ?? ""}`);

// A table number and two names, which is what a spreadsheet exports.
assert.deepEqual(at("1\tAnn Lee\tBen Poe\n2\tCara Fox\tDan Ray"),
  ["1|Ann Lee|Ben Poe|", "2|Cara Fox|Dan Ray|"]);

// Two names and no table: numbered from one, in the order pasted.
assert.deepEqual(at("Ann Lee\tBen Poe\nCara Fox\tDan Ray"),
  ["1|Ann Lee|Ben Poe|", "2|Cara Fox|Dan Ray|"]);

// Typed by hand.
assert.deepEqual(at("Ann Lee vs Ben Poe"), ["1|Ann Lee|Ben Poe|"]);
assert.deepEqual(at("Ann Lee V Ben Poe"), ["1|Ann Lee|Ben Poe|"]);
assert.deepEqual(at("Ann Lee versus Ben Poe"), ["1|Ann Lee|Ben Poe|"]);

// A CSV export.
assert.deepEqual(at("1, Ann Lee, Ben Poe"), ["1|Ann Lee|Ben Poe|"]);

// A comma inside a name survives, because tabs win when both are present.
assert.deepEqual(at("1\tSmith, Ann\tBen Poe"), ["1|Smith, Ann|Ben Poe|"]);

// Blank lines and stray whitespace are not rows.
assert.deepEqual(at("\n  \n1\tAnn\tBen\n\n"), ["1|Ann|Ben|"]);

// A bye is one name and nothing else, and it is not a problem.
assert.deepEqual(at("3\tAnn Lee\t"), ["3|Ann Lee||"]);
assert.deepEqual(at("Ann Lee"), ["1|Ann Lee||"]);

// Two problems worth naming rather than silently dropping.
assert.deepEqual(at("1\t\tBen Poe"), ["1||Ben Poe|No player on this line."]);
assert.deepEqual(at("1\tAnn Lee\tann lee"), ["1|Ann Lee|ann lee|The same player twice."]);

// A number in the first cell of a two-cell line is a player, not a table:
// "7" as a nickname is odd, but taking it as a table would lose a player.
assert.deepEqual(at("7\tBen Poe"), ["1|7|Ben Poe|"]);

// Windows line endings.
assert.deepEqual(at("1\tAnn\tBen\r\n2\tCara\tDan"), ["1|Ann|Ben|", "2|Cara|Dan|"]);

// The summary is what the preview shows before anybody saves.
assert.equal(pasteSummary(parsePastedPairings("")), "Nothing to read yet.");
assert.equal(pasteSummary(parsePastedPairings("1\tAnn\tBen")), "1 table");
assert.equal(pasteSummary(parsePastedPairings("1\tAnn\tBen\n2\tCara\tDan")), "2 tables");
assert.equal(pasteSummary(parsePastedPairings("1\tAnn\tBen\n2\tCara\t")),
  "2 tables · 1 bye");
assert.equal(pasteSummary(parsePastedPairings("1\tAnn\tBen\n2\t\tDan")),
  "1 table · 1 line to look at");

console.log("pairings-paste: all assertions passed");
