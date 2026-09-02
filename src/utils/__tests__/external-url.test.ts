import assert from "node:assert/strict";
import { externalUrl } from "../external-url";

// The ordinary cases.
assert.equal(externalUrl("https://bestcoastpairings.com/event/abc"),
  "https://bestcoastpairings.com/event/abc");
assert.equal(externalUrl("http://example.com/x"), "http://example.com/x");

// Typed without a scheme, which is how people write addresses.
assert.equal(externalUrl("bestcoastpairings.com/event/abc"),
  "https://bestcoastpairings.com/event/abc");
assert.equal(externalUrl("//example.com/a"), "https://example.com/a");
assert.equal(externalUrl("  example.com  "), "https://example.com/");

// The reason this function exists: an href that runs code when clicked.
assert.equal(externalUrl("javascript:alert(1)"), null);
assert.equal(externalUrl("JavaScript:alert(1)"), null);
assert.equal(externalUrl("data:text/html;base64,PHNjcmlwdD4="), null);
assert.equal(externalUrl("mailto:someone@example.com"), null);

// Nothing usable means the caller hides the control.
assert.equal(externalUrl(null), null);
assert.equal(externalUrl(undefined), null);
assert.equal(externalUrl(""), null);
assert.equal(externalUrl("   "), null);
assert.equal(externalUrl("not a url"), null);
assert.equal(externalUrl("localhost"), null);

console.log("externalUrl: all assertions passed");
