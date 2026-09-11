import assert from "node:assert/strict";
import {
  clubMediaPath, isClubMediaPath, rejectImage, fitWithin, MAX_EDGE,
} from "../club-media";

// The club id is the second folder, because that is what the storage policy reads.
assert.equal(clubMediaPath(9, "photos", "table.JPG", "abc"), "clubs/9/photos/abc.jpg");
assert.equal(clubMediaPath(9, "logo", "badge.webp", "xyz"), "clubs/9/logo/xyz.webp");

// A name with no extension still lands somewhere sensible.
assert.equal(clubMediaPath(1, "photos", "photo", "u"), "clubs/1/photos/u.jpg");
// And a hostile one cannot climb out of the folder.
assert.equal(clubMediaPath(1, "photos", "x.../../../etc", "u"), "clubs/1/photos/u.etc");

assert.equal(rejectImage({ type: "image/jpeg", size: 1000 }), null);
assert.match(rejectImage({ type: "image/gif", size: 10 }) ?? "", /JPEG, PNG or WebP/);
assert.match(rejectImage({ type: "image/png", size: 9e6 }) ?? "", /over 5MB/);

// Landscape, portrait and square all keep their shape.
assert.deepEqual(fitWithin(4000, 3000), { width: MAX_EDGE, height: 1200 });
assert.deepEqual(fitWithin(3000, 4000), { width: 1200, height: MAX_EDGE });
assert.deepEqual(fitWithin(4000, 4000), { width: MAX_EDGE, height: MAX_EDGE });
// Anything already small enough is left alone rather than blown up.
assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });

// Only this club's own files can be named for deletion.
assert.equal(isClubMediaPath("clubs/9/photos/a.webp", 9), true);
assert.equal(isClubMediaPath("clubs/9/logo/a.webp", 9), true);
assert.equal(isClubMediaPath("clubs/10/photos/a.webp", 9), false);
assert.equal(isClubMediaPath("clubs/9x/photos/a.webp", 9), false);
assert.equal(isClubMediaPath("clubs/9", 9), false);
assert.equal(isClubMediaPath("submissions/9/photos/a.webp", 9), false);
// And nothing can climb out of the folder or name it twice.
assert.equal(isClubMediaPath("clubs/9/../10/photos/a.webp", 9), false);
assert.equal(isClubMediaPath("clubs/9//a.webp", 9), false);

console.log("club-media: all assertions passed");
