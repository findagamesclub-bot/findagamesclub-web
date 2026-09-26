/**
 * What a club badge can look like.
 *
 * Two closed sets, not free text. An icon name the front end does not know
 * renders nothing, and a tone it does not know renders a transparent chip, so
 * both are checked by constraint in 0121 as well as here. That means this file
 * and the SQL are the same list twice: `__tests__/badge-style.test.ts` asserts
 * against a hand-copied transcription of the constraint, the way
 * `club-access.ts` does for the capability matrix. Edit one without the other
 * and the test goes red.
 *
 * Icons rather than uploaded art, decided with the client. Nothing to moderate,
 * nothing to store, and a row of badges keeps looking like it belongs to this
 * site rather than to eleven different clubs.
 */

/** The five legacy competition tones, plus two for a club's own badges. */
export const BADGE_TONES = [
  "champion", "leader", "podium", "streak", "campaign", "club", "service",
] as const;

export type BadgeToneKey = (typeof BADGE_TONES)[number];

/**
 * The five a club may choose from. The other two belong to competitions and are
 * awarded by the rules in `competition-badges.ts`, so offering them here would
 * let a club hand out something that reads as "won the league".
 */
export const CLUB_TONES: BadgeToneKey[] = ["club", "service", "podium", "streak", "campaign"];

export const BADGE_ICONS = [
  "trophy", "medal", "shield", "star", "brush", "hammer", "handshake", "spark",
] as const;

export type BadgeIcon = (typeof BADGE_ICONS)[number];

export const DEFAULT_ICON: BadgeIcon = "star";
export const DEFAULT_TONE: BadgeToneKey = "club";

export function isBadgeIcon(value: string): value is BadgeIcon {
  return (BADGE_ICONS as readonly string[]).includes(value);
}

export function isBadgeTone(value: string): value is BadgeToneKey {
  return (BADGE_TONES as readonly string[]).includes(value);
}

/**
 * What a club is allowed to pick. A competition tone stored on a club badge is
 * still rendered, because an old row must not go blank, but it cannot be chosen.
 */
export function isClubTone(value: string): value is BadgeToneKey {
  return (CLUB_TONES as readonly string[]).includes(value);
}

/** Falls back rather than rendering nothing, for a row written before a rename. */
export function readIcon(value: string | null | undefined): BadgeIcon {
  const one = String(value ?? "").trim();
  return isBadgeIcon(one) ? one : DEFAULT_ICON;
}

export function readTone(value: string | null | undefined): BadgeToneKey {
  const one = String(value ?? "").trim();
  return isBadgeTone(one) ? one : DEFAULT_TONE;
}

/** What a club may type. Longer than this is a description, not a badge. */
export const BADGE_LABEL_MAX = 40;
export const BADGE_DESCRIPTION_MAX = 160;
