import { factions, type Faction } from "@/lib/tokens";

/**
 * A club's visual identity, derived rather than stored.
 *
 * Clubs don't have brand colours in the data and asking eleven club owners to
 * pick one isn't realistic. Hashing the slug gives every club a stable colour
 * and monogram for free, and because the slug never changes, neither do they.
 */

export type ClubIdentity = {
  faction: Faction;
  /** One or two letters, e.g. "MW" for Mana Wharf. */
  monogram: string;
};

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Skips "the", "of" and similar so "The Lantern Guild" reads LG, not TL. */
const SKIP = new Set(["the", "of", "and", "at", "on", "a"]);

function monogramOf(name: string): string {
  const words = name
    .split(/[\s\-–—]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w && !SKIP.has(w.toLowerCase()));

  if (words.length === 0) return name.slice(0, 2).toUpperCase() || "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function clubIdentity(slug: string, name: string): ClubIdentity {
  return {
    faction: factions[hash(slug) % factions.length],
    monogram: monogramOf(name),
  };
}
