import assert from "node:assert/strict";
import {
  clubMediaPath, isClubMediaPath, rejectImage, fitWithin, MAX_EDGE,
  clubLogoUrl, submissionMediaPath,
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

// A listing being written has no club id, so its files go under the submission.
assert.equal(submissionMediaPath(12, "photos", "table.JPG", "abc"),
  "submissions/12/photos/abc.jpg");
assert.equal(submissionMediaPath(12, "logo", "badge.png", "xyz"),
  "submissions/12/logo/xyz.png");

// The logo resolves the same two ways a photo does.
const url = (bucket: string, path: string) => `https://cdn.test/${bucket}/${path}`;
assert.equal(clubLogoUrl({ logoPath: "clubs/9/logo/a.webp", logoUrl: null }, url),
  "https://cdn.test/club-media/clubs/9/logo/a.webp");
// An imported club keeps the absolute URL to a file we do not own.
assert.equal(clubLogoUrl({ logoPath: null, logoUrl: "/clubs/assets/old.jpg" }, url),
  "/clubs/assets/old.jpg");
// Ours wins where a club has both, because it is the one they chose last.
assert.equal(clubLogoUrl({ logoPath: "clubs/9/logo/a.webp", logoUrl: "/old.jpg" }, url),
  "https://cdn.test/club-media/clubs/9/logo/a.webp");
// Null rather than "", so every caller can test it the one way.
assert.equal(clubLogoUrl({ logoPath: null, logoUrl: null }, url), null);
assert.equal(clubLogoUrl({ logoPath: "   ", logoUrl: "  " }, url), null);
assert.equal(clubLogoUrl({}, url), null);

console.log("club-media: all assertions passed");
