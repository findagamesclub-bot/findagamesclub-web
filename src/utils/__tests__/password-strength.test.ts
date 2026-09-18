import assert from "node:assert/strict";

import {
  BAND_LABELS, PASSWORD_MAX, PASSWORD_MIN, passwordAllowed, strength,
} from "../password-strength";

// --- legacy's rule, unchanged ---------------------------------------------

{
  // The exact wording holiday_store.py:1014 raises, because the server repeats it.
  assert.equal(strength("short").refusal,
    "Password must be at least 12 characters long.");
  assert.equal(strength("a".repeat(PASSWORD_MAX + 1)).refusal,
    "Password must be 128 characters or fewer.");
  assert.equal(strength(" ".repeat(PASSWORD_MIN + 2)).refusal,
    "Password cannot be made up only of spaces.");
  assert.equal(strength("correct horse battery staple").refusal, null,
    "a passphrase with spaces is allowed, as legacy allows it");
}

{
  // Exactly at the boundary is allowed. Off by one here means a password the
  // form accepts and the server refuses.
  assert.equal(strength("a".repeat(PASSWORD_MIN)).refusal, null);
  assert.equal(strength("a".repeat(PASSWORD_MIN - 1)).refusal !== null, true);
  assert.equal(strength("a".repeat(PASSWORD_MAX)).refusal, null);
}

// --- the score ------------------------------------------------------------

{
  // Long, varied and unrelated to anything.
  const s = strength("Tuesday!Kite92Harbour", "sara@example.com");
  assert.equal(s.band, "strong");
  assert.equal(s.advice, null, "nothing left to tell a strong password");
}

{
  // Twelve characters of one class is legal and poor, which is the whole point
  // of having a meter on top of the length rule.
  const s = strength("abcdefghijkl");
  assert.equal(s.refusal, null, "legacy allows it");
  assert.ok(s.band === "weak" || s.band === "fair", `scored ${s.band}`);
}

{
  // Below the minimum can never read as anything but weak, however varied.
  const s = strength("Ab3!Xy7#");
  assert.equal(s.band, "weak", "eight characters is weak whatever is in it");
  assert.ok(s.refusal, "and it is refused");
}

{
  // The client's own case: the address is the first thing people reach for.
  const plain = strength("northharbour2026");
  const echoed = strength("gulnabidev2026xx", "gulnabidev@gmail.com");
  assert.ok(echoed.score < plain.score, "using the email costs you");
  assert.equal(echoed.advice, "Do not use your email address in your password.");
}

{
  // A short local part must not condemn every password containing it.
  const s = strength("Tuesday!Kite92Harbour", "ann@example.com");
  assert.equal(s.band, "strong", "three letters is too short to match on");
}

{
  const s = strength("mypasswordislong");
  assert.equal(s.advice, "That contains a very common password. Pick something else.");
  assert.ok(s.score <= 2);
}

{
  const s = strength("aaaaaaaaaaaaaaaa");
  assert.ok(s.score <= 2, "sixteen of the same character is not strong");
  assert.ok(s.advice?.includes("repeated") || s.advice?.includes("common"));
}

{
  const s = strength("abcdefghijklmnop");
  assert.ok(s.score <= 2, "a straight run up the alphabet is not strong");
}

// --- the bands are ordered and named --------------------------------------

{
  assert.deepEqual(
    (["weak", "fair", "good", "strong"] as const).map((b) => BAND_LABELS[b]),
    ["Weak", "Fair", "Good", "Strong"],
  );
  for (const value of ["", "x", "abcdefghijkl", "Tuesday!Kite92Harbour"]) {
    const s = strength(value);
    assert.ok(s.score >= 0 && s.score <= 4, `${value} scored ${s.score}`);
  }
}

// --- what the form does with it -------------------------------------------

{
  // Too short: the legacy message, because that is what the server will say.
  const short = passwordAllowed("abc", "a@b.com");
  assert.equal(short.ok, false);
  assert.equal(short.message, "Password must be at least 12 characters long.");

  // Long enough but weak: blocked, with the one useful thing to change.
  const weak = passwordAllowed("gulnabidev2026xx", "gulnabidev@gmail.com");
  assert.equal(weak.ok, false);
  assert.equal(weak.message, "Do not use your email address in your password.");

  // Fair is the floor, not Good: we are stopping the obviously poor, not
  // dictating passwords.
  const fair = strength("abcdefghijklmnopq1");
  assert.ok(fair.band !== "weak" || passwordAllowed("abcdefghijklmnopq1").ok === false);

  assert.deepEqual(passwordAllowed("Tuesday!Kite92Harbour"), { ok: true, message: null });
}


{
  // A plus tag is not part of who somebody is, and every test account on this
  // site uses one. Comparing against the whole tagged local part meant
  // "gulnabidev1234" never matched "gulnabidev+newclub@gmail.com" and was
  // allowed straight through.
  const tagged = "gulnabidev+newclub@gmail.com";
  assert.equal(passwordAllowed("gulnabidev1234", tagged).ok, false);
  assert.match(strength("gulnabidev1234", tagged).advice ?? "", /email address/);

  // The untagged form still works, and so does the whole tagged string.
  assert.equal(passwordAllowed("gulnabidev1234", "gulnabidev@gmail.com").ok, false);
  assert.equal(passwordAllowed("gulnabidev+newclub9", tagged).ok, false);

  // Dots too: Gmail ignores them and people type their name both ways.
  assert.equal(passwordAllowed("samwhitfield2026", "sam.whitfield@gmail.com").ok, false);

  // And it does not fire on something merely short that happens to appear. An
  // address is only compared from four characters up.
  assert.equal(passwordAllowed("Thursday-Nights-2026", "ann@gmail.com").ok, true);

  // Nothing changes when there is no email to compare against.
  assert.equal(passwordAllowed("Thursday-Nights-2026", "").ok, true);
}


{
  // A common word counts when it is most of the password, and not when it is
  // one word inside a real passphrase. Matching it as a bare substring refused
  // twenty-six characters for containing "dragon".
  assert.equal(passwordAllowed("password1234", "").ok, false);
  assert.equal(passwordAllowed("iloveyou2026", "").ok, false);
  assert.equal(passwordAllowed("correcthorsebattery-dragon", "").ok, true);
  // Two character classes, so "good" rather than "strong". The point is that it
  // is nowhere near weak.
  assert.equal(strength("correcthorsebattery-dragon", "").band, "good");
}

console.log("password-strength: all assertions passed");