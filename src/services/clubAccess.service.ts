import "server-only";

import * as repo from "@/repositories/clubTeam.repository";
import { clubAccess, toClubRole, type ClubAccess } from "@/utils/club-access";

/**
 * What this viewer may do at this club.
 *
 * Seventeen pages worked this out for themselves with
 * `club.ownerId === viewer.id || viewer.role === "admin"`, which was right
 * while a club had exactly one person who could do anything and is wrong now.
 * Every one of them asks here instead.
 */

export type AccessViewer = { id: string; role?: string | null } | null | undefined;

export async function getClubAccess(
  clubId: number, viewer: AccessViewer,
): Promise<ClubAccess> {
  if (!viewer) return clubAccess(null);
  // An admin holds every capability at every club, so there is nothing to look
  // up. Worth the special case: this runs on every club page in the app.
  if (viewer.role === "admin") return clubAccess("admin");

  try {
    return clubAccess(toClubRole(await repo.findMyRole(clubId)));
  } catch {
    // A page that cannot tell what you are should show you the visitor's
    // version of it, not fail. The database refuses the write either way.
    return clubAccess(null);
  }
}

/**
 * The same answer for several clubs at once, for a page that lists them.
 *
 * One query rather than one per club: the owner inbox and the directory both
 * ask about every club on the page.
 */
export async function getMyClubRoles(
  viewer: AccessViewer,
): Promise<Map<number, ClubAccess>> {
  const roles = new Map<number, ClubAccess>();
  if (!viewer) return roles;

  const rows = await repo.findMyClubs(viewer.id).catch(() => []);
  for (const row of rows) {
    if (row.clubs) roles.set(row.clubs.id, clubAccess(toClubRole(row.role)));
  }
  return roles;
}
