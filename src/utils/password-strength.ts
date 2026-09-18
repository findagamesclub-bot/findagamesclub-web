/**
 * How strong a password is, and whether it is allowed at all.
 *
 * Legacy's rule is a length check and nothing else: 12 to 128 characters, not
 * made only of spaces (`_validate_password`, holiday_store.py:1010). That rule
 * is kept exactly, including its wording, because it is what the client's
 * accounts are already held to.
 *
 * The score on top of it is the client's ask. It exists to tell somebody their
 * password is weak while they can still do something about it, not to add a
 * second rule they have to satisfy: a 12-character password that scores Weak is
 * still refused only if it fails legacy's check. The form blocks below Fair,
 * which is a deliberate decision recorded in the plan rather than a legacy
 * behaviour.
 *
 * Deliberately not a library. zxcvbn is 400KB on a sign-up page, and the thing
 * it is better at, guessing dictionary words, is not what stops the passwords
 * people actually choose here.
 */

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

/** Legacy's own hint, so the field says what the server will enforce. */
export const PASSWORD_HINT =
  `Use ${PASSWORD_MIN} to ${PASSWORD_MAX} characters. Passphrases and spaces are allowed.`;

export type Band = "weak" | "fair" | "good" | "strong";

export type Strength = {
  /** 0 to 4, for the bar. */
  score: number;
  band: Band;
  /** The legacy refusal, when it applies. Null when the password is allowed. */
  refusal: string | null;
  /** One thing they could do to improve it, or null when it is strong. */
  advice: string | null;
};

export const BAND_LABELS: Record<Band, string> = {
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
};

/**
 * The passwords people pick when a site asks for twelve characters.
 *
 * Short on purpose. A 10,000 word list is a download; these are the shapes that
 * actually turn up, and the length and variety checks catch the rest.
 */
const COMMON = [
  "password", "passw0rd", "letmein", "welcome", "qwerty", "abc123", "iloveyou",
  "admin", "monkey", "dragon", "football", "baseball", "sunshine", "princess",
  "changeme", "trustno1", "starwars", "whatever", "freedom", "master",
];

/** Runs of the same character, or a straight run up or down the keyboard. */
function isRepetitive(value: string): boolean {
  if (/(.)\1{3,}/.test(value)) return true;

  let runs = 0;
  for (let i = 2; i < value.length; i++) {
    const a = value.charCodeAt(i - 2);
    const b = value.charCodeAt(i - 1);
    const c = value.charCodeAt(i);
    if ((b - a === 1 && c - b === 1) || (a - b === 1 && b - c === 1)) runs++;
  }
  return runs >= 3;
}

/**
 * The names in an email worth checking a password against.
 *
 * Not just the part before the @. A plus tag is not part of who somebody is:
 * `gulnabidev+newclub@gmail.com` is still gulnabidev, and comparing against the
 * whole tagged string meant `gulnabidev1234` never matched and was allowed.
 * Every plus-addressed account on this site escaped the check.
 *
 * Dots go the same way, because Gmail ignores them and people type their own
 * name with and without: `sam.whitfield@` should catch `samwhitfield2026`.
 */
function emailNames(email: string): string[] {
  const local = email.split("@")[0]?.trim().toLowerCase() ?? "";
  if (!local) return [];

  const root = local.split("+")[0] ?? "";
  return [...new Set([local, root, root.replace(/\./g, "")])]
    // Three characters is too short to be meaningful: an address starting
    // "ann" would fail every password with "ann" anywhere in it.
    .filter((name) => name.length >= 4);
}

/**
 * Score a password, optionally against the email it is being set for.
 *
 * The email matters: "gulnabi2026" is a fine-looking password until you know
 * the address it is protecting.
 */
export function strength(password: string, email = ""): Strength {
  const value = String(password ?? "");
  const folded = value.toLowerCase();

  // Legacy's rule first, so its message is what somebody sees at the boundary.
  const refusal =
    value.length < PASSWORD_MIN
      ? `Password must be at least ${PASSWORD_MIN} characters long.`
      : value.length > PASSWORD_MAX
        ? `Password must be ${PASSWORD_MAX} characters or fewer.`
        : !value.trim()
          ? "Password cannot be made up only of spaces."
          : null;

  if (!value) {
    return { score: 0, band: "weak", refusal, advice: null };
  }

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/]
    .filter((pattern) => pattern.test(value)).length;

  const echoesEmail = emailNames(email).some((name) => folded.includes(name));
  // A common word counts when what is left of the password without it would not
  // be a password on its own. `password1234` is "password" with four characters
  // stuck on; `mypasswordislong` is not much better. A twenty-six character
  // passphrase that happens to contain "dragon" is, and matching the word as a
  // bare substring refused it.
  const isCommon = COMMON.some((word) =>
    folded.includes(word) && folded.replace(word, "").length < PASSWORD_MIN);
  const repetitive = isRepetitive(value);

  let score = 0;
  if (value.length >= PASSWORD_MIN) score++;
  if (value.length >= 16) score++;
  if (classes >= 2) score++;
  if (classes >= 3) score++;

  // The three that make a long password weak anyway. Floored at 0 rather than
  // allowed to go negative, since the bar has four segments and no basement.
  if (echoesEmail) score -= 2;
  if (isCommon) score -= 2;
  if (repetitive) score--;
  score = Math.max(0, Math.min(4, score));

  // Nothing below the legal minimum is allowed to read as anything but weak,
  // whatever it scored on variety. A ten-character password with four
  // character classes is still a ten-character password.
  if (refusal) score = Math.min(score, 1);

  // Nor is their own email address, however long and varied it looks.
  // `gulnabidev+newclub9` is nineteen characters with three character classes,
  // which scored four, and a flat -2 left it at Fair and allowed. Somebody
  // whose password is their address has one secret, not two.
  //
  // Only this one is capped. A common word is matched as a substring, so
  // "correcthorsebattery-dragon" trips it, and refusing that outright would be
  // a false refusal; the -2 is enough to make it advice.
  if (echoesEmail) score = Math.min(score, 1);

  const band: Band = score <= 1 ? "weak" : score === 2 ? "fair" : score === 3 ? "good" : "strong";

  // One thing, the most useful one, in the order that actually helps.
  const advice = echoesEmail
    ? "Do not use your email address in your password."
    : isCommon
      ? "That contains a very common password. Pick something else."
      : repetitive
        ? "Avoid repeated characters and runs like 1234."
        : value.length < 16
          ? "Longer is stronger. Four unrelated words beats a short jumble."
          : classes < 3
            ? "Mix in capitals, numbers or punctuation."
            : null;

  return { score, band, refusal, advice };
}

/**
 * May the form be submitted?
 *
 * Legacy's rule decides whether it is legal; Fair is where we stop somebody
 * choosing something we can already see is poor. Both have to pass, and the
 * refusal is the message worth showing because it is the one the server will
 * repeat.
 */
export function passwordAllowed(password: string, email = ""): { ok: boolean; message: string | null } {
  const result = strength(password, email);
  if (result.refusal) return { ok: false, message: result.refusal };
  if (result.band === "weak") {
    return { ok: false, message: result.advice ?? "Choose a stronger password." };
  }
  return { ok: true, message: null };
}
