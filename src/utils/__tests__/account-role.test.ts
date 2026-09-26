import assert from "node:assert/strict";

import { STANDINGS, standingOf, type AccountStanding } from "../account-role";

const base = { role: "member", active: true, clubsOwned: 0, memberships: 0, teamRoles: "" };

{
  // Suspended beats everything, because it decides whether the rest applies.
  assert.equal(standingOf({ ...base, active: false }), "suspended");
  assert.equal(standingOf({ ...base, active: false, role: "admin" }), "suspended");
  assert.equal(standingOf({ ...base, active: false, clubsOwned: 3 }), "suspended");
}

{
  assert.equal(standingOf({ ...base, role: "admin" }), "admin");
  assert.equal(standingOf({ ...base, clubsOwned: 1 }), "owner");
  assert.equal(standingOf({ ...base, memberships: 2 }), "member");
  assert.equal(standingOf(base), "none");
}

{
  // The exact strings 0081 builds: "Owner of X" and "<Role> at X", joined
  // with " · ". If that migration rewords them, this is what says so.
  assert.equal(standingOf({ ...base, teamRoles: "Owner of Didcot Wargames" }), "owner");
  assert.equal(standingOf({ ...base, teamRoles: "Manager at Didcot Wargames" }), "manager");
  assert.equal(standingOf({ ...base, teamRoles: "Helper at Didcot Wargames" }), "helper");

  // Highest wins when somebody holds several.
  assert.equal(
    standingOf({ ...base, teamRoles: "Helper at A · Owner of B" }), "owner");
  assert.equal(
    standingOf({ ...base, teamRoles: "Helper at A · Manager at B" }), "manager");

  // A club whose NAME contains the word must not promote anybody. This is the
  // whole risk of reading a standing out of a display string.
  assert.equal(standingOf({ ...base, teamRoles: "Helper at The Owner of Hull" }), "helper");
  assert.equal(standingOf({ ...base, teamRoles: "Member at Manager at Arms Club" }), "none");
}

{
  // Every standing has a colour, and every one but "none" has a word, because
  // a border colour on its own is not something a reader can look up.
  const all: AccountStanding[] =
    ["suspended", "admin", "owner", "manager", "helper", "member", "none"];
  for (const one of all) {
    assert.ok(STANDINGS[one], `${one} has no styling`);
    assert.match(STANDINGS[one].border, /^#[0-9A-Fa-f]{6}$/, `${one} has no border colour`);
    if (one !== "none") assert.ok(STANDINGS[one].label, `${one} has no label`);
  }
  assert.equal(STANDINGS.none.label, null);

  // Distinct borders, or the colour coding says nothing.
  const borders = all.filter((k) => k !== "none").map((k) => STANDINGS[k].border);
  assert.equal(new Set(borders).size, borders.length, "two standings share a colour");

  // Only the two that matter are filled. Fill everything and nothing stands out.
  assert.equal(STANDINGS.member.fill, null);
  assert.equal(STANDINGS.none.fill, null);
  for (const one of ["suspended", "admin", "owner", "manager", "helper"] as const) {
    assert.ok(STANDINGS[one].fill, `${one} should be filled`);
  }
}

console.log("account-role: all assertions passed");
