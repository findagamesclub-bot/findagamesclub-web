/**
 * Why the points box stops where it stops.
 *
 * The client set Didcot's Premium tier to cover 10% of a bill with points and
 * read the box on a table booking offering 9, then 27 on merchandise, 95 on
 * event tickets and 36 on coaching, and asked where those numbers were being
 * set. They are all the same rule: a tier covers a share of the bill, so the
 * number of points that fits changes with the bill. 10% of £4.50 at 5p a point
 * is 9 points; 10% of £47.50 is 95.
 *
 * Nothing on the screen said that. "Up to 9 on this one" is the answer to a
 * question nobody asked, and a bare 9 next to a balance of 1,208 reads as a
 * limit somebody typed.
 *
 * Which of the two bounds bit is worked out from the numbers rather than
 * passed in: the maximum is the lower of what they hold and what the share
 * allows, so a maximum below the balance means the share is what stopped it.
 */

export function pointsCapNote(
  held: number, max: number, capPercent: number,
): string {
  const have = Math.max(0, Math.floor(held)).toLocaleString("en-GB");
  const most = Math.max(0, Math.floor(max));

  // Their balance is the lower of the two, so the share never came into it.
  if (most >= held) {
    return `You have ${have}, and all of them can go on this one.`;
  }

  const share = Math.max(0, Math.min(100, Math.floor(capPercent)));
  if (share >= 100) {
    return `You have ${have}. Up to ${most} here, which is the whole bill.`;
  }

  return `You have ${have}. Up to ${most} here, which is ${share}% of this bill.`;
}
