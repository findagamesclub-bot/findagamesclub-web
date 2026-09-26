import "server-only";

import * as repo from "@/repositories/claims.repository";
import { billingRefusal } from "@/utils/billing-refusals";
import { CLAIM_TABS } from "@/utils/claim-status";
import { CLAIM_LIMIT } from "@/utils/claims-limit";

export type ClaimResult = { ok: true } | { ok: false; error: string };

const PER_PAGE = 25;

export { CLAIM_LIMIT } from "@/utils/claims-limit";

export type ClaimFilters = { status: string; page: number };

export function readClaimFilters(
  params: Record<string, string | string[] | undefined>,
): ClaimFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  return { status: one("state") || "open", page: Math.max(1, Number(one("page")) || 1) };
}

export async function getClaimsQueue(filters: ClaimFilters) {
  const from = (filters.page - 1) * PER_PAGE;

  const [page, counts] = await Promise.all([
    repo.findClaimsPage({ status: filters.status, from, to: from + PER_PAGE - 1 }),
    repo.countClaimsByStatus(CLAIM_TABS.map((t) => t.key)),
  ]);

  return {
    rows: page.rows, total: page.total,
    page: filters.page, perPage: PER_PAGE, counts,
  };
}

/** The one number the admin rail's badge carries. */
export async function countOpenClaims(): Promise<number> {
  const counts = await repo.countClaimsByStatus(["open"]).catch(() => new Map());
  return counts.get("open") ?? 0;
}

export async function getClaim(id: number) {
  return repo.findClaim(id);
}

export async function getMyClaim(clubId: number) {
  return repo.findMyClaim(clubId).catch(() => null);
}

export async function startClaim(params: {
  clubId: number; message: string; evidence: string;
}): Promise<ClaimResult> {
  const message = params.message.trim();
  if (!message) {
    return { ok: false, error: "Say a little about why this club is yours." };
  }
  if (message.length > CLAIM_LIMIT) {
    return {
      ok: false,
      error: `That is a bit long. Keep it under ${CLAIM_LIMIT} characters.`,
    };
  }

  try {
    await repo.startClaim({ ...params, message, evidence: params.evidence.trim() });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
}

export async function withdrawClaim(id: number): Promise<ClaimResult> {
  try {
    await repo.withdrawClaim(id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
}

export async function approveClaim(
  id: number, note: string,
): Promise<{ ok: true; slug: string; name: string } | { ok: false; error: string }> {
  try {
    const result = await repo.approveClaim(id, note.trim());
    return { ok: true, slug: result.slug, name: result.name };
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
}

export async function declineClaim(id: number, note: string): Promise<ClaimResult> {
  const clean = note.trim();
  if (!clean) return { ok: false, error: "Give a reason. It is what they will be told." };
  if (clean.length > CLAIM_LIMIT) {
    return { ok: false, error: `Keep the reason under ${CLAIM_LIMIT} characters.` };
  }

  try {
    await repo.declineClaim(id, clean);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
}

export async function setClaimable(
  club: number, claimable: boolean,
): Promise<ClaimResult> {
  try {
    await repo.setClaimable(club, claimable);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
}

export async function createClubAsAdmin(params: {
  name: string; city: string; claimable: boolean;
}): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  try {
    const result = await repo.createClubAsAdmin(
      params.name.trim(), params.city.trim(), params.claimable);
    return { ok: true, slug: result.slug };
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
}

/**
 * The clubs an admin can open to claims, split into the ones already open and
 * the rest. Ownerless only, because that is the only kind the function accepts.
 */
/**
 * The claim to put on somebody's own dashboard, if there is one worth showing.
 *
 * Only one that is still going somewhere: an open claim is a thing they are
 * waiting on, and a decline is a thing they can answer. Approved needs no card
 * because the club is in their list of clubs now, and withdrawn is something
 * they chose to stop.
 */
export async function getMyLiveClaim() {
  const mine = await repo.findMyClaims().catch(() => []);
  return mine.find((c) => c.status === "open" || c.status === "declined") ?? null;
}

export async function getClaimableClubs() {
  const clubs = await repo.findOwnerlessClubs().catch(() => []);
  return {
    open: clubs.filter((club) => club.claimable),
    closed: clubs.filter((club) => !club.claimable),
  };
}
