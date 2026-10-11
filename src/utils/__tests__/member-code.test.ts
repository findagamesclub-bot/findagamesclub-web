import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CODE_ALPHABET, CODE_LENGTH, codeProblem, foldMemberCode,
  formatMemberCode, looksLikeMemberCode,
} from "../member-code";

// The alphabet and the length live in two places, here and in 0177's
// `new_member_code`. Two readings of one rule that are never compared are two
// readings that will drift, so this reads the migration.
{
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/0177_a_member_code_so_a_result_finds_its_account.sql"),
    "utf8");

  const alphabet = /v_alphabet constant text := '([^']+)'/.exec(sql)?.[1];
  assert.equal(alphabet, CODE_ALPHABET, "the SQL alphabet and the TS one have drifted apart");

  const length = /for i in 1\.\.(\d+) loop/.exec(sql)?.[1];
  assert.equal(Number(length), CODE_LENGTH, "the SQL code length and the TS one have drifted");

  // The whole point of the alphabet is the characters that are NOT in it.
  for (const character of "01OIL") {
    assert.ok(!CODE_ALPHABET.includes(character),
      `${character} is mistyped off a phone and must not be in a code`);
  }
  for (const vowel of "AEIOU") {
    assert.ok(!CODE_ALPHABET.includes(vowel), `${vowel} would let a code spell a word`);
  }
}

// Folding: hyphens and case are how a person writes one down, not what it is.
assert.equal(foldMemberCode("K7MP-3QXR"), "K7MP3QXR");
assert.equal(foldMemberCode("k7mp 3qxr"), "K7MP3QXR");
assert.equal(foldMemberCode("  K7MP–3QXR  ".replace("–", "-")), "K7MP3QXR");
assert.equal(foldMemberCode(""), "");

// And showing it: always the same two chunks, whatever was typed.
assert.equal(formatMemberCode("k7mp3qxr"), "K7MP-3QXR");
assert.equal(formatMemberCode("K7MP-3QXR"), "K7MP-3QXR");
// Anything that is not a whole code is left as it is rather than cut into
// chunks that would read as a code somebody could try.
assert.equal(formatMemberCode("K7MP"), "K7MP");

assert.ok(looksLikeMemberCode("K7MP-3QXR"));
assert.ok(!looksLikeMemberCode("K7MP"), "too short");
assert.ok(!looksLikeMemberCode("K7MP3QXRZ"), "too long");
assert.ok(!looksLikeMemberCode("K7MP3QXA"), "a vowel is not in the alphabet");

// Nothing is said until there is enough typed to be wrong about. A red line on
// the first keystroke is an error message about an unfinished thought.
assert.equal(codeProblem(""), null);
assert.equal(codeProblem("K7M"), null);
assert.equal(codeProblem("K7MP-3QXR"), null);
assert.match(codeProblem("K7MP3QXRZZ") ?? "", /8 characters/);
assert.match(codeProblem("K7MP3QX0") ?? "", /never contains "0"/);

// A code with a hyphen is 8 characters, not 9, so the hyphen must not be what
// triggers the "too long" line.
assert.equal(codeProblem("K7MP-3QXR"), null);

console.log("member-code: all pass");
