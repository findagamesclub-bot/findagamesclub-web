import { SOCIAL_NETWORKS, normaliseSocialUrl } from "./social-links";
import { isHalfRange } from "./time-range";
import type { ProfileStep } from "./listing-draft";

/**
 * One reading of a builder step, for both places it can land.
 *
 * The same five steps now fill in two different things: a club that exists,
 * written straight to its tables, and a listing that does not exist yet, kept
 * as jsonb on a submission until an admin approves it. If each path did its own
 * reading of the form, the two would drift, and the drift would only show up as
 * a club that came out of the queue missing a section.
 *
 * So the reading happens once, here, in **database shape**. Approving is then a
 * mapping rather than a second interpretation of what the club meant, which is
 * why `approve_club_submission` can hand most of the payload straight to the
 * same section savers the live editor calls.
 *
 * Pure: FormData in, plain objects out, no I/O. The validation lives here too,
 * so a rule cannot be enforced on one path and not the other.
 */

export type Reading<T> = { ok: true; value: T } | { ok: false; error: string };

const at = (form: FormData, key: string, index: number) =>
  String(form.getAll(key)[index] ?? "").trim();

const list = (form: FormData, key: string) =>
  form.getAll(key).map((v) => String(v).trim()).filter(Boolean);

const empty = (value: string) => (value ? value : null);

export type ClubColumns = {
  name: string;
  city: string;
  neighbourhood: string | null;
  summary: string | null;
  description: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_postcode: string | null;
  website_url: string | null;
  contact_email: string | null;
  ages: string | null;
  member_count: number | null;
  tables_available: number | null;
};

/** Step 1, as the columns `clubs` actually has. */
export function profileColumns(v: ProfileStep): ClubColumns {
  return {
    name: v.name,
    city: v.city,
    neighbourhood: empty(v.neighbourhood),
    summary: empty(v.summary),
    description: empty(v.description),
    venue_name: empty(v.venueName),
    venue_address: empty(v.venueAddress),
    venue_postcode: empty(v.postcode),
    website_url: empty(v.website),
    contact_email: empty(v.contactEmail),
    ages: empty(v.ages),
    member_count: v.memberCount,
    tables_available: v.tablesAvailable,
  };
}

export type ContentReading = {
  games: string[];
  facilities: string[];
  payment_methods: string[];
  images: { storage_path: string | null; src: string; alt: string }[];
  social_links: { label: string; url: string }[];
  categories: { id: string | null; label: string }[];
  /** Files the club took out, for the caller to delete after the rows are gone. */
  removed: string[];
};

/** Step 2. */
export function contentReading(form: FormData): ContentReading {
  const images = form.getAll("photo").flatMap((raw) => {
    try {
      const parsed = JSON.parse(String(raw)) as
        { path?: string | null; src?: string | null; alt?: unknown };
      // A photo still uploading has neither, and saving it writes a row
      // pointing at nothing.
      if (!parsed.path && !parsed.src) return [];
      return [{
        storage_path: parsed.path ?? null,
        src: parsed.src ?? "",
        alt: String(parsed.alt ?? ""),
      }];
    } catch { return []; }
  });

  const social_links = SOCIAL_NETWORKS.flatMap((network) => {
    const url = normaliseSocialUrl(String(form.get(`social-${network}`) ?? ""));
    return url ? [{ label: network as string, url }] : [];
  });

  const categories = list(form, "category").map((label, index) => ({
    id: String(form.getAll("categoryId")[index] ?? "") || null,
    label,
  }));

  return {
    games: list(form, "games"),
    facilities: list(form, "facilities"),
    payment_methods: list(form, "paymentMethods"),
    images,
    social_links,
    categories,
    removed: form.getAll("removedPhoto").map(String).filter(Boolean),
  };
}

export type PricingReading = {
  pricing_models: { label: string; price: string; notes: string }[];
  tiers: {
    tier_key: string; label: string; price: string; price_duration: string;
    description: string; is_basic: boolean; benefits: unknown; billing_options: unknown;
  }[];
  loyalty: { enabled: boolean };
};

/** Step 3. */
export function pricingReading(form: FormData): Reading<PricingReading> {
  const json = (key: string, index: number, fallback: unknown) => {
    try { return JSON.parse(String(form.getAll(key)[index] ?? "")); } catch { return fallback; }
  };

  const pricing_models = form.getAll("modelLabel").map((_, index) => ({
    label: at(form, "modelLabel", index),
    price: at(form, "modelPrice", index),
    notes: at(form, "modelNotes", index),
  })).filter((m) => m.label);

  const tiers = form.getAll("tierKey").map((_, index) => ({
    tier_key: at(form, "tierKey", index),
    label: at(form, "tierLabel", index),
    price: at(form, "tierPrice", index),
    price_duration: at(form, "tierDuration", index),
    description: at(form, "tierDescription", index),
    is_basic: at(form, "tierBasic", index) === "yes",
    // `benefits` and `billing_options` ride back out as the JSON they came in
    // as. This screen does not edit them, and a save that dropped them would
    // quietly strip every perk the club has set up.
    benefits: json("tierBenefits", index, {}),
    billing_options: json("tierBilling", index, []),
  })).filter((t) => t.tier_key && t.label);

  if (tiers.length && !tiers.some((t) => t.is_basic)) {
    return { ok: false, error: "One tier has to be the one people join on." };
  }

  return {
    ok: true,
    value: {
      pricing_models,
      tiers,
      loyalty: { enabled: String(form.get("loyaltyEnabled") ?? "") === "yes" },
    },
  };
}

export type ScheduleReading = {
  sessions: { id: string | null; day: string; time: string; label: string }[];
  announcements: { message: string }[];
};

/** Step 4. */
export function scheduleReading(form: FormData): Reading<ScheduleReading> {
  const sessions = form.getAll("nightDay").map((_, index) => ({
    id: at(form, "nightId", index) || null,
    day: at(form, "nightDay", index),
    time: at(form, "nightTime", index),
    label: at(form, "nightLabel", index),
  })).filter((n) => n.day || n.time || n.label);

  if (sessions.some((n) => !n.day || !n.time || !n.label)) {
    return { ok: false, error: "Every club night needs a day, a time and a name." };
  }

  // A start with no end. It would save as "18:38", which tells a member when to
  // turn up and nothing about when to leave.
  const half = sessions.find((n) => isHalfRange(n.time));
  if (half) {
    return {
      ok: false,
      error: `${half.day || "One of your nights"} has a start time but no end time.`,
    };
  }

  return {
    ok: true,
    value: {
      sessions,
      announcements: list(form, "notice").map((message) => ({ message })),
    },
  };
}
