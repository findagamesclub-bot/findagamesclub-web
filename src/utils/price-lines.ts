import { formatPounds } from "./format";

/**
 * What a club charged, and what came off it.
 *
 * Every paid thing in this app freezes the same seven figures at the moment
 * somebody commits: table bookings (0014), event tickets (0015), merchandise
 * (0038) and coaching (0157) all carry a subtotal, the tier that was held, its
 * percentage and amount, the points spent and what they were worth, and the
 * total. The checkout screens have always shown all of it and the dashboards
 * afterwards showed a bare total, so a member could see what they agreed to
 * pay and never why.
 *
 * One reading, so the breakdown at the desk and the breakdown a week later
 * cannot say different things about the same booking.
 */
export type Priced = {
  /** Before anything came off. */
  subtotal: number;
  /** The tier held at the time, as it was written then. */
  tierLabel: string | null;
  tierPercent: number;
  tierAmount: number;
  /** How many loyalty points went on it, and what they were worth. */
  points: number;
  pointsAmount: number;
  total: number;
  currency?: string;
};

export type PriceRow = {
  key: "subtotal" | "tier" | "points" | "total";
  label: string;
  value: string;
  /** A saving reads as a saving. The total reads as the answer. */
  saving?: boolean;
};

/**
 * The rows, in the order money comes off.
 *
 * A line is only drawn when it did something: a member on no tier should not
 * read "0% off", and a booking nobody spent points on should not carry a
 * points line at zero. Both would be the screen reporting a rule that did not
 * apply, which is the mistake `pointsCapNote` already had to fix once.
 */
export function priceRows(
  priced: Priced,
  labels: { subtotal?: string; total?: string } = {},
): PriceRow[] {
  const money = (amount: number) => formatPounds(amount, priced.currency ?? "GBP");
  const rows: PriceRow[] = [
    { key: "subtotal", label: labels.subtotal ?? "Subtotal", value: money(priced.subtotal) },
  ];

  if (priced.tierAmount > 0) {
    rows.push({
      key: "tier",
      // The wording the ticket drawer and the shop bag already use, so the
      // dashboard afterwards is recognisably the same line.
      label: `${priced.tierLabel || "Member"} discount${
        priced.tierPercent > 0 ? ` · ${priced.tierPercent}%` : ""}`,
      value: `− ${money(priced.tierAmount)}`,
      saving: true,
    });
  }

  if (priced.pointsAmount > 0) {
    rows.push({
      key: "points",
      label: `${priced.points} ${priced.points === 1 ? "point" : "points"}`,
      value: `− ${money(priced.pointsAmount)}`,
      saving: true,
    });
  }

  rows.push({ key: "total", label: labels.total ?? "Total", value: money(priced.total) });
  return rows;
}

/** Everything that came off, which is not the tier discount on its own. */
export function savedAmount(priced: Priced): number {
  return (priced.tierAmount || 0) + (priced.pointsAmount || 0);
}

/**
 * The same facts on one line, for a row with no room for four.
 *
 * Named separately rather than added together. The merchandise card used to
 * sum them and print the result as "£5.70 off as Premium Membership", which
 * credited a tier with a saving the member had paid for out of their own
 * points, and made the arithmetic on the card impossible to follow.
 */
export function savedLine(priced: Priced): string | null {
  const money = (amount: number) => formatPounds(amount, priced.currency ?? "GBP");
  const parts: string[] = [];

  if (priced.tierAmount > 0) {
    parts.push(`${money(priced.tierAmount)} off as ${priced.tierLabel || "a member"}`);
  }
  if (priced.pointsAmount > 0) {
    parts.push(`${money(priced.pointsAmount)} off with ${priced.points} ${
      priced.points === 1 ? "point" : "points"}`);
  }

  return parts.length ? parts.join(" · ") : null;
}

/** Whether there is anything to explain at all. A full price needs no rows. */
export function hasBreakdown(priced: Priced): boolean {
  return savedAmount(priced) > 0;
}
