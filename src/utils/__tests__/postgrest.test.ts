import assert from "node:assert/strict";
import { likeTerm, orIlike } from "../postgrest";

assert.equal(likeTerm("  tables  "), "tables");
// A comma used to end the condition and take the next column with it.
assert.equal(likeTerm("Warhammer 40,000"), "Warhammer 40,000");
assert.equal(likeTerm("100% sure"), "100  sure");
assert.equal(likeTerm('say "hi"'), 'say \\"hi\\"');
assert.equal(likeTerm("a".repeat(200)).length, 120);

assert.equal(
  orIlike(["title", "content"], "40,000"),
  'title.ilike."%40,000%",content.ilike."%40,000%"',
);

console.log("postgrest ok");
