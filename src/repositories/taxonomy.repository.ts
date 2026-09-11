import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Filter options for the directory. Small, stable lists — safe to cache hard. */

export async function findFormats() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("formats").select("slug, label").order("label");
  if (error) throw new Error(`Failed to load formats: ${error.message}`);
  return data ?? [];
}

export async function findGames() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("games").select("slug, label").order("label");
  if (error) throw new Error(`Failed to load games: ${error.message}`);
  return data ?? [];
}

export async function findFacilities() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("facilities").select("slug, label").order("label");
  if (error) throw new Error(`Failed to load facilities: ${error.message}`);
  return data ?? [];
}

/** Distinct towns that actually have an active club, so the list is never a dead end. */
export async function findCities() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clubs").select("city").eq("status", "active");
  if (error) throw new Error(`Failed to load cities: ${error.message}`);
  return [...new Set((data ?? []).map((r) => r.city).filter(Boolean))].sort();
}

/** Days a club actually meets. Ordered Monday-first, not alphabetically. */
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export async function findMeetingDays() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("club_sessions").select("day");
  if (error) throw new Error(`Failed to load meeting days: ${error.message}`);
  const days = new Set((data ?? []).map((r) => r.day).filter(Boolean));
  return DAY_ORDER.filter((d) => days.has(d));
}

/**
 * Replace what a club plays, offers or takes.
 *
 * Through `save_club_taxonomy` rather than by writing the tables: the
 * vocabulary is shared by every club, so a club that could insert into it
 * directly could rename "Warhammer 40,000" for all of them. The function finds
 * or creates each label, then swaps the club's links for exactly this set, so
 * the caller has to send the whole list and never a partial one.
 */
export async function replaceClubTaxonomy(
  clubId: number,
  kind: "formats" | "games" | "facilities" | "payment_methods",
  labels: string[],
) {
  const supabase = await createClient();
  const { error } = await supabase
    .rpc("save_club_taxonomy", { p_club: clubId, p_kind: kind, p_labels: labels });

  if (error) throw new Error(error.message);
}
