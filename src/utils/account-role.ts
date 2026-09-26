import { factions, tokens } from "@/lib/tokens";

export type AccountStanding =
  "suspended" | "admin" | "owner" | "manager" | "helper" | "member" | "none";

/**
 * The one thing about an account worth colouring a card by.
 *
 * Somebody can be several at once — an owner of one club and a helper at
 * another — so this picks the highest, because a card has one border and the
 * question it answers is "what is this person to the site". Suspended wins over
 * all of it: it is the state that decides whether anything else applies.
 *
 * `clubsOwned` and `memberships` are counts the database returns. Manager and
 * helper are not, so they are read out of `teamRoles`, which
 * `admin_find_accounts` builds as "Owner of X" or "<Role> at X" (0081, the
 * `initcap(t.role) || ' at '` branch). Parsing a display string is a coupling,
 * so it is one function with a test rather than a regex at the call site, and
 * a wording change in that migration breaks the test rather than the page.
 */
export function standingOf(account: {
  role: string; active: boolean; clubsOwned: number; memberships: number; teamRoles: string;
}): AccountStanding {
  if (!account.active) return "suspended";
  if (account.role === "admin") return "admin";
  if (account.clubsOwned > 0 || /(^|·\s*)Owner of /.test(account.teamRoles)) return "owner";
  if (/(^|·\s*)Manager at /.test(account.teamRoles)) return "manager";
  if (/(^|·\s*)Helper at /.test(account.teamRoles)) return "helper";
  if (account.memberships > 0) return "member";
  return "none";
}

/**
 * What each standing looks like, and what it is called.
 *
 * `fill` is null where the monogram stays an outline: a member and somebody
 * with nothing attached are the ordinary cases, and filling every card would
 * make the two that matter — suspended and admin — stop standing out.
 *
 * `label` is null for "none" only. Every colour on this page has a word beside
 * it, because a border colour on its own is not something a reader can look up.
 */
export const STANDINGS: Record<AccountStanding,
  { label: string | null; border: string; fill: string | null }> = {
  suspended: { label: "SUSPENDED", border: tokens.danger, fill: tokens.danger },
  admin: { label: "ADMIN", border: tokens.brass, fill: tokens.brass },
  owner: { label: "OWNER", border: tokens.brand, fill: tokens.brand },
  manager: { label: "MANAGER", border: factions[4].base, fill: factions[4].base },
  helper: { label: "HELPER", border: factions[1].base, fill: factions[1].base },
  member: { label: "MEMBER", border: tokens.inkMuted, fill: null },
  none: { label: null, border: tokens.rule, fill: null },
};
