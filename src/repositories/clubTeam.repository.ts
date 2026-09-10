import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The club's team, its open invitations and its recent changes.
 *
 * Everything that writes goes through a function in 0067, so this file reads
 * rows and calls RPCs and does no authorisation of its own.
 *
 * `src/types/database.ts` predates 0067 and 0068. Same temporary narrowing as
 * memberRecords.repository.ts; delete once the types are regenerated.
 */

type Rows<T> = Promise<{
  data: T[] | null; error: { message: string } | null; count?: number | null;
}>;
type One<T> = Promise<{ data: T | null; error: { message: string } | null }>;

// Ordering is both a step and an end, because some of these reads page and
// some do not. Kept separate from Chain so `await table(...)` returns the
// builder rather than running the query.
type Ordered<T> = Rows<T> & { range(from: number, to: number): Rows<T> };

type Chain<T> = {
  select(columns: string, options?: { count: "exact" }): Chain<T>;
  eq(column: string, value: string | number): Chain<T>;
  is(column: string, value: null): Chain<T>;
  order(column: string, options?: { ascending: boolean }): Ordered<T>;
  maybeSingle(): One<T>;
};

async function table<T>(name: string): Promise<Chain<T>> {
  const supabase = await createClient();
  return (supabase as unknown as { from(n: string): Chain<T> }).from(name);
}

async function callRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc(n: string, a: Record<string, unknown>): Promise<{
      data: unknown; error: { message: string } | null;
    }>;
  }).rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type TeamRow = {
  club_id: number;
  profile_id: string;
  role: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
};

export type InviteRow = {
  id: number;
  club_id: number;
  email: string | null;
  profile_id: string | null;
  role: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  revoked_at: string | null;
  profiles: { full_name: string | null } | null;
  clubs: { slug: string; name: string; city: string | null } | null;
};

export type AuditRow = {
  id: number;
  actor_id: string | null;
  actor_name: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changed_keys: string[];
  /** Only the keys that moved, which is what the trigger stores. */
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
};

export type MyClubRow = {
  role: string;
  clubs: { id: number; slug: string; name: string; city: string | null } | null;
};

const TEAM_COLUMNS = `club_id, profile_id, role, created_at,
  profiles!club_team_profile_id_fkey(full_name)`;

const INVITE_COLUMNS = `id, club_id, email, profile_id, role, token, created_at,
  expires_at, accepted_at, declined_at, revoked_at,
  profiles!club_team_invites_profile_id_fkey(full_name),
  clubs!inner(slug, name, city)`;

/** The caller's role here, straight from the database rather than inferred. */
export const findMyRole = (clubId: number) =>
  callRpc<string | null>("club_role_of", { target_club: clubId });

export async function findTeam(clubId: number): Promise<TeamRow[]> {
  const { data, error } = await (await table<TeamRow>("club_team"))
    .select(TEAM_COLUMNS)
    .eq("club_id", clubId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load the team: ${error.message}`);
  return data ?? [];
}

/** Open invitations only. Answered ones show up in the audit log instead. */
export async function findOpenInvites(clubId: number): Promise<InviteRow[]> {
  const { data, error } = await (await table<InviteRow>("club_team_invites"))
    .select(INVITE_COLUMNS)
    .eq("club_id", clubId)
    .is("accepted_at", null)
    .is("declined_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load invitations: ${error.message}`);
  return data ?? [];
}

/** One invitation by its id, so the email can be sent with its token. */
export async function findInviteById(inviteId: number): Promise<InviteRow | null> {
  const { data, error } = await (await table<InviteRow>("club_team_invites"))
    .select(INVITE_COLUMNS)
    .eq("id", inviteId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load the invitation: ${error.message}`);
  return data;
}

/**
 * Every open invitation addressed to the person reading.
 *
 * The select policy already narrows to their own, by profile or by the address
 * on their sign-in, so this asks for nothing about who they are.
 */
export async function findMyInvites(): Promise<InviteRow[]> {
  const { data, error } = await (await table<InviteRow>("club_team_invites"))
    .select(INVITE_COLUMNS)
    .is("accepted_at", null)
    .is("declined_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load your invitations: ${error.message}`);
  return data ?? [];
}

/**
 * One invitation by its token, for the page that accepts it.
 *
 * The policy decides whether the reader may see it, so a token belonging to
 * somebody else comes back as no row rather than as a row this page then has
 * to be careful with.
 */
export async function findInviteByToken(token: string): Promise<InviteRow | null> {
  const { data, error } = await (await table<InviteRow>("club_team_invites"))
    .select(INVITE_COLUMNS)
    .eq("token", token)
    .maybeSingle();

  if (error) throw new Error(`Failed to load the invitation: ${error.message}`);
  return data;
}

/** Every club this person is on the team of, whatever their role. */
export async function findMyClubs(profileId: string): Promise<MyClubRow[]> {
  const { data, error } = await (await table<MyClubRow>("club_team"))
    .select("role, clubs!inner(id, slug, name, city)")
    .eq("profile_id", profileId)
    .order("club_id", { ascending: true });

  if (error) throw new Error(`Failed to load your clubs: ${error.message}`);
  return data ?? [];
}

export async function findAuditLog(clubId: number, limit: number, offset: number) {
  const { data, error, count } = await (await table<AuditRow>("club_audit_log"))
    .select(`id, actor_id, actor_name, entity_type, entity_id, action,
             changed_keys, before, after, created_at`, { count: "exact" })
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to load recent changes: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
}

export const inviteTeamMember = (
  clubId: number, role: string, email: string | null, profileId: string | null,
) => callRpc<number>("invite_club_team_member",
  { p_club: clubId, p_role: role, p_email: email, p_profile: profileId });

export const respondToInvite = (token: string, accept: boolean) =>
  callRpc<number>("respond_club_team_invite", { p_token: token, p_accept: accept });

export const revokeInvite = (inviteId: number) =>
  callRpc<number>("revoke_club_team_invite", { p_invite: inviteId });

export const setTeamRole = (clubId: number, profileId: string, role: string) =>
  callRpc<string>("set_club_team_role",
    { p_club: clubId, p_profile: profileId, p_role: role });

export const removeTeamMember = (clubId: number, profileId: string) =>
  callRpc<string>("remove_club_team_member", { p_club: clubId, p_profile: profileId });

export const transferOwnership = (clubId: number, toProfileId: string) =>
  callRpc<string>("transfer_club_ownership", { p_club: clubId, p_to: toProfileId });

export type InvitePreview = {
  club_name: string;
  club_slug: string;
  role: string;
  invited_by: string;
  status: "open" | "expired" | "accepted" | "declined" | "withdrawn";
  has_account: boolean;
};

/**
 * What an invitation is for, readable without an account.
 *
 * The policy on the table quite rightly hides the row from somebody who has
 * never signed in, which is exactly who a lot of invitations are for. This
 * returns only what the email already told them.
 */
export const previewInvite = (token: string) =>
  callRpc<InvitePreview[]>("invite_preview", { p_token: token });
