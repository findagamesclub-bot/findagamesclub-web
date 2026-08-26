import "server-only";

import * as repo from "@/repositories/profiles.repository";
import { parseLocation } from "@/utils/geo";
import type { MemberProfile, ProfileDraft } from "@/types/profile";

/** Business rules for member profiles. */

export const AVAILABILITY_DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
] as const;

export const AGE_GROUPS = ["Under 18", "18+", "Families welcome"] as const;

export const PLAY_STYLES = [
  "Casual", "Competitive", "Narrative", "Painting and hobby", "Teaching newcomers",
] as const;

export async function getProfile(id: string): Promise<MemberProfile | null> {
  const row = await repo.findProfileById(id);
  // A deactivated account keeps its row so its posts still attribute, but it
  // stops having a public page.
  if (!row || !row.is_active) return null;

  return {
    id: row.id,
    fullName: row.full_name || "Member",
    bio: row.bio || undefined,
    // Only the district. Someone's exact postcode is their address.
    homeArea: parseLocation(row.home_postcode ?? "").district || undefined,
    travelMiles: row.preferred_travel_miles,
    games: row.games_interested ?? [],
    armies: row.factions_armies ?? [],
    availability: row.availability_days ?? [],
    ageGroups: row.age_groups ?? [],
    playStyle: row.play_style_tags ?? [],
    memberSince: row.created_at
      ? new Date(row.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
      : undefined,
    isAdmin: row.role === "admin",
  };
}

export async function getOwnDraft(id: string): Promise<ProfileDraft | null> {
  const row = await repo.findProfileById(id);
  if (!row) return null;

  return {
    fullName: row.full_name ?? "",
    bio: row.bio ?? "",
    homePostcode: row.home_postcode ?? "",
    travelMiles: row.preferred_travel_miles == null ? "" : String(row.preferred_travel_miles),
    games: row.games_interested ?? [],
    armies: row.factions_armies ?? [],
    availability: row.availability_days ?? [],
    ageGroups: row.age_groups ?? [],
    playStyle: row.play_style_tags ?? [],
  };
}

export async function saveOwnProfile(id: string, draft: ProfileDraft) {
  const name = draft.fullName.trim();
  if (!name) return { ok: false as const, error: "Enter your name." };

  const miles = draft.travelMiles.trim();
  const parsedMiles = miles === "" ? null : Number(miles);
  if (parsedMiles !== null && (!Number.isFinite(parsedMiles) || parsedMiles < 0 || parsedMiles > 500)) {
    // The column has the same check constraint, so catching it here is only so
    // the person gets a sentence instead of a database error.
    return { ok: false as const, error: "How far you will travel must be between 0 and 500 miles." };
  }

  const clean = (values: string[], allowed?: readonly string[]) => {
    const trimmed = values.map((v) => v.trim()).filter(Boolean);
    const kept = allowed ? trimmed.filter((v) => allowed.includes(v)) : trimmed;
    return [...new Set(kept)];
  };

  await repo.updateOwnProfile(id, {
    full_name: name,
    bio: draft.bio.trim() || null,
    home_postcode: draft.homePostcode.trim().toUpperCase() || null,
    preferred_travel_miles: parsedMiles,
    games_interested: clean(draft.games),
    factions_armies: clean(draft.armies),
    availability_days: clean(draft.availability, AVAILABILITY_DAYS),
    age_groups: clean(draft.ageGroups, AGE_GROUPS),
    play_style_tags: clean(draft.playStyle, PLAY_STYLES),
  });

  return { ok: true as const };
}
