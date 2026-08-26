import type { MembershipTier } from "@/types/clubDetail";

/**
 * Which categories a person may post in, and which are locked.
 *
 * The database is the authority — can_use_discussion_category() enforces this
 * in RLS — but the board also has to draw the picker, and a locked category
 * shown with the reason is more use than one silently missing. A member who
 * cannot see the Premium board cannot work out that upgrading would open it.
 *
 * Ported from _available_discussion_categories_for_user (club_store.py:15813).
 * Position is the ladder: a tier further down the club's own list is higher.
 */

export type CategoryOption = {
  label: string;
  /** Null when they may post here. Otherwise the tier that would open it. */
  lockedBy: string | null;
};

/** The raw benefits jsonb reduced to the category names a tier reserves. */
export function reservedCategories(benefits: unknown): string[] {
  if (!benefits || typeof benefits !== "object" || Array.isArray(benefits)) return [];
  const raw = (benefits as Record<string, unknown>).privateDiscussionCategories;
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v).trim()).filter(Boolean);
}

export function categoryOptions(params: {
  categories: string[];
  tiers: { label: string; reserved: string[] }[];
  /** Index into `tiers`. -1 for somebody holding no tier. */
  viewerRank: number;
  canManageClub: boolean;
}): CategoryOption[] {
  // The highest tier reserving each name, so a category claimed by two tiers
  // is locked by the harder one to reach.
  const locks = new Map<string, { rank: number; label: string }>();
  params.tiers.forEach((tier, rank) => {
    for (const name of tier.reserved) {
      const key = name.trim().toLowerCase();
      const held = locks.get(key);
      if (!held || rank > held.rank) locks.set(key, { rank, label: tier.label });
    }
  });

  return params.categories.map((label) => {
    const lock = locks.get(label.trim().toLowerCase());
    if (!lock || params.canManageClub || params.viewerRank >= lock.rank) {
      return { label, lockedBy: null };
    }
    return { label, lockedBy: lock.label };
  });
}

/** The tier's index in the club's ladder, or -1. */
export function tierRank(tiers: MembershipTier[], tierKey: string | null): number {
  if (!tierKey) return -1;
  return tiers.findIndex((t) => t.key === tierKey);
}
