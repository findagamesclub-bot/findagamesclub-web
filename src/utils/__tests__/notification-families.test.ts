import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FAMILIES, FAMILY_META, allKinds, defaultsFor, emailOffFamilies, familyFor,
  kindsIn,
} from "../notification-families";

// ------------------------------------------------------------- the map holds
{
  // Every family has something in it. A family with no kinds is a switch that
  // does nothing, which is worse than no switch at all.
  for (const family of FAMILIES) {
    assert.ok(kindsIn(family).length > 0, `${family} covers no kinds`);
  }
  // And nothing is in two families, or `kindsIn` is lying about coverage.
  const counted = FAMILIES.flatMap(kindsIn);
  assert.equal(counted.length, new Set(counted).size);
  assert.equal(counted.length, allKinds().length);
}

// ------------------------------------------------------ an unmapped kind is on
{
  // The whole safety net. A feature shipped next year sends its email until
  // somebody decides where it belongs, rather than being muted by silence.
  assert.equal(familyFor("something-invented-later"), null);
  assert.equal(familyFor(""), null);
  assert.equal(familyFor("  message  "), "replies");
}

// ------------------------------------------------------------------- defaults
{
  // The bell is always on by default: it costs nobody anything and it is the
  // record of what happened. Email is the one that lands in a pocket.
  for (const family of FAMILIES) {
    assert.equal(defaultsFor(family).bell, true);
  }
  assert.equal(defaultsFor("money").email, true);
  assert.equal(defaultsFor("bookings").email, true);
  assert.equal(defaultsFor("membership").email, false);
  assert.equal(defaultsFor("running").email, false);
}

// ------------------------------------------------------------ only one locked
{
  const locked = FAMILIES.filter((f) => FAMILY_META[f].locked);
  assert.deepEqual(locked, ["replies"]);
  // A locked family that defaults email off would be locked to off, which is
  // the opposite of what the copy promises.
  assert.equal(FAMILY_META.replies.emailByDefault, true);
}

// ------------------------------------- a missing row is a default, not an off
/**
 * The bug this pins, found in testing.
 *
 * "Your clubs" defaults to email off. The settings card applied that default
 * and showed the switch off; the sender looked only for rows saying
 * `email = false`, found none, and sent the email anyway. The member saw a
 * switch that was off and an email in their inbox at the same time.
 */
{
  // Somebody who has never opened the screen. Both default-off families are
  // off, and nothing else is.
  const fresh = emailOffFamilies([]);
  assert.deepEqual([...fresh].sort(), ["membership", "running"]);

  // Turning a default-off family on takes it out of the set.
  assert.equal(emailOffFamilies([{ family: "membership", email: true }])
    .has("membership"), false);

  // And turning a default-on family off puts it in.
  assert.equal(emailOffFamilies([{ family: "bookings", email: false }])
    .has("bookings"), true);

  // A locked family is never off, whatever a stale row says. The server
  // refuses to write one, but a row from before the lock existed must not
  // silence a reply.
  assert.equal(emailOffFamilies([{ family: "replies", email: false }])
    .has("replies"), false);

  // A family nobody has heard of is ignored rather than crashing the send.
  assert.deepEqual([...emailOffFamilies([{ family: "invented", email: false }])].sort(),
    ["membership", "running"]);
}

// -------------------------------------------- every kind the database sends
/**
 * The check that keeps this file honest.
 *
 * The map is written by hand and the senders are forty-five `notify_person`
 * calls spread over a hundred migrations, so the only thing stopping the two
 * drifting apart is a test that reads the migrations. Adding a kind without
 * placing it fails here, at the point where the decision is cheap.
 */
{
  const dir = join(process.cwd(), "supabase", "migrations");
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");

  const sent = new Set<string>();
  // notify_person(target, 'kind', …). The target argument may be an expression
  // with no comma in it, which every call site satisfies.
  for (const [, kind] of sql.matchAll(/notify_person\(\s*[^,]+,\s*'([a-z_-]+)'/g)) {
    sent.add(kind);
  }
  // A handful are passed by name instead.
  for (const [, kind] of sql.matchAll(/p_kind\s*(?::=|=>)\s*'([a-z_-]+)'/g)) {
    sent.add(kind);
  }

  assert.ok(sent.size > 30, `only found ${sent.size} kinds, the grep is wrong`);

  const unmapped = [...sent].filter((kind) => familyFor(kind) === null).sort();
  assert.deepEqual(unmapped, [], `unmapped notification kinds: ${unmapped.join(", ")}`);
}

console.log("notification-families ok");
