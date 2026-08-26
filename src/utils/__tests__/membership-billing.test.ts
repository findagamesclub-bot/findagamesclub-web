/**
 * Billing rules that decide what a club is owed.
 *
 * Run with: npx tsx src/utils/__tests__/membership-billing.test.ts
 * Every case here is a bug that reached the app once.
 */

import { standing } from "../membership-billing";
import type { MembershipPayment } from "@/types/payment";

const day = 86_400_000;
const iso = (offset: number) => new Date(Date.now() + offset * day).toISOString();

const pay = (o: Partial<MembershipPayment>): MembershipPayment => ({
  id: 1, tierKey: "basic", tierLabel: "Basic", billingOptionLabel: "Monthly",
  price: "£10", priceDuration: "month", periodStart: iso(-30), periodEnd: iso(0),
  note: null, recordedAt: iso(-30), ...o,
});

let failed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        got ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`}`);
}

// The exact bug the review found: money paid on Basic must not make Premium look paid.
const upgraded = [pay({ tierKey: "basic", periodEnd: iso(300), recordedAt: iso(-30) })];
check("Basic's year does not cover Premium",
  standing(upgraded, "premium-membership", iso(-1)).paidThrough, null);

check("Basic's year still covers Basic",
  standing(upgraded, "basic", iso(-60)).paidThrough !== null, true);

// Basic -> Premium -> Basic must not resurrect the first Basic payments.
check("old Basic payment ignored after re-assignment",
  standing(upgraded, "basic", iso(-1)).paidThrough, null);

// One-off is scoped too: a one-off on Basic must not block Premium's one-off.
const oneOff = [pay({ tierKey: "basic", priceDuration: "one-off", periodEnd: null, recordedAt: iso(-30) })];
check("Basic one-off does not settle Premium",
  standing(oneOff, "premium-membership", iso(-1)).settledOneOff, false);
check("Basic one-off does settle Basic",
  standing(oneOff, "basic", iso(-60)).settledOneOff, true);

// A historic one-off must not hide a lapse on the tier they hold now.
const lapsedAfterOneOff = [
  pay({ tierKey: "basic", priceDuration: "one-off", periodEnd: null, recordedAt: iso(-200) }),
  pay({ id: 2, tierKey: "premium-membership", periodEnd: iso(-5), recordedAt: iso(-35) }),
];
const s = standing(lapsedAfterOneOff, "premium-membership", iso(-100));
check("lapse on current tier is visible despite an old one-off",
  { overdue: s.overdue, settledOneOff: s.settledOneOff }, { overdue: true, settledOneOff: false });

// Timestamp formats Postgres may return must sort as instants, not strings.
const mixed = [
  pay({ id: 1, periodEnd: "2026-09-20T12:00:00+00:00", recordedAt: iso(-30) }),
  pay({ id: 2, periodEnd: "2026-10-20T12:00:00Z", recordedAt: iso(-1) }),
];
check("max period picks the later instant across formats",
  standing(mixed, "basic", iso(-60)).paidThrough, "2026-10-20T12:00:00Z");

console.log(failed ? `\n${failed} FAILING` : "\nall passing");
process.exit(failed ? 1 : 0);
