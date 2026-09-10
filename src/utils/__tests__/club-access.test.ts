import assert from "node:assert/strict";
import {
  CAPABILITIES, clubAccess, isInvitableRole, toClubRole,
  type Capability, type ClubRole,
} from "../club-access";

/**
 * Transcribed by hand from club_role_capabilities() in 0067. The point is that
 * it is a copy: if either side is edited without the other, this fails.
 */
const SQL_MATRIX: Record<ClubRole, Capability[]> = {
  owner: [
    "listing.edit", "events.manage", "members.manage", "bookings.manage",
    "results.manage", "board.moderate", "shop.manage", "coaching.manage",
    "competitions.manage", "messages.club", "analytics.view",
    "team.manage", "billing.manage", "audit.view",
  ],
  admin: [
    "listing.edit", "events.manage", "members.manage", "bookings.manage",
    "results.manage", "board.moderate", "shop.manage", "coaching.manage",
    "competitions.manage", "messages.club", "analytics.view",
    "team.manage", "billing.manage", "audit.view",
  ],
  manager: [
    "listing.edit", "events.manage", "members.manage", "bookings.manage",
    "results.manage", "board.moderate", "shop.manage", "coaching.manage",
    "competitions.manage", "messages.club", "analytics.view", "audit.view",
  ],
  helper: ["bookings.manage", "results.manage", "board.moderate"],
};

for (const role of Object.keys(SQL_MATRIX) as ClubRole[]) {
  assert.deepEqual(
    [...CAPABILITIES[role]].sort(),
    [...SQL_MATRIX[role]].sort(),
    `${role} does not match club_role_capabilities() in 0067`,
  );
}

// A manager runs the club but cannot hand it on or see the money. This is the
// whole reason the role exists, so it is asserted rather than assumed.
const manager = clubAccess("manager");
assert.equal(manager.canManage, true);
assert.equal(manager.can("listing.edit"), true);
assert.equal(manager.can("team.manage"), false);
assert.equal(manager.can("billing.manage"), false);

// A helper runs the night. can_manage_club() is false for them, which is what
// keeps every policy that was written before roles existed shut.
const helper = clubAccess("helper");
assert.equal(helper.canManage, false);
assert.equal(helper.can("bookings.manage"), true);
assert.equal(helper.can("results.manage"), true);
assert.equal(helper.can("board.moderate"), true);
assert.equal(helper.can("listing.edit"), false);
assert.equal(helper.can("members.manage"), false);
assert.equal(helper.can("analytics.view"), false);

const owner = clubAccess("owner");
assert.equal(owner.canManage, true);
assert.equal(owner.can("team.manage"), true);
assert.equal(owner.can("billing.manage"), true);

// An admin holds every capability at every club, but is not the owner of one.
const admin = clubAccess("admin");
assert.equal(admin.canManage, true);
assert.equal(admin.can("billing.manage"), true);
assert.equal(admin.role, "admin");

// Nobody, which is what a visitor and an ordinary member both are here. A
// member's rights come from their membership, never from a team role.
const nobody = clubAccess(null);
assert.equal(nobody.canManage, false);
assert.equal(nobody.can("bookings.manage"), false);
assert.equal(nobody.role, null);

// An unknown string means the two copies have drifted. Treated as no role, so
// the failure is a missing button rather than an offered one that will bounce.
assert.equal(toClubRole("owner"), "owner");
assert.equal(toClubRole("helper"), "helper");
assert.equal(toClubRole(null), null);
assert.equal(toClubRole("superuser"), null);
assert.equal(toClubRole(""), null);

// Ownership moves by transfer, so it is never on the invite picker.
assert.equal(isInvitableRole("manager"), true);
assert.equal(isInvitableRole("helper"), true);
assert.equal(isInvitableRole("owner"), false);
assert.equal(isInvitableRole("admin"), false);

console.log("club-access: all assertions passed");
