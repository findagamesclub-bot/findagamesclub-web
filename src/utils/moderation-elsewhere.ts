/**
 * How many reports at this club a site admin is holding.
 *
 * The rule itself ("anything your own team wrote goes to a site admin") has
 * been on the club's queue since 0128, and the client still read a missing
 * report as a bug three times over. A rule is a general statement; what they
 * were looking for was one specific report. A number is what joins the two.
 *
 * Deliberately the whole sentence and not a figure the call site words,
 * because the wording is the point: it has to say the report exists, say who
 * has it, and say nothing about what it is.
 */

export type Elsewhere = { waiting: number; answered: number };

const they = (n: number) => (n === 1 ? "is" : "are");
const have = (n: number) => (n === 1 ? "has" : "have");

export function countLine({ waiting, answered }: Elsewhere): string {
  // "at your club", not "of yours": the reports are not the reader's own, and
  // on a screen that also shows a member's own reports elsewhere in the app,
  // "yours" is one word doing two jobs.
  if (waiting > 0 && answered > 0) {
    return `${waiting} at your club ${they(waiting)} with one now, and `
      + `${answered} ${have(answered)} been answered.`;
  }
  if (waiting > 0) {
    return `${waiting} at your club ${they(waiting)} with one now.`;
  }
  if (answered > 0) {
    return `${answered} at your club ${have(answered)} been answered by one.`;
  }
  // Never drawn: the caller only calls this when there is something to say.
  // Here so the function has one answer for every input rather than a hole.
  return "";
}
