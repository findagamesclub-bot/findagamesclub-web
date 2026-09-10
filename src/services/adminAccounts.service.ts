import "server-only";

import * as repo from "@/repositories/adminAccounts.repository";
import { sendRecoveryEmail } from "./auth.service";
import { siteUrl } from "./mail-recipient.service";
import { sendEmail } from "@/lib/email/send";
import * as templates from "@/lib/email/templates";

/**
 * Accounts, as the admin console needs them.
 *
 * Every write here does two things that must not get out of step: the database
 * gate, and Supabase Auth. The database goes first, always. If it refuses, the
 * auth call never happens, so a member cannot reach the service-role client by
 * calling the action with somebody else's id.
 */

export type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  joined: string;
  clubsOwned: number;
  memberships: number;
  /** What they run, up to three: "Owner of Didcot Wargames". Usually empty. */
  teamRoles: string;
};

export type AccountPage = {
  accounts: Account[];
  total: number;
  page: number;
  perPage: number;
};

export type AdminWriteResult = { ok: true; notice: string } | { ok: false; error: string };

const STATUSES = [
  "all", "active", "suspended", "admin",
  // The club roles, and having joined one at all.
  "owner", "manager", "helper", "member",
] as const;
export type AccountStatus = (typeof STATUSES)[number];

export function toStatus(value: string | undefined): AccountStatus {
  return STATUSES.includes(value as AccountStatus) ? (value as AccountStatus) : "all";
}

const nameOf = (full: string | null) => full?.trim() || "No name yet";

export async function listAccounts(
  query: string, status: AccountStatus, page: number, perPage = 25,
): Promise<AccountPage> {
  const offset = Math.max(0, (page - 1) * perPage);
  const rows = await repo.findAccounts(query.trim(), status, perPage, offset);

  return {
    // The exact total rides along on every row, so the pager is right without
    // a second count query. An empty page means an empty result.
    total: rows[0]?.total_count ?? 0,
    page,
    perPage,
    accounts: rows.map((row) => ({
      id: row.id,
      name: nameOf(row.full_name),
      email: row.email ?? "",
      role: row.role,
      active: row.is_active,
      joined: row.created_at,
      clubsOwned: row.clubs_owned,
      memberships: row.memberships,
      teamRoles: row.team_roles ?? "",
    })),
  };
}

export async function getAccount(profileId: string) {
  const [row, actions] = await Promise.all([
    repo.findAccount(profileId),
    repo.findAccountActions(profileId).catch(() => []),
  ]);
  if (!row) return null;

  return {
    account: {
      id: row.id,
      name: nameOf(row.full_name),
      email: row.email ?? "",
      role: row.role,
      active: row.is_active,
      joined: row.created_at,
      lastSeen: row.last_sign_in_at,
    },
    history: actions.map((a) => ({
      id: a.id,
      action: a.action,
      reason: a.reason,
      actor: a.actor_name.trim() || "An admin",
      at: a.created_at,
    })),
  };
}

const MESSAGES: Record<string, string> = {
  NOT_PERMITTED: "Only a site admin can do that.",
  ACCOUNT_SELF: "You cannot do that to your own account.",
  ACCOUNT_NOT_FOUND: "That account could not be found.",
  ACCOUNT_BAD_ROLE: "Pick either Member or Admin.",
};

function explain(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  for (const [code, sentence] of Object.entries(MESSAGES)) {
    if (raw.includes(code)) return sentence;
  }
  return "That did not save. Try again, and tell us if it keeps happening.";
}

export async function suspendAccount(
  profileId: string, reason: string,
): Promise<AdminWriteResult> {
  try {
    await repo.setAccountActive(profileId, false, reason);
  } catch (error) {
    return { ok: false, error: explain(error) };
  }

  try {
    await repo.banAuthUser(profileId, true);
  } catch {
    // The database gate is already closed, so they cannot write anything. Say
    // so plainly rather than reporting a clean success.
    return {
      ok: false,
      error: "Suspended, but signing them out failed. They cannot change anything; try again to end their session.",
    };
  }

  const told = await tell(profileId, (name) => templates.accountSuspended({
    name, reason, contactUrl: `${siteUrl()}/contact`,
  }));

  return {
    ok: true,
    notice: told
      ? "Account suspended and signed out. They have been emailed."
      : "Account suspended and signed out, but the email did not send.",
  };
}

export async function restoreAccount(profileId: string): Promise<AdminWriteResult> {
  try {
    await repo.setAccountActive(profileId, true, "");
    await repo.banAuthUser(profileId, false);
  } catch (error) {
    return { ok: false, error: explain(error) };
  }

  // Told as well, or somebody who was locked out never finds out they are not
  // any more: they stopped trying the day it stopped working.
  const told = await tell(profileId, (name) => templates.accountRestored({
    name, signInUrl: `${siteUrl()}/auth/sign-in`,
  }));

  return {
    ok: true,
    notice: told
      ? "Account restored. They can sign in again and have been emailed."
      : "Account restored, but the email did not send.",
  };
}

/**
 * Email the person an action was taken against.
 *
 * Never throws and never undoes anything: the decision is already made and
 * saved, and a mail outage must not turn a suspension into a half-suspension.
 * The caller reports what happened instead of guessing.
 */
async function tell(
  profileId: string,
  compose: (name?: string) => { subject: string; html: string; text: string },
): Promise<boolean> {
  try {
    const row = await repo.findAccount(profileId);
    const to = row?.email;
    if (!to) return false;

    const sent = await sendEmail({ to, ...compose(row.full_name?.trim() || undefined) });
    return sent.ok;
  } catch {
    return false;
  }
}

export async function changeAccountRole(
  profileId: string, role: string,
): Promise<AdminWriteResult> {
  try {
    await repo.setAccountRole(profileId, role);
    return {
      ok: true,
      notice: role === "admin"
        ? "They are a site admin now."
        : "Their admin access has been removed.",
    };
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
}

export async function resetAccountPassword(email: string): Promise<AdminWriteResult> {
  if (!email) return { ok: false, error: "That account has no email address." };
  try {
    // The same send as the public "forgot your password" link, so somebody an
    // admin helps gets the same email as somebody who asked for it themselves.
    const sent = await sendRecoveryEmail(email);
    if (!sent.ok) return { ok: false, error: sent.error };
    return { ok: true, notice: `Reset email sent to ${email}.` };
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
}

/**
 * Just the name and address, for naming somebody an admin is writing to.
 *
 * getAccount above also loads their memberships, their clubs and the actions
 * taken against them, which a conversation header has no use for.
 */
export async function getAccountBrief(profileId: string) {
  const row = await repo.findAccount(profileId).catch(() => null);
  if (!row) return null;
  return { id: row.id, name: nameOf(row.full_name), email: row.email ?? "" };
}
