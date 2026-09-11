import "server-only";

import * as repo from "@/repositories/clubs.repository";
import * as taxonomy from "@/repositories/taxonomy.repository";
import * as sections from "@/repositories/listingSections.repository";
import { SOCIAL_NETWORKS, normaliseSocialUrl } from "@/utils/social-links";
import { parseProfileStep, type FieldErrors } from "@/utils/listing-draft";
import { listingChecks, stepStatus, type ReadinessInput } from "@/utils/listing-readiness";
import { geocodeUk } from "./geocode.service";

/**
 * The listing editor's writes.
 *
 * One save per step rather than legacy's single payload for everything. Legacy
 * can send the lot because every field falls back to the value already on the
 * record, so a partial payload never blanks anything; ours is split by table,
 * which gets the same property and lets a step say which part of itself failed.
 */

export type SaveResult =
  | { ok: true }
  | { ok: false; error?: string; errors?: FieldErrors };

const empty = (value: string) => (value ? value : null);

export async function saveProfileStep(clubId: number, form: FormData): Promise<SaveResult> {
  const parsed = parseProfileStep(form);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const v = parsed.value;
  try {
    await repo.updateClubProfile(clubId, {
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
    });

    // Formats live in their own table, so they are their own write. Replaced
    // whole rather than merged: the picker sends everything it holds, and a
    // format removed in the browser has to disappear here too.
    await taxonomy.replaceClubTaxonomy(clubId, "formats", v.formats);

    // The trigger in 0083 has flagged the club if the postcode or the address
    // moved. Placing it is done here rather than in the form, because a form
    // that could send a latitude could pin a club anywhere.
    await placeIfMoved(clubId);
  } catch (error) {
    return refusal(error);
  }

  return { ok: true };
}

/**
 * Turn a database refusal into something worth reading.
 *
 * Every guard in 0086 raises a code and then says why in plain words, so the
 * message after the colon is already written for the person who caused it.
 */
function refusal(error: unknown): SaveResult {
  const message = error instanceof Error ? error.message : "";

  // Anything we do not recognise is a bug in here, not in what the club typed.
  // The message is the only evidence of it, so it goes to the server log rather
  // than being swallowed behind "that did not save".
  console.error("[listing] save refused:", message || error);

  if (message.includes("NOT_PERMITTED") || message.includes("row-level security")) {
    return { ok: false, error: "You do not have permission to edit this listing." };
  }
  if (message.includes("TOO_MANY_IMAGES")) {
    return { ok: false, error: "Ten photos at most. Remove one and try again." };
  }
  for (const code of ["SESSION_HAS_BOOKINGS", "TIER_IN_USE", "CATEGORY_HAS_POSTS"]) {
    if (message.includes(code)) {
      const said = message.split(`${code}: `)[1];
      return { ok: false, error: said ? said.replace(/\.$/, "") + "." : "That cannot be removed yet." };
    }
  }
  // In development the cause goes on screen as well as in the log. A generic
  // message is right for a member and useless for whoever has to fix it.
  const detail = process.env.NODE_ENV === "development" && message ? ` [${message}]` : "";
  return {
    ok: false,
    error: `That did not save. Try again, and tell us if it keeps happening.${detail}`,
  };
}

export type PhotoRow = { path: string | null; src: string | null; alt: string };

/**
 * Step 2: what the club plays, what it has, how it takes money, and its photos.
 *
 * Four taxonomies through the one definer function, then the photos and the
 * social links, then the board's categories. Each is a replace rather than a
 * merge, so the form must send everything it holds; that is legacy's shape too,
 * whose payload carries the whole array every time.
 */
export async function saveContentStep(clubId: number, form: FormData): Promise<SaveResult> {
  const labels = (key: string) =>
    form.getAll(key).map((v) => String(v).trim()).filter(Boolean);

  const photos: PhotoRow[] = form.getAll("photo").flatMap((raw) => {
    try {
      const parsed = JSON.parse(String(raw)) as PhotoRow;
      // A photo still uploading has neither, and saving it would write a row
      // pointing at nothing.
      if (!parsed.path && !parsed.src) return [];
      return [{ path: parsed.path ?? null, src: parsed.src ?? null, alt: String(parsed.alt ?? "") }];
    } catch { return []; }
  });

  const links = SOCIAL_NETWORKS.flatMap((network) => {
    const url = normaliseSocialUrl(String(form.get(`social-${network}`) ?? ""));
    return url ? [{ label: network, url }] : [];
  });

  const categories = labels("category").map((label, index) => ({
    id: String(form.getAll("categoryId")[index] ?? "") || null,
    label,
  }));

  try {
    await taxonomy.replaceClubTaxonomy(clubId, "games", labels("games"));
    await taxonomy.replaceClubTaxonomy(clubId, "facilities", labels("facilities"));
    await taxonomy.replaceClubTaxonomy(clubId, "payment_methods", labels("paymentMethods"));

    await repo.replaceClubImages(clubId, photos.map((p) => ({
      storage_path: p.path, src: p.src ?? "", alt: p.alt,
    })));
    await repo.replaceClubSocialLinks(clubId, links);
    await sections.saveCategories(clubId, categories);
  } catch (error) {
    return refusal(error);
  }

  // Only now the rows are gone, and never as a reason to fail the save: a file
  // left in the bucket is clutter nobody sees, and reporting the save as failed
  // over it would send somebody back to redo work that is already done.
  try {
    await repo.removeClubMedia(clubId, form.getAll("removedPhoto").map(String));
  } catch (error) {
    console.error("[listing] photos removed but their files stayed:", error);
  }

  return { ok: true };
}

/**
 * Step 4: the club's nights, its noticeboard and its booking rules.
 *
 * The nights go through the function in 0086 rather than a policy, because a
 * night with bookings on it must not be deleted and updating in place is what
 * keeps those bookings attached.
 */
export async function saveScheduleStep(clubId: number, form: FormData): Promise<SaveResult> {
  const at = (key: string, index: number) => String(form.getAll(key)[index] ?? "").trim();

  const nights = form.getAll("nightDay").map((_, index) => ({
    id: at("nightId", index) || null,
    day: at("nightDay", index),
    time: at("nightTime", index),
    label: at("nightLabel", index),
  })).filter((n) => n.day || n.time || n.label);

  const incomplete = nights.find((n) => !n.day || !n.time || !n.label);
  if (incomplete) {
    return { ok: false, error: "Every club night needs a day, a time and a name." };
  }

  const notices = form.getAll("notice")
    .map((v) => String(v).trim()).filter(Boolean);

  try {
    await sections.saveSchedule(clubId, nights);
    await repo.replaceClubAnnouncements(clubId, notices);
  } catch (error) {
    return refusal(error);
  }

  return { ok: true };
}

/**
 * Step 3: what it costs to walk in, and what it costs to join.
 *
 * The tiers go through the function in 0086, which refuses to remove one
 * anybody holds. `benefits` and `billing_options` ride back out of the form as
 * the JSON they went in as: this screen does not edit them yet, and a save that
 * did not carry them would quietly strip every perk the club has set up.
 */
export async function savePricingStep(clubId: number, form: FormData): Promise<SaveResult> {
  const at = (key: string, index: number) => String(form.getAll(key)[index] ?? "").trim();
  const json = (key: string, index: number, fallback: unknown) => {
    try { return JSON.parse(String(form.getAll(key)[index] ?? "")); } catch { return fallback; }
  };

  const models = form.getAll("modelLabel").map((_, index) => ({
    label: at("modelLabel", index),
    price: at("modelPrice", index),
    notes: at("modelNotes", index),
  })).filter((m) => m.label);

  const tiers = form.getAll("tierKey").map((_, index) => ({
    tier_key: at("tierKey", index),
    label: at("tierLabel", index),
    price: at("tierPrice", index),
    price_duration: at("tierDuration", index),
    description: at("tierDescription", index),
    is_basic: at("tierBasic", index) === "yes",
    benefits: json("tierBenefits", index, {}),
    billing_options: json("tierBilling", index, []),
  })).filter((t) => t.tier_key && t.label);

  if (tiers.length && !tiers.some((t) => t.is_basic)) {
    return { ok: false, error: "One tier has to be the one people join on." };
  }

  try {
    await sections.saveTiers(clubId, tiers);
    await repo.replaceClubPricingModels(clubId, models);
    await repo.setLoyaltyEnabled(clubId, String(form.get("loyaltyEnabled") ?? "") === "yes");
  } catch (error) {
    return refusal(error);
  }

  return { ok: true };
}

/**
 * Put a moved club back on the map.
 *
 * Coordinates are not writable by anybody, so this goes through the admin
 * client, and only after the guarded update above has already succeeded: the
 * club has been proved editable by the person asking before anything
 * privileged happens.
 *
 * A failure is swallowed on purpose. The flag stays set, the old pin stays
 * where it was rather than being blanked, and the nightly sweep tries again.
 * Losing a map pin is not a reason to fail a save the club has already made.
 */
async function placeIfMoved(clubId: number): Promise<void> {
  try {
    const club = await repo.findClubForEditing(clubId);
    if (!club) return;

    if (!club.geocode_stale || !club.venue_postcode) return;

    const origin = await geocodeUk(club.venue_postcode);
    if (!origin) return;

    await repo.placeClub(clubId, origin.latitude, origin.longitude, origin.label ?? null);
  } catch {
    // Left flagged for the sweep.
  }
}

/** What the stepper and the review step read. Computed from saved data. */
export function readiness(input: ReadinessInput) {
  return { checks: listingChecks(input), status: stepStatus(input) };
}
