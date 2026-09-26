import assert from "node:assert/strict";

import {
  BADGE_DESCRIPTION_MAX, BADGE_ICONS, BADGE_LABEL_MAX, BADGE_TONES, CLUB_TONES,
  DEFAULT_ICON, DEFAULT_TONE, isBadgeIcon, isBadgeTone, isClubTone, readIcon, readTone,
} from "../badge-style";

// Hand-copied from 0121_badges.sql. If the migration changes and this does not,
// a club saves a badge the database refuses, or the page renders a blank chip.
const SQL_ICONS = ["trophy", "medal", "shield", "star", "brush", "hammer", "handshake", "spark"];
const SQL_TONES = ["champion", "leader", "podium", "streak", "campaign", "club", "service"];
const SQL_LABEL_MAX = 40;
const SQL_DESCRIPTION_MAX = 160;

{
  assert.deepEqual([...BADGE_ICONS], SQL_ICONS, "icon set differs from the constraint");
  assert.deepEqual([...BADGE_TONES], SQL_TONES, "tone set differs from the constraint");
  assert.equal(BADGE_LABEL_MAX, SQL_LABEL_MAX);
  assert.equal(BADGE_DESCRIPTION_MAX, SQL_DESCRIPTION_MAX);
}

{
  // The defaults have to be in their own sets, or every fallback is a blank.
  assert.ok(isBadgeIcon(DEFAULT_ICON));
  assert.ok(isBadgeTone(DEFAULT_TONE));
  assert.ok(isClubTone(DEFAULT_TONE), "a club cannot pick its own default tone");
}

{
  // A club cannot hand out something that reads as "won the league".
  assert.equal(isClubTone("champion"), false);
  assert.equal(isClubTone("leader"), false);
  for (const tone of CLUB_TONES) {
    assert.ok(isBadgeTone(tone), `${tone} is offered but not a real tone`);
  }
  // But a competition tone still renders, so an existing badge cannot go blank.
  assert.equal(readTone("champion"), "champion");
}

{
  // A row written before a rename falls back rather than rendering nothing.
  assert.equal(readIcon("dragon"), DEFAULT_ICON);
  assert.equal(readIcon(""), DEFAULT_ICON);
  assert.equal(readIcon(null), DEFAULT_ICON);
  assert.equal(readIcon(undefined), DEFAULT_ICON);
  assert.equal(readTone("rainbow"), DEFAULT_TONE);
  assert.equal(readTone(null), DEFAULT_TONE);

  // And whitespace is not a different icon.
  assert.equal(readIcon("  star  "), "star");
  assert.equal(readTone(" club "), "club");

  // Case is, though: the column stores exactly what the constraint allows.
  assert.equal(isBadgeIcon("Star"), false);
  assert.equal(readIcon("Star"), DEFAULT_ICON);
}

{
  // No duplicates, or a picker shows the same choice twice.
  assert.equal(new Set(BADGE_ICONS).size, BADGE_ICONS.length);
  assert.equal(new Set(BADGE_TONES).size, BADGE_TONES.length);
  assert.equal(new Set(CLUB_TONES).size, CLUB_TONES.length);
}

console.log("badge-style: all assertions passed");
