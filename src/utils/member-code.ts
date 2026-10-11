/**
 * A member's own code, as it is typed and as it is read.
 *
 * Mirrors `fold_member_code` in 0177. The database is still the authority:
 * this exists so a screen can say "that is not a code" before a round trip,
 * and so the code is shown the same way everywhere it appears.
 */

/**
 * The digits, and the consonants other than L. Vowels go because a code is
 * printed on a results sheet and read aloud across a hall; 0, O, 1, I and L
 * go because they are what somebody transcribes wrongly off a phone.
 * Kept in step with 0177 by `member-code.test.ts`, which is the only thing
 * holding the two copies together.
 */
export const CODE_ALPHABET = "23456789BCDFGHJKMNPQRSTVWXYZ";

export const CODE_LENGTH = 8;

/** Hyphens and spaces are display, so they come out before anything compares. */
export function foldMemberCode(raw: string): string {
  return (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** `K7MP-3QXR`. Two chunks, because that is how somebody reads one aloud. */
export function formatMemberCode(code: string): string {
  const folded = foldMemberCode(code);
  if (folded.length !== CODE_LENGTH) return folded;
  return `${folded.slice(0, 4)}-${folded.slice(4)}`;
}

/**
 * Whether this is worth asking the server about.
 *
 * Length and alphabet only. A code that passes this may still belong to
 * nobody, which is a different answer and the server's to give.
 */
export function looksLikeMemberCode(raw: string): boolean {
  const folded = foldMemberCode(raw);
  return folded.length === CODE_LENGTH
    && [...folded].every((character) => CODE_ALPHABET.includes(character));
}

/**
 * What to say about a code somebody has typed, while they type it.
 *
 * Nothing until they have typed enough to be wrong about, because a red line
 * appearing on the first keystroke is an error message about an unfinished
 * thought. Null means say nothing.
 */
export function codeProblem(raw: string): string | null {
  const folded = foldMemberCode(raw);
  if (folded.length < CODE_LENGTH) return null;
  if (folded.length > CODE_LENGTH) {
    return `A member code is ${CODE_LENGTH} characters. That one is ${folded.length}.`;
  }
  const bad = [...folded].find((character) => !CODE_ALPHABET.includes(character));
  if (bad) {
    return `A member code never contains "${bad}". Check it against theirs.`;
  }
  return null;
}
