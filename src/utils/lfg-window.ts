/**
 * Which club nights a looking-for-a-game advert may name.
 *
 * A tier allows a member to advertise a set number of nights ahead, and the
 * window is counted in nights they could actually BOOK, not in nights on the
 * calendar. Legacy builds the same list from `canBook` before slicing
 * (club_store.py:3663).
 *
 * Counting every night instead is a quiet failure: a club whose next two
 * evenings are full offers the advert nowhere at all, however many free tables
 * stand behind them. That is what the client saw — one date where there should
 * have been several.
 *
 * Lived in two places, the calendar that draws the button and the service that
 * accepts the post, and they had drifted: one deduped dates and the other did
 * not. One rule now, so they cannot disagree again.
 */
export function postingWindow(bookableDates: string[], allowed: number): string[] {
  // A club with two sessions on one evening must not have that evening count
  // twice against the window.
  const nights: string[] = [];
  for (const date of bookableDates) if (date && !nights.includes(date)) nights.push(date);

  // Zero means no limit, which is legacy's own reading: it skips the check
  // entirely rather than treating nought as none.
  return allowed > 0 ? nights.slice(0, allowed) : nights;
}
