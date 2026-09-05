import assert from "node:assert/strict";
import { tagLabel } from "../tag-label";

// Slugs the club never typed get sentence case.
assert.equal(tagLabel("tournament"), "Tournament");
assert.equal(tagLabel("social"), "Social");
assert.equal(tagLabel("open play"), "Open Play");

// Anything already carrying a capital is somebody's own wording, left alone.
// Title-casing here is how "Warhammer 40,000" becomes something else.
assert.equal(tagLabel("Wargaming"), "Wargaming");
assert.equal(tagLabel("Warhammer 40,000"), "Warhammer 40,000");
assert.equal(tagLabel("D&D"), "D&D");

// Hyphens and slashes start a word too.
assert.equal(tagLabel("one-to-one"), "One-To-One");
assert.equal(tagLabel("beginner/intermediate"), "Beginner/Intermediate");

// Padding and empties do not become a chip with nothing in it.
assert.equal(tagLabel("  tournament  "), "Tournament");
assert.equal(tagLabel("   "), "");

console.log("tag-label: all assertions passed");
