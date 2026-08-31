import assert from "node:assert/strict";
import {
  buildSocialLinks, normaliseSocialUrl, socialValue, toSocialLinks,
} from "../social-links";

// Whatever the column holds, only well-formed pairs come back.
assert.deepEqual(toSocialLinks(null), []);
assert.deepEqual(toSocialLinks({}), []);
assert.deepEqual(toSocialLinks([{ label: "X" }, { url: "https://x.com" }]), []);
assert.deepEqual(
  toSocialLinks([{ label: " Instagram ", url: " https://instagram.com/joe " }]),
  [{ label: "Instagram", url: "https://instagram.com/joe" }],
);

// Field lookup is case-insensitive, because legacy wrote "X" and "x" both.
const links = [{ label: "Instagram", url: "https://instagram.com/joe" }];
assert.equal(socialValue(links, "instagram"), "https://instagram.com/joe");
assert.equal(socialValue(links, "Twitch"), "");

// A missing scheme is a typing habit, so it is added.
assert.equal(normaliseSocialUrl("instagram.com/joe"), "https://instagram.com/joe");
assert.equal(normaliseSocialUrl("https://x.com/joe"), "https://x.com/joe");
assert.equal(normaliseSocialUrl("  https://x.com/joe/  "), "https://x.com/joe");

// A bare handle is not a link, and guessing which site it belongs to would be
// inventing data.
assert.equal(normaliseSocialUrl("@joe"), null);
assert.equal(normaliseSocialUrl("joe"), null);
assert.equal(normaliseSocialUrl(""), null);
assert.equal(normaliseSocialUrl("   "), null);

// Legacy's own data has hosts with no dot. Those were never openable.
assert.equal(normaliseSocialUrl("http://instagram/joem12"), null);

// Blanks are dropped, bad ones are named so the member can be told which.
const built = buildSocialLinks([
  { label: "Instagram", url: "instagram.com/joe" },
  { label: "Facebook", url: "" },
  { label: "Discord", url: "@joe" },
]);
assert.deepEqual(built.links, [{ label: "Instagram", url: "https://instagram.com/joe" }]);
assert.deepEqual(built.rejected, ["Discord"]);

console.log("social-links ok");
