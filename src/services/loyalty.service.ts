import "server-only";

import * as repo from "@/repositories/loyalty.repository";
import * as memberships from "@/repositories/memberships.repository";
import {
  DEFAULT_ANNIVERSARIES, DEFAULT_MILESTONES, DEFAULT_TIERS, tierFor,
  type Anniversary, type LoyaltyTier,
} from "@/utils/loyalty";
import type { LoyaltyEntry, LoyaltyProgramme, LoyaltyWallet } from "@/types/loyalty";

/**
 * Loyalty points.
 *
 * Nothing here awards anything — triggers do that, so an award cannot be
 * missed by a code path that forgot to call it. This reads the ledger and
 * works out what it means.
 */

/** The benefits key, what to call it, and the ledger category it writes. */
const MILESTONES: { key: string; label: string; category: string }[] = [
  { key: "membershipApproved", label: "Joining the club", category: "membership-approved" },
  { key: "gameBooking", label: "Booking a table", category: "game-booking" },
  { key: "eventBooking", label: "Booking event tickets", category: "event-booking" },
  { key: "merchandisePurchase", label: "Ordering merchandise", category: "merchandise-order" },
];

function toTiers(raw: unknown): LoyaltyTier[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_TIERS;
  const parsed = raw
    .map((t) => {
      const row = (t ?? {}) as Record<string, unknown>;
      return {
        label: String(row.label ?? "").trim(),
        pointsRequired: Number(row.pointsRequired ?? 0) || 0,
        tone: String(row.tone ?? "bronze").trim(),
        rewards: Array.isArray(row.rewards) ? row.rewards.map(String).filter(Boolean) : [],
      };
    })
    .filter((t) => t.label);
  return parsed.length ? parsed : DEFAULT_TIERS;
}

function toAnniversaries(raw: unknown): Anniversary[] {
  if (!Array.isArray(raw)) return DEFAULT_ANNIVERSARIES;
  const parsed = raw
    .map((a) => {
      const row = (a ?? {}) as Record<string, unknown>;
      return { years: Number(row.years ?? 0) || 0, points: Number(row.points ?? 0) || 0 };
    })
    .filter((a) => a.years > 0 && a.points > 0);
  return parsed.length ? parsed : DEFAULT_ANNIVERSARIES;
}

function toMilestones(raw: unknown): { label: string; points: number; category: string }[] {
  const source: Record<string, unknown> =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : { ...DEFAULT_MILESTONES };

  return MILESTONES
    .map((m) => ({ label: m.label, category: m.category, points: Number(source[m.key] ?? 0) || 0 }))
    // A milestone worth nothing is not a milestone; showing "0 points" reads
    // as a broken programme rather than one the club chose not to use.
    .filter((m) => m.points > 0);
}

export async function getProgramme(clubId: number): Promise<LoyaltyProgramme | null> {
  const row = await repo.findSettings(clubId);
  if (!row || !row.enabled) return null;

  return {
    enabled: true,
    tiers: toTiers(row.tiers),
    milestones: toMilestones(row.milestones),
    anniversaries: toAnniversaries(row.anniversaries),
    pointValue: row.point_value === null ? null : Number(row.point_value),
  };
}

export async function getWallet(clubId: number, profileId: string): Promise<LoyaltyWallet | null> {
  const settings = await repo.findSettings(clubId);
  if (!settings || !settings.enabled) return null;

  const rows = await repo.syncAndFindWallet(clubId, profileId);
  const tiers = toTiers(settings.tiers);

  const available = rows.reduce((n, r) => n + r.available_delta, 0);
  const lifetime = rows.reduce((n, r) => n + r.lifetime_delta, 0);
  const standing = tierFor(lifetime, tiers);

  const entries: LoyaltyEntry[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind as LoyaltyEntry["kind"],
    category: r.category,
    description: r.description,
    points: r.lifetime_delta || r.available_delta,
    createdAt: r.created_at,
  }));

  const held = standing.tier as (LoyaltyTier & { rewards?: string[] }) | null;

  return {
    clubId,
    available,
    lifetime,
    tier: standing.tier,
    next: standing.next,
    toNext: standing.toNext,
    progress: standing.progress,
    rewards: held?.rewards ?? [],
    pointValue: settings.point_value === null ? null : Number(settings.point_value),
    entries,
  };
}

type Standing = {
  profileId: string;
  name: string;
  available: number;
  lifetime: number;
  entries: LoyaltyEntry[];
};

/**
 * Every member's standing at a club, biggest lifetime first.
 *
 * Carries each person's ledger too, because the roster shows both and one
 * query for the club beats one per member card.
 */
export async function getStandings(clubId: number): Promise<Standing[]> {
  const [members, rows] = await Promise.all([
    memberships.findClubMemberships(clubId, ["approved"]),
    repo.findClubWallets(clubId),
  ]);

  // Seeded from the roster, not from the ledger. Built the other way round, a
  // member who has not earned anything yet simply was not on the board, so a
  // club with two members showed one and looked broken. Legacy starts from the
  // approved memberships for the same reason (_build_loyalty_leaderboard).
  const byPerson = new Map<string, Standing>();
  for (const member of members) {
    const person = (member as unknown as { profiles: { full_name: string | null } }).profiles;
    byPerson.set(member.profile_id, {
      profileId: member.profile_id,
      name: person?.full_name?.trim() || "Club member",
      available: 0,
      lifetime: 0,
      entries: [] as LoyaltyEntry[],
    });
  }

  for (const row of rows) {
    const person = (row as unknown as { profiles: { full_name: string | null } }).profiles;
    // Somebody who earned points here and has since left keeps their standing:
    // the ledger is a record of what happened, not of who is currently in.
    const held = byPerson.get(row.profile_id) ?? {
      profileId: row.profile_id,
      name: person?.full_name?.trim() || "Club member",
      available: 0,
      lifetime: 0,
      entries: [] as LoyaltyEntry[],
    };
    held.available += row.available_delta;
    held.lifetime += row.lifetime_delta;
    held.entries.push({
      id: row.id,
      kind: row.kind as LoyaltyEntry["kind"],
      category: row.category,
      description: row.description,
      points: row.lifetime_delta || row.available_delta,
      createdAt: row.created_at,
    });
    byPerson.set(row.profile_id, held);
  }

  // Lifetime, then name, so the people on zero sit in a readable order under
  // the ones who have earned rather than in whatever order the roster arrived.
  return [...byPerson.values()]
    .sort((a, b) => b.lifetime - a.lifetime || a.name.localeCompare(b.name));
}
