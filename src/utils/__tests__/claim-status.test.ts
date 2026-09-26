import assert from "node:assert/strict";

import {
  CLAIM_STATUSES, CLAIM_TABS, adminCanAnswer, claimLabel, claimTone,
  claimantCanWithdraw, claimantNextStep, isClaimStatus,
} from "../claim-status";

{
  for (const s of CLAIM_STATUSES) {
    assert.ok(claimLabel(s), `${s} has no label`);
    assert.doesNotMatch(claimLabel(s), /_/, `${s} leaks the column value`);
    assert.ok(claimTone(s), `${s} has no tone`);
    assert.ok(claimantNextStep(s).length > 0, `${s} tells the claimant nothing`);
  }
  assert.equal(claimLabel("teleported"), "teleported");
  assert.equal(isClaimStatus("teleported"), false);
}

{
  // One state is work, and it is the same one either side can act on.
  assert.deepEqual(CLAIM_STATUSES.filter(adminCanAnswer), ["open"]);
  assert.deepEqual(CLAIM_STATUSES.filter(claimantCanWithdraw), ["open"]);

  assert.equal(CLAIM_TABS[0]!.key, "open");
  assert.equal(CLAIM_TABS[CLAIM_TABS.length - 1]!.key, "all");
  for (const tab of CLAIM_TABS) {
    assert.ok(tab.key === "all" || isClaimStatus(tab.key), `${tab.key} is not a status`);
  }
}

{
  assert.match(claimantNextStep("declined", { note: "We could not confirm it." }),
    /could not confirm it/);
  assert.match(claimantNextStep("approved", { club: "Leeds Meeple" }), /Leeds Meeple/);
  // And they still say something useful with nothing to quote.
  assert.ok(claimantNextStep("declined").length > 0);
  assert.ok(claimantNextStep("approved").length > 0);
}

console.log("claim-status: all assertions passed");
