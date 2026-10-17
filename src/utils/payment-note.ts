/**
 * When a club takes the money.
 *
 * Nothing in this app charges anybody, so every screen that commits somebody
 * to a price has to say what happens next. Six of them said "on the day", in
 * six different wordings, and that is a promise the site cannot keep: plenty
 * of clubs collect in advance, and a member who has read "on the day" and is
 * then asked for the money a week early reads that as the club getting it
 * wrong rather than as the site having guessed.
 *
 * One sentence, so the booking panel, the coaching list and the three emails
 * cannot drift into three different promises about the same money.
 */
export function paymentNote(clubName?: string | null): string {
  // Named where the screen knows which club it is, so a ticket stub reads
  // "Didcot Wargames will contact you" rather than talking about clubs in
  // general on a page that is about exactly one of them.
  const who = clubName?.trim() || "The club";
  return `${who} will contact you for payment. `
    + "They take it either on the day or before the start date.";
}
