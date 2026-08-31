import assert from "node:assert/strict";
import {
  MAX_IMAGE_BYTES, rejectImage, toPostImages, uploadPath,
} from "../post-images";

// Whatever the column holds, only usable pairs come back.
assert.deepEqual(toPostImages(null), []);
assert.deepEqual(toPostImages("not an array"), []);
assert.deepEqual(toPostImages([{ alt: "no path" }, {}]), []);
assert.deepEqual(
  toPostImages([{ path: " a/b.jpg ", alt: " My army " }]),
  [{ path: "a/b.jpg", alt: "My army" }]);

// Two, whatever a stale row happens to hold.
assert.equal(
  toPostImages([1, 2, 3].map((i) => ({ path: `a/${i}.jpg` }))).length, 2);

// Only images, and only small ones.
assert.equal(rejectImage({ type: "image/png", size: 1000 }), null);
assert.match(rejectImage({ type: "application/pdf", size: 10 }) ?? "", /not an image/);
assert.match(rejectImage({ type: "image/png", size: MAX_IMAGE_BYTES + 1 }) ?? "", /over 5MB/);
// Exactly at the limit is allowed, not rejected.
assert.equal(rejectImage({ type: "image/jpeg", size: MAX_IMAGE_BYTES }), null);

// The path starts with the uploader, which is what the storage policy checks.
assert.equal(uploadPath("me", "photo.JPG", "abc"), "me/abc.jpg");
// A name with no extension still gets one.
assert.equal(uploadPath("me", "photo", "abc"), "me/abc.jpg");
// And a hostile one cannot climb out of the folder.
assert.equal(uploadPath("me", "x.../../etc", "abc"), "me/abc.etc");
assert.equal(uploadPath("me", "x.j p g!", "abc"), "me/abc.jpg");

console.log("post-images ok");
