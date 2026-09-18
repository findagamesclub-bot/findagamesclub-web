/**
 * Reading and checking one step of the listing editor.
 *
 * The rules and the wording are legacy's. Its step 1 gate is
 * `clubs-v2/src/main.js:11630`: formats and ages are checked by hand with
 * their own messages, then the browser's own validation runs over the required
 * fields. We do the same, then repeat it on the server, because a browser check
 * is a courtesy and not a guard.
 */

export type FieldErrors = Partial<Record<string, string>>;

export type ProfileStep = {
  name: string;
  city: string;
  neighbourhood: string;
  summary: string;
  description: string;
  formats: string[];
  venueName: string;
  venueAddress: string;
  postcode: string;
  website: string;
  contactEmail: string;
  ages: string;
  memberCount: number | null;
  tablesAvailable: number | null;
};

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/**
 * Legacy stores the age groups as one string of comma-separated tokens and
 * reads them back with `splitTokenEntries` (main.js:12222), which splits on
 * commas or newlines. Kept, because the column is a single `text` and the club
 * page already renders whatever is in it.
 *
 * Commas as a separator are the trap `CLAUDE.md` records for facets, where
 * "Warhammer 40,000" split into two required terms. It is safe here only
 * because age groups do not contain commas; nothing else should reuse this.
 */
export const parseTokens = (value: string | null | undefined): string[] =>
  String(value ?? "").split(/[\n,]+/).map((t) => t.trim()).filter(Boolean);

export const joinTokens = (tokens: string[]): string =>
  tokens.map((t) => t.trim()).filter(Boolean).join(", ");
const list = (form: FormData, key: string) =>
  form.getAll(key).map((v) => String(v).trim()).filter(Boolean);

/**
 * A whole number, or null for "not said".
 *
 * Zero is a real answer here, matching legacy: a club with no tables has told
 * us something. Anything that is not a number at all is an error rather than a
 * silent zero.
 */
function count(form: FormData, key: string, errors: FieldErrors, label: string): number | null {
  const raw = text(form, key);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    errors[key] = `${label} has to be a whole number.`;
    return null;
  }
  return n;
}

export function parseProfileStep(form: FormData): Parsed<ProfileStep> {
  const errors: FieldErrors = {};

  const value: ProfileStep = {
    name: text(form, "name"),
    city: text(form, "city"),
    neighbourhood: text(form, "neighbourhood"),
    summary: text(form, "summary"),
    description: text(form, "description"),
    formats: list(form, "formats"),
    venueName: text(form, "venueName"),
    venueAddress: text(form, "venueAddress"),
    // Legacy uppercases the postcode on save. A club that types oxfordshire's
    // postcode in lower case should not get a different pin.
    postcode: text(form, "postcode").toUpperCase(),
    website: text(form, "website"),
    // And lowercases the address, so two people cannot own the same inbox.
    contactEmail: text(form, "contactEmail").toLowerCase(),
    ages: joinTokens(list(form, "ages")),
    memberCount: count(form, "memberCount", errors, "The member count"),
    tablesAvailable: count(form, "tablesAvailable", errors, "The number of tables"),
  };

  // The club's name is the only thing here it cannot be published without, and
  // the only one legacy refuses outright rather than counting as unready.
  if (!value.name) errors.name = "Your club needs a name.";

  // Legacy's two hand-written messages, verbatim.
  if (!value.formats.length) {
    errors.formats = "Add at least one club format before continuing.";
  }
  if (!value.ages) {
    errors.ages = "Add at least one age group before continuing.";
  }

  if (value.contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.contactEmail)) {
    errors.contactEmail = "That does not look like an email address.";
  }

  if (value.website && !/^https?:\/\/\S+$/i.test(value.website)) {
    errors.website = "Start the address with http:// or https://";
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/**
 * What to put in the toast when fields were refused.
 *
 * "Some of that needs another look" is true and useless: it does not say which
 * of thirteen fields, and the client read the one real message underneath as
 * ordinary guidance rather than as the reason the save stopped. One problem
 * gets named outright; several get counted, and the fields carry the detail.
 */
export function refusedMessage(
  errors: FieldErrors | undefined, fallback: string,
): string {
  const messages = Object.values(errors ?? {})
    .map((message) => (message ?? "").trim())
    .filter(Boolean);

  if (messages.length === 1) return messages[0]!;
  if (messages.length > 1) {
    return `${messages.length} things need another look. They are marked below.`;
  }
  return fallback;
}
