import assert from "node:assert/strict";
import { shouldSync } from "../../hooks/useWhenChanged";

// The bug this pins. The first version seeded "seen" with the first render's
// keys, so the sync never ran on mount, where the effect it replaced always
// did. TicketDialog holds its quantity as its own state starting at "", filled
// by that sync, so the box came up empty on every edit and pressing Update
// wrote "no limit" over whatever the club had set.
assert.equal(shouldSync(null, ["anything"]), true, "must run on mount");
assert.equal(shouldSync(null, []), true, "even with no keys at all");

// After that it behaves like an effect's dependency array.
assert.equal(shouldSync([1, "a"], [1, "a"]), false);
assert.equal(shouldSync([1, "a"], [2, "a"]), true);
assert.equal(shouldSync([1, "a"], [1, "b"]), true);

// Identity, not deep equality, which is what useEffect does too. Two objects
// that look the same are two different keys.
const row = { id: 1 };
assert.equal(shouldSync([row], [row]), false);
assert.equal(shouldSync([{ id: 1 }], [{ id: 1 }]), true);

// A key list that changes length is a different list.
assert.equal(shouldSync([1], [1, 2]), true);
assert.equal(shouldSync([1, 2], [1]), true);

// Object.is, so NaN matches itself and the two zeroes do not match each other.
assert.equal(shouldSync([NaN], [NaN]), false);
assert.equal(shouldSync([0], [-0]), true);

console.log("when-changed ok");
