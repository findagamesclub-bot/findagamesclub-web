/**
 * Why this page shows fewer clubs than My clubs does.
 *
 * The client has asked three times, most recently: "Is the Your club listings
 * page below only showing 4 out of the 8 clubs Sara has, as the others were
 * created with the site originally and not via the approval process on the
 * site? Or why else does this below page not show all 8?"
 *
 * They are right, and they worked it out themselves. The two pages read
 * different tables on purpose: My clubs is `club_team`, every club you RUN,
 * and this one is `club_submissions`, every club you ASKED us to list. A club
 * an admin set up and handed over, or one you help somebody else run, is on
 * the first and was never on the second.
 *
 * Saying that in prose was not enough, twice. What the client actually does is
 * count one list against the other, so the page now does that sum for them and
 * prints both numbers. A reader who can see "8 clubs, 4 of them started here"
 * has nothing left to work out.
 *
 * Pure so the wording can be tested: every count has a singular, and "1 clubs"
 * is the mistake this codebase has already shipped once.
 */
export function listingsVersusClubs(
  { runs, fromHere }: { runs: number; fromHere: number },
): string | null {
  // Nothing to reconcile for somebody who runs no clubs: there is no second
  // list for them to be confused by, and a sentence about one would invent
  // the confusion it is trying to prevent.
  if (runs < 1) return null;

  const elsewhere = Math.max(0, runs - fromHere);
  const clubs = runs === 1 ? "1 club" : `${runs} clubs`;

  if (elsewhere === 0) {
    return `You run ${clubs}, and ${runs === 1 ? "it" : "all of them"} started `
      + "as a request here.";
  }

  if (fromHere === 0) {
    const none = runs === 1
      ? "it did not start as a request here"
      : "none of them started as a request here";
    return `You run ${clubs}, and ${none}, so there is nothing on this page `
      + `about ${runs === 1 ? "it" : "them"}. Clubs set up for you, or handed `
      + "to you to run, live on My clubs instead.";
  }

  const other = elsewhere === 1 ? "The other one was" : `The other ${elsewhere} were`;
  return `You run ${clubs} and ${fromHere} of them started as a request here. `
    + `${other} set up another way, by an admin or handed to you to run, so `
    + "there is no request here to show. All of them are on My clubs.";
}
