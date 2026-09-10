import "server-only";

import * as repo from "@/repositories/clubTeam.repository";
import { toClubRole, type ClubRole } from "@/utils/club-access";

/**
 * Who runs a club, who has been asked to, and what has changed lately.
 *
 * The database decides every one of these; this shapes them for the page and
 * turns the audit log's column names into sentences a person can read.
 */

export type TeamMember = {
  profileId: string;
  name: string;
  role: ClubRole;
  since: string;
};

export type TeamInvite = {
  id: number;
  /** The name if they already have an account, the address if not. */
  who: string;
  role: ClubRole;
  sentAt: string;
  expiresAt: string;
  expired: boolean;
};

export type TeamChange = {
  id: number;
  actor: string;
  summary: string;
  at: string;
};

export type ClubTeam = {
  owner: TeamMember | null;
  managers: TeamMember[];
  helpers: TeamMember[];
  invites: TeamInvite[];
};

const nameOf = (full: string | null | undefined) =>
  full?.trim() || "A member";

function toMember(row: repo.TeamRow): TeamMember | null {
  const role = toClubRole(row.role);
  if (!role) return null;
  return {
    profileId: row.profile_id,
    name: nameOf(row.profiles?.full_name),
    role,
    since: row.created_at,
  };
}

export async function getClubTeam(clubId: number): Promise<ClubTeam> {
  const [rows, invites] = await Promise.all([
    repo.findTeam(clubId),
    repo.findOpenInvites(clubId).catch(() => []),
  ]);

  const members = rows.map(toMember).filter((m): m is TeamMember => m !== null);
  const now = Date.now();

  return {
    owner: members.find((m) => m.role === "owner") ?? null,
    managers: members.filter((m) => m.role === "manager"),
    helpers: members.filter((m) => m.role === "helper"),
    invites: invites.flatMap((row) => {
      const role = toClubRole(row.role);
      if (!role) return [];
      return [{
        id: row.id,
        who: row.profiles?.full_name?.trim() || row.email || "Somebody",
        role,
        sentAt: row.created_at,
        expiresAt: row.expires_at,
        // Shown rather than hidden: an invitation that quietly stopped working
        // is why somebody says "I clicked it and nothing happened".
        expired: new Date(row.expires_at).getTime() < now,
      }];
    }),
  };
}

/**
 * The audit log as sentences.
 *
 * The table stores which columns moved, which is the right thing to store and
 * the wrong thing to show. "Changed the club's name and summary" is what
 * somebody scanning this page wants; owner_id, name, summary is not.
 */
const FIELD_WORDS: Record<string, string> = {
  owner_id: "who owns the club",
  name: "the club's name",
  summary: "the summary",
  description: "the description",
  city: "the town",
  venue_name: "the venue",
  venue_address: "the address",
  venue_postcode: "the postcode",
  contact_email: "the contact address",
  contact_phone: "the phone number",
  website_url: "the website",
  tables_available: "the number of tables",
  member_count: "the member count",
  status: "whether the listing is live",
  role: "somebody's role",
  announcement: "the noticeboard line",
};

function words(keys: string[]): string {
  const said = keys.map((k) => FIELD_WORDS[k] ?? k.replace(/_/g, " "));
  if (said.length === 0) return "something";
  if (said.length === 1) return said[0]!;
  if (said.length === 2) return `${said[0]} and ${said[1]}`;
  return `${said.slice(0, -1).join(", ")} and ${said[said.length - 1]}`;
}

function summarise(row: repo.AuditRow): string {
  if (row.entity_type === "club_team") {
    // Accepting an invitation writes your own row, so the actor is the person
    // who joined. Reading that back as "gul-helper added somebody to the team"
    // is the log describing the wrong half of what happened.
    const joinedThemselves = row.action === "insert"
      && typeof row.after?.profile_id === "string"
      && row.after.profile_id === row.actor_id;

    if (row.action === "insert") {
      const role = typeof row.after?.role === "string" ? row.after.role : null;
      const as = role ? ` as a ${role}` : "";
      return joinedThemselves
        ? `Accepted an invitation${as}`
        : `Added somebody to the team${as}`;
    }
    if (row.action === "delete") {
      return row.before?.profile_id === row.actor_id
        ? "Stood down from the team"
        : "Removed somebody from the team";
    }
    const to = typeof row.after?.role === "string" ? ` to ${row.after.role}` : "";
    return `Changed somebody's role${to}`;
  }
  if (row.entity_type === "clubs") return `Changed ${words(row.changed_keys)}`;
  return `${row.action === "insert" ? "Added" : row.action === "delete" ? "Removed" : "Changed"} ${row.entity_type.replace(/^club_/, "").replace(/_/g, " ")}`;
}

export async function getRecentChanges(clubId: number, page: number, perPage = 20) {
  const offset = Math.max(0, (page - 1) * perPage);
  const { rows, total } = await repo.findAuditLog(clubId, perPage, offset);

  return {
    total,
    page,
    perPage,
    changes: rows.map((row): TeamChange => ({
      id: row.id,
      // A write with nobody behind it is the database keeping itself in step,
      // which is honest to say rather than to attribute to whoever is looking.
      actor: row.actor_name.trim() || "The system",
      summary: summarise(row),
      at: row.created_at,
    })),
  };
}

/**
 * Every invitation waiting on the person reading, across every club.
 *
 * The notification links straight to the one it is about, so this is for
 * anybody who lost the link, read the bell on another device, or was invited
 * twice. A dead end is what the page it replaces was.
 */
export type PendingInvite = {
  token: string;
  clubName: string;
  clubSlug: string;
  /** Never null: an invitation to a role the app cannot name is dropped. */
  role: NonNullable<ClubRole>;
  sentAt: string;
  expired: boolean;
};

export async function getMyInvites(): Promise<PendingInvite[]> {
  const rows = await repo.findMyInvites().catch(() => []);
  const now = Date.now();

  return rows.flatMap((row) => {
    const club = (row as unknown as { clubs: { slug: string; name: string } | null }).clubs;
    if (!club) return [];
    const role = toClubRole(row.role);
    // An invitation to a role the app no longer knows about is not one this
    // page can describe, so it is left out rather than shown as blank.
    if (!role) return [];

    return [{
      token: row.token,
      clubName: club.name,
      clubSlug: club.slug,
      role,
      sentAt: row.created_at,
      expired: new Date(row.expires_at).getTime() < now,
    }];
  });
}

export type InviteWelcome = {
  clubName: string;
  clubSlug: string;
  role: NonNullable<ClubRole>;
  invitedBy: string;
  status: "open" | "expired" | "accepted" | "declined" | "withdrawn";
  hasAccount: boolean;
};

/** The invitation as a stranger sees it, before they have an account. */
export async function getInviteWelcome(token: string): Promise<InviteWelcome | null> {
  const rows = await repo.previewInvite(token).catch(() => []);
  const row = rows?.[0];
  const role = toClubRole(row?.role);
  if (!row || !role) return null;

  return {
    clubName: row.club_name,
    clubSlug: row.club_slug,
    role,
    invitedBy: row.invited_by,
    status: row.status,
    hasAccount: row.has_account,
  };
}
