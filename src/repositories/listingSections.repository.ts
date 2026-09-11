import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The listing sections that go through a database function rather than a
 * policy, because each has something a policy cannot say: what must not be
 * thrown away. The functions live in 0086.
 */

type ImageRow = {
  id: number; src: string | null; alt: string | null; storage_path: string | null;
};

/**
 * One of the whole-section writers from 0086.
 *
 * Every one takes the same two arguments and returns a count nobody reads, so
 * they share a caller. The refusals they raise are worded for the person who
 * hit them in `listing.service.ts`.
 */
async function call(
  name: "save_club_schedule" | "save_club_tiers" | "save_club_discussion_categories",
  args: { p_club: number; p_rows: unknown },
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(name, args as never);
  if (error) throw new Error(error.message);
}

/** Board categories. A rename carries the posts filed under it. */
export const saveCategories = (
  clubId: number, rows: { id: string | null; label: string }[],
) => call("save_club_discussion_categories", { p_club: clubId, p_rows: rows });

/** Club nights. Refuses to drop one with bookings still to come. */
export const saveSchedule = (
  clubId: number, rows: { id: string | null; day: string; time: string; label: string }[],
) => call("save_club_schedule", { p_club: clubId, p_rows: rows });

/** Membership tiers. Refuses to drop one anybody holds. */
export const saveTiers = (clubId: number, rows: Record<string, unknown>[]) =>
  call("save_club_tiers", { p_club: clubId, p_rows: rows });

/**
 * What the editor needs and the public page does not.
 *
 * `ClubDetail` carries categories as labels and images as URLs, which is right
 * for rendering and useless for editing: a rename needs the category's id, and
 * a photo needs the storage path so it can be removed from the bucket too.
 */
export async function findEditableContent(clubId: number) {
  const supabase = await createClient();

  const [categories, images] = await Promise.all([
    supabase.from("club_discussion_categories")
      .select("id, label").eq("club_id", clubId).order("position"),
    supabase.from("club_images")
      .select("id, src, alt, position, storage_path")
      .eq("club_id", clubId).order("position"),
  ]);

  if (categories.error) throw new Error(categories.error.message);
  if (images.error) throw new Error(images.error.message);

  return {
    categories: (categories.data ?? []).map((c) => ({ id: String(c.id), label: c.label })),
    images: (images.data ?? []).map((image) => ({
      id: String(image.id),
      src: image.src ?? "",
      alt: image.alt ?? "",
      storagePath: image.storage_path ?? null,
    })),
  };
}

/**
 * The nights and notices, with the one number the editor cannot do without.
 *
 * "4 bookings attached" is what stops somebody deleting a night and finding
 * out from an error message. Counted here rather than in the browser because
 * the browser cannot see other people's bookings.
 */
export async function findEditableSchedule(clubId: number) {
  const supabase = await createClient();

  const [nights, notices, booked] = await Promise.all([
    supabase.from("club_sessions")
      .select("id, day, time, label").eq("club_id", clubId).order("position"),
    supabase.from("club_announcements")
      .select("id, message").eq("club_id", clubId).order("id"),
    supabase.from("club_bookings")
      .select("club_session_id")
      .eq("club_id", clubId)
      .neq("status", "cancelled")
      .gte("session_date", new Date().toISOString().slice(0, 10)),
  ]);

  if (nights.error) throw new Error(nights.error.message);
  if (notices.error) throw new Error(notices.error.message);

  const counts = new Map<number, number>();
  for (const row of booked.data ?? []) {
    const id = row.club_session_id;
    if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return {
    nights: (nights.data ?? []).map((n) => ({
      id: String(n.id),
      day: n.day ?? "",
      time: n.time ?? "",
      label: n.label ?? "",
      booked: counts.get(n.id) ?? 0,
    })),
    notices: (notices.data ?? []).map((n) => n.message ?? ""),
  };
}

/**
 * The tiers and prices, with the count that decides whether a tier can go.
 *
 * `held` counts pending and approved memberships, which is the same set
 * `save_club_tiers` refuses on, so the button disappears for exactly the tiers
 * the database would refuse.
 */
export async function findEditablePricing(clubId: number) {
  const supabase = await createClient();

  const [tiers, models, loyalty, memberships] = await Promise.all([
    supabase.from("club_membership_tiers")
      .select("tier_key, label, price, price_duration, description, is_basic, benefits, billing_options")
      .eq("club_id", clubId).order("position"),
    supabase.from("club_pricing_models")
      .select("label, price, notes").eq("club_id", clubId).order("position"),
    supabase.from("club_loyalty_settings")
      .select("enabled").eq("club_id", clubId).maybeSingle(),
    supabase.from("club_memberships")
      .select("tier_key").eq("club_id", clubId).in("status", ["pending", "approved"]),
  ]);

  if (tiers.error) throw new Error(tiers.error.message);
  if (models.error) throw new Error(models.error.message);

  const held = new Map<string, number>();
  for (const row of memberships.data ?? []) {
    const key = row.tier_key;
    if (key) held.set(key, (held.get(key) ?? 0) + 1);
  }

  return {
    tiers: (tiers.data ?? []).map((t) => ({
      key: t.tier_key,
      label: t.label ?? "",
      price: t.price ?? "",
      duration: t.price_duration ?? "",
      description: t.description ?? "",
      isBasic: Boolean(t.is_basic),
      held: held.get(t.tier_key) ?? 0,
      benefits: JSON.stringify(t.benefits ?? {}),
      billing: JSON.stringify(t.billing_options ?? []),
    })),
    models: (models.data ?? []).map((m) => ({
      label: m.label ?? "", price: m.price ?? "", notes: m.notes ?? "",
    })),
    loyaltyEnabled: Boolean(loyalty.data?.enabled),
  };
}

/**
 * The two halves of legacy's sixth readiness check.
 *
 * Legacy asks for six loyalty fields and one earning tier
 * (`getGuidedMembershipAndLoyaltyState`, main.js:11646), and for one billing
 * option on the basic tier that is switched on and priced. Both are read from
 * saved data here, so the checklist is right after a reload.
 */
export async function findPricingReadiness(clubId: number) {
  const supabase = await createClient();

  const [loyalty, tiers] = await Promise.all([
    supabase.from("club_loyalty_settings")
      .select("enabled, point_value, table_booking_price, milestones, tiers")
      .eq("club_id", clubId).maybeSingle(),
    supabase.from("club_membership_tiers")
      .select("is_basic, price, billing_options").eq("club_id", clubId),
  ]);

  const settings = loyalty.data;
  const milestones = (settings?.milestones ?? {}) as Record<string, unknown>;
  const said = (value: unknown) => value !== null && value !== undefined && String(value) !== "";

  const loyaltyReady = Boolean(settings?.enabled)
    && said(settings?.point_value)
    && said(settings?.table_booking_price)
    && ["membershipApproved", "gameBooking", "eventBooking", "merchandisePurchase"]
      .every((key) => said(milestones[key]))
    && Array.isArray(settings?.tiers) && (settings?.tiers as unknown[]).length > 0;

  // The basic tier priced, which is what legacy's billing rows amount to.
  const basic = (tiers.data ?? []).find((t) => t.is_basic);
  const options = Array.isArray(basic?.billing_options) ? basic.billing_options : [];
  const basicMembershipPriced = said(basic?.price)
    || options.some((o) => said((o as { price?: unknown })?.price));

  return { loyaltyReady, basicMembershipPriced };
}
