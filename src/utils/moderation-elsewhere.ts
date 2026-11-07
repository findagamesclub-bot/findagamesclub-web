/**
 * How many reports at this club a site admin is holding.
 *
 * The rule itself has been on the club's queue since 0128, and the client
 * still read a missing report as a bug. A rule is a general statement; what
 * they were looking for was one specific report. A number is what joins the
 * two.
 *
 * **The number has to say which list it is about.** It sits directly under
 * tabs reading "Waiting 6 · Answered 6 · All 12" and said "13 at your club are
 * with one now, and 5 have been answered", so the client read two counts of
 * two different sets as one count contradicting itself: "the below text
 * mentions 13 reports, 5 answered, however only 12 are showing and 6 answered
 * in the filters?" Both were right. Neither said what it was counting.
 *
 * So it names the other queue in the same breath as the figure, and the word
 * "here" never appears in it: these are the ones that are NOT here.
 *
 * Deliberately the whole sentence and not a figure the call site words,
 * because the wording is the point: it has to say the report exists, say who
 * has it, and say nothing about what it is.
 */

export type Elsewhere = { waiting: number; answered: number };

const they = (n: number) => (n === 1 ? "is" : "are");
const have = (n: number) => (n === 1 ? "has" : "have");

export function countLine({ waiting, answered }: Elsewhere): string {
  // "of those" leans on the sentence in front of it, which names what goes to
  // a site admin. The figure is useless without that: a bare number over a
  // tab row of different numbers is what the client read as a contradiction.
  const some = (n: number) => `${n} of those`;

  // One tail for all three forms, because the thing that was missing is the
  // same in all three: which list the number is about. Writing it per branch
  // is how "1 of those has ... and are not counted" happened once already.
  const tail = " None of these are counted in the tabs above.";

  if (waiting > 0 && answered > 0) {
    return `${some(waiting)} ${they(waiting)} with a site admin now, `
      + `and ${answered} more ${have(answered)} been answered there.${tail}`;
  }
  if (waiting > 0) {
    return `${some(waiting)} ${they(waiting)} with a site admin now.${tail}`;
  }
  if (answered > 0) {
    return `${some(answered)} ${have(answered)} been answered by a site admin.${tail}`;
  }
  // Never drawn: the caller only calls this when there is something to say.
  // Here so the function has one answer for every input rather than a hole.
  return "";
}
