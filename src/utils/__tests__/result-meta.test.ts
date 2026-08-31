import assert from "node:assert/strict";
import {
  CONFIRMATIONS, DEPLOYMENTS, confirmationLabel, deploymentLabel,
  isLocked, safeDeployment, toConfirmation,
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
