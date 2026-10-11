import assert from "node:assert/strict";
import {
  CONFIRMATIONS, DEPLOYMENTS, confirmationLabel, deploymentLabel,
  isLocked, safeDeployment, toConfirmation,
  matchSetupFor, recordsMatchSetup,
} from "../result-meta";

// The six legacy deployments, and nothing else.
assert.equal(DEPLOYMENTS.length, 6);
assert.equal(deploymentLabel("hammer-and-anvil"), "Hammer and Anvil");
assert.equal(deploymentLabel("HAMMER-AND-ANVIL"), "Hammer and Anvil");
assert.equal(deploymentLabel("made up"), "");
assert.equal(deploymentLabel(null), "");

assert.equal(safeDeployment("dawn-of-war"), "dawn-of-war");
assert.equal(safeDeployment(" Dawn-Of-War "), "dawn-of-war");
assert.equal(safeDeployment("nonsense"), "", "never passes a value the check would reject");

// Anything unreadable is a submitted result, never a locked one: failing open
// here would let a bad value freeze somebody out of their own game.
assert.equal(toConfirmation("admin-confirmed"), "admin-confirmed");
assert.equal(toConfirmation("ADMIN-CONFIRMED"), "admin-confirmed");
assert.equal(toConfirmation(""), "submitted");
assert.equal(toConfirmation(undefined), "submitted");
assert.equal(toConfirmation("rubbish"), "submitted");
assert.equal(confirmationLabel("confirmed"), "Confirmed by both players");

// The lock, exactly as _can_update_booking_result draws it.
assert.equal(isLocked("submitted"), false);
assert.equal(isLocked("confirmed"), false, "agreed is not the same as settled");
assert.equal(isLocked("disputed"), true);
assert.equal(isLocked("admin-confirmed"), true);
assert.equal(isLocked("rubbish"), false);

assert.equal(CONFIRMATIONS.length, 4);
assert.ok(CONFIRMATIONS.every((c) => c.help.length > 0), "every state explains itself");

console.log("result-meta ok");

// 16a · the setup fields belong to 40k, and nothing else records them.
{
  // Every spelling `canonicalGame` folds, because a club types what it likes.
  for (const game of ["Warhammer 40,000", "warhammer 40k", "WARHAMMER 40K",
                      "  Warhammer 40,000  "]) {
    assert.equal(recordsMatchSetup(game), true, `recordsMatchSetup(${game})`);
  }

  // "40k" on its own is NOT one of them: `canonical-labels.json` folds
  // "warhammer 40k" and "warhammer 40,000" and nothing shorter, so a club
  // that types just "40k" gets no setup fields. Pinned because it looks like
  // an oversight and is the catalogue's own answer.
  for (const game of ["40k", "Blood Bowl", "Kill Team", "Age of Sigmar",
                      "", "  ", "kill game"]) {
    assert.equal(recordsMatchSetup(game), false, `recordsMatchSetup(${game})`);
  }
  assert.equal(recordsMatchSetup(null), false);
  assert.equal(recordsMatchSetup(undefined), false);

  const setup = { mission: "Purge the Foe", deployment: "dawn-of-war", terrain: "UKTC" };

  // 40k keeps what was typed.
  assert.deepEqual(matchSetupFor("Warhammer 40,000", setup), setup);

  // Anything else stores nothing, so a result corrected off 40k does not keep
  // a mission nobody can see or edit.
  assert.deepEqual(matchSetupFor("Blood Bowl", setup),
    { mission: "", deployment: "", terrain: "" });

  // An absent game is "not being changed", so the setup is left alone. The
  // club's own save posts no game at all on some paths.
  assert.deepEqual(matchSetupFor(undefined, setup), setup);

  // An empty game is a real answer and is not 40k.
  assert.deepEqual(matchSetupFor("", setup),
    { mission: "", deployment: "", terrain: "" });
}

console.log("result-meta 16a: all pass");
