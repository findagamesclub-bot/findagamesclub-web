/**
 * A section's anchor, derived from its title.
 *
 * Derived rather than hand-written so a shortcut nav and the section it points
 * at cannot drift apart: rename the section and the link follows.
 */
export function sectionId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
