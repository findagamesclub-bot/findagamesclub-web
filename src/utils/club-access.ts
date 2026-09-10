/**
 * What each club role may do.
 *
 * The same matrix as club_role_capabilities() in 0067. Two copies exist because
 * the database has to decide whether a write is allowed and the browser has to
 * decide whether to draw the button, and neither can ask the other in time.
 * The test beside this file holds a transcription of the SQL and asserts the
 * two agree, so they cannot drift quietly.
 *
 * The database is still the authority. Nothing here is a guard: it decides what
 * to render, and a policy decides what happens.
 */

export type ClubRole = "owner" | "manager" | "helper" | "admin";

export type Capability =
  | "listing.edit"
  | "events.manage"
  | "members.manage"
  | "bookings.manage"
  | "results.manage"
  | "board.moderate"
  | "shop.manage"
  | "coaching.manage"
  | "competitions.manage"
  | "messages.club"
  | "analytics.view"
  | "team.manage"
  | "billing.manage"
  | "audit.view";

const EVERYTHING: readonly Capability[] = [
  "listing.edit", "events.manage", "members.manage", "bookings.manage",
  "results.manage", "board.moderate", "shop.manage", "coaching.manage",
  "competitions.manage", "messages.club", "analytics.view",
  "team.manage", "billing.manage", "audit.view",
];

export const CAPABILITIES: Record<ClubRole, readonly Capability[]> = {
  owner: EVERYTHING,
  admin: EVERYTHING,
  // A manager runs the club day to day. Not the team, because inviting people
  // is how a manager would make themselves an owner; not billing, because that
  // is the owner's money.
  manager: EVERYTHING.filter((c) => c !== "team.manage" && c !== "billing.manage"),
  // The night, and nothing else.
  helper: ["bookings.manage", "results.manage", "board.moderate"],
};

/** How each role is described to the person holding it. */
export const ROLE_LABEL: Record<ClubRole, string> = {
  owner: "Owner",
  manager: "Manager",
  helper: "Helper",
  admin: "Site admin",
};

/** One line under the label, on the invite picker and the team list. */
export const ROLE_SUMMARY: Record<ClubRole, string> = {
  owner: "Everything, including the team and the billing.",
  manager: "The listing, events, members, the shop and the numbers. Not the team or the billing.",
  helper: "Club nights: table bookings, scores, and taking a post down.",
  admin: "Every club on the site.",
};

export type ClubAccess = {
  role: ClubRole | null;
  /** Owner, manager or admin. The same answer can_manage_club() gives. */
  canManage: boolean;
  can: (capability: Capability) => boolean;
};

export function clubAccess(role: ClubRole | null): ClubAccess {
  const held = role ? CAPABILITIES[role] : [];
  return {
    role,
    canManage: role === "owner" || role === "manager" || role === "admin",
    can: (capability) => held.includes(capability),
  };
}

/** A role a person may be invited as. Owner is reached by transfer, not invite. */
export const INVITABLE_ROLES = ["manager", "helper"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isInvitableRole(value: string): value is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(value);
}

/**
 * Narrows what the database returns. club_role_of() answers with null for
 * somebody with no role here, and an unknown string would mean the two files
 * have drifted, so it is treated as no role rather than trusted.
 */
export function toClubRole(value: string | null | undefined): ClubRole | null {
  return value === "owner" || value === "manager" || value === "helper" || value === "admin"
    ? value
    : null;
}
