import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type ProfileRow = Tables<"profiles">;

const COLUMNS =
  "id, full_name, bio, home_postcode, preferred_travel_miles, games_interested, " +
  "factions_armies, availability_days, age_groups, play_style_tags, social_profiles, " +
  "role, is_active, created_at";

export async function findProfileById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles").select(COLUMNS).eq("id", id).maybeSingle();

  if (error) throw new Error(`Failed to load profile: ${error.message}`);
  return (data as ProfileRow | null) ?? null;
}

/**
 * Only the ten columns the person owns. `role`, `legacy_id` and `is_active` are
 * revoked from `authenticated` at the column level in migration 0001, so
 * including them here would fail at the database rather than silently succeed.
 */
export type ProfileEdit = Pick<
  ProfileRow,
  | "full_name" | "bio" | "home_postcode" | "preferred_travel_miles"
  | "games_interested" | "factions_armies" | "availability_days"
  | "age_groups" | "play_style_tags"
>;

export async function updateOwnProfile(id: string, patch: ProfileEdit) {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw new Error(`Failed to save profile: ${error.message}`);
}
