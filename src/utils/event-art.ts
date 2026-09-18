/**
 * Which picture an event shows.
 *
 * An event can carry its own since Stage 3. Before that none could, so both
 * read paths took the club's first photo and the event's own `logo_src` was
 * written by the editor and never read again: a club uploaded a poster, saw it
 * in the editor, and found its clubhouse photo on the public page.
 *
 * Falling back to the club is deliberate and is what every imported event
 * relies on. `ClubArt` draws a monogram plate when there is neither, so a
 * grey box is never the answer.
 */

export type Art = { src: string; alt: string };

export function eventArt(
  event: { logoSrc: string | null; logoAlt: string | null; title: string },
  clubImage: Art | null,
): Art | null {
  const src = (event.logoSrc ?? "").trim();
  if (!src) return clubImage;

  // A picture a screen reader cannot describe is worse than one it can, and
  // the event's name is the honest description when nobody wrote one.
  return { src, alt: (event.logoAlt ?? "").trim() || event.title };
}
