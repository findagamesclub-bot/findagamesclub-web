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
 *
 * `logoSrc` is a RESOLVED url, not the column. Since 0087 an event's picture
 * can live in our own bucket as `logo_path` with `logo_src` empty, and this
 * read only the column: an uploaded poster left `logo_src` blank, so the event
 * silently went on showing the club's photo. Every caller resolves the pair
 * through `clubImageUrl` first, the same way a club's own photo is resolved
 * once at the service boundary.
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
