import assert from "node:assert/strict";
import { copyRulesProblem, optionsProblem, unitShapeProblem } from "../unit-shape";

const ok = (problem: string, what: string) =>
  assert.equal(problem, "", `${what} should have been accepted, got: ${problem}`);

// --------------------------------------------------------------- real options
ok(optionsProblem([]), "an empty list");
ok(optionsProblem([{ label: "1 model", modelCount: 1, points: "165" }]), "one size");
ok(optionsProblem([
  { label: "5 models", modelCount: 5, points: "100" },
  { label: "10 models", modelCount: 10, points: "190" },
]), "two sizes");
// Points come through as numbers when somebody types them by hand.
ok(optionsProblem([{ label: "1 model", points: 165 }]), "numeric points");

// ------------------------------------------------ the mistake that was silent
{
  // The exact paste the client made: copy-cost rules in the Options box. It
  // saved without a word and then priced three copies at three times the base.
  const rules = [
    { fromCopy: 1, toCopy: 2, options: [{ label: "5 models", points: "100" }] },
    { fromCopy: 3, toCopy: null, options: [{ label: "5 models", points: "110" }] },
  ];
  assert.match(optionsProblem(rules), /copy costs.*belong in the Copy costs box/i);
}
{
  // And the same mistake the other way round.
  const options = [{ label: "5 models", modelCount: 5, points: "100" }];
  assert.match(copyRulesProblem(options), /options.*belong in the Options box/i);
}

// ------------------------------------------------------------- broken options
assert.match(optionsProblem("not a list"), /must be a list/);
assert.match(optionsProblem([1, 2]), /Option 1 is not an option/);
assert.match(optionsProblem([{ modelCount: 5 }]), /neither a label nor points/);
assert.match(optionsProblem([{ label: 5, points: "100" }]), /label that is not text/);
assert.match(optionsProblem([{ label: "a", points: "lots" }]), /points that are not a number/);
assert.match(optionsProblem([{ label: "a", points: "1", modelCount: 0 }]),
  /not a whole number of models/);

// ----------------------------------------------------------- real copy costs
ok(copyRulesProblem([]), "no rules at all");
ok(copyRulesProblem([
  { fromCopy: 1, toCopy: 2, options: [{ label: "1 model", points: "165" }] },
  { fromCopy: 3, toCopy: null, options: [{ label: "1 model", points: "175" }] },
]), "the Castigator shape");
// A single open-ended rule is legal: every copy costs the same.
ok(copyRulesProblem([{ fromCopy: 1, toCopy: null }]), "one open rule");

// --------------------------------------------------------- broken copy costs
assert.match(copyRulesProblem([{ fromCopy: 0, toCopy: 2 }]), /fromCopy of 1 or more/);
assert.match(copyRulesProblem([{ fromCopy: 3, toCopy: 1 }]), /toCopy before its fromCopy/);

// A gap is the dangerous one: the copies inside it fall back to the base
// points silently, which is the third copy costing the same as the first.
assert.match(
  copyRulesProblem([{ fromCopy: 1, toCopy: 2 }, { fromCopy: 5, toCopy: null }]),
  /starts at copy 5, but the rule before it ends at 2/);

// Not starting at one leaves the first copy unpriced in the same way.
assert.match(copyRulesProblem([{ fromCopy: 2, toCopy: null }]),
  /first rule has to start at 1/);

// Overlapping is the same fault seen from the other side.
assert.match(
  copyRulesProblem([{ fromCopy: 1, toCopy: 3 }, { fromCopy: 2, toCopy: null }]),
  /starts at copy 2, but the rule before it ends at 3/);

// Anything after an open-ended rule can never be reached.
assert.match(
  copyRulesProblem([{ fromCopy: 1, toCopy: null }, { fromCopy: 2, toCopy: 3 }]),
  /nothing can follow it/);

// A rule's own options are options, and are checked as such.
assert.match(
  copyRulesProblem([{ fromCopy: 1, toCopy: null, options: [{ label: "a", points: "no" }] }]),
  /Rule 1: Option 1 has points that are not a number/);

// ------------------------------------------------------------------- together
ok(unitShapeProblem([{ label: "1 model", points: "165" }], []), "a plain unit");
assert.match(unitShapeProblem([{ fromCopy: 1 }], []), /belong in the Copy costs box/);

console.log("unit-shape ok");
