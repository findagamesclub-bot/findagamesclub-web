import "server-only";

import * as repo from "@/repositories/clubTeam.repository";
import * as clubs from "@/repositories/memberships.repository";
import { notifyInvited } from "./team-notify.service";
import { getCurrentProfile } from "./auth.service";
import { isInvitableRole, ROLE_LABEL, toClubRole } from "@/utils/club-access";

/**
 * Changing who runs a club.
 *
 * Every rule is enforced by a function in 0067; this turns the code it raises
 * into a sentence. A message that says "NOT_PERMITTED" tells somebody they are
 * not allowed to do something without telling them why or what to do instead.
 */

export type WriteResult = { ok: true; notice: string } | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  NOT_SIGNED_IN: "Sign in first.",
  NOT_PERMITTED: "Only the club's owner can change who runs it.",
  TEAM_BAD_ROLE: "Pick either Manager or Helper.",
  TEAM_NO_ADDRESSEE: "Choose somebody from the roster, or type an email address.",
  TEAM_ALREADY_ON: "They are already on the team here.",
  TEAM_NOT_ON: "They are not on the team here.",
  TEAM_IS_OWNER: "The owner's role is changed by handing the club on, not from here.",
  INVITE_NOT_FOUND: "That invitation has already been used, or it was withdrawn.",
  INVITE_EXPIRED: "That invitation has expired. Ask the club to send a new one.",
  INVITE_NOT_YOURS: "That invitation was sent to somebody else.",
  TRANSFER_NO_TARGET: "Choose who the club is going to.",
  TRANSFER_SAME_PERSON: "They already own the club.",
  TRANSFER_NOT_CONNECTED:
    "Ownership can only go to somebody already on the team or an approved member.",
};

/** The raised code, or the raw message when it is not one we know. */
function explain(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  for (const [code, sentence] of Object.entries(MESSAGES)) {
    if (raw.includes(code)) return sentence;
  }
  return "That did not save. Try again, and tell us if it keeps happening.";
}

export async function inviteToTeam(
  clubId: number, role: string, email: string, profileId: string,
): Promise<WriteResult> {
  if (!isInvitableRole(role)) return { ok: false, error: MESSAGES.TEAM_BAD_ROLE! };

  // Named in the email, because "somebody has invited you" from an address you
  // do not recognise reads like a phishing attempt.
  const inviter = await getCurrentProfile();
  const inviterName = inviter?.full_name?.trim() || "The club";

  const person = profileId.trim() || null;
  const address = email.trim() || null;
  if (!person && !address) return { ok: false, error: MESSAGES.TEAM_NO_ADDRESSEE! };

  try {
    // The roster pick wins when both are filled in, because it is the one the
    // person actually chose from a list rather than typed.
    const inviteId = await repo.inviteTeamMember(clubId, role, person ? null : address, person);

    // The token is what the email has to carry, and the function returns only
    // the id, so the row is read back. Posting it must not be able to undo an
    // invitation that is already written, so it is caught here as well as
    // inside the notifier.
    try {
      const [invite, club] = await Promise.all([
        repo.findInviteById(inviteId),
        clubs.findClubBasics(clubId),
      ]);
      if (invite) {
        await notifyInvited({
          email: invite.email,
          profileId: invite.profile_id,
          clubName: club?.name ?? "a club",
          invitedBy: inviterName,
          role,
          token: invite.token,
        });
      }
    } catch (error) {
      console.error("team invite email failed", { error });
    }

    return {
      ok: true,
      notice: person
        ? "Invitation sent. It is in their notifications and on its way by email."
        : `Invitation sent to ${address}.`,
    };
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
}

export async function answerInvite(token: string, accept: boolean): Promise<WriteResult> {
  try {
    await repo.respondToInvite(token, accept);
    return {
      ok: true,
      notice: accept ? "You are on the team." : "Invitation declined.",
    };
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
}

export async function withdrawInvite(inviteId: number): Promise<WriteResult> {
  try {
    await repo.revokeInvite(inviteId);
    return { ok: true, notice: "Invitation withdrawn." };
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
}

export async function changeRole(
  clubId: number, profileId: string, role: string,
): Promise<WriteResult> {
  if (!isInvitableRole(role)) return { ok: false, error: MESSAGES.TEAM_BAD_ROLE! };
  try {
    await repo.setTeamRole(clubId, profileId, role);
    return { ok: true, notice: `They are a ${ROLE_LABEL[role].toLowerCase()} now.` };
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
}

export async function removeFromTeam(
  clubId: number, profileId: string,
): Promise<WriteResult> {
  try {
    await repo.removeTeamMember(clubId, profileId);
    return { ok: true, notice: "Removed from the team." };
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
}

export async function handOnClub(
  clubId: number, toProfileId: string,
): Promise<WriteResult> {
  if (!toProfileId.trim()) return { ok: false, error: MESSAGES.TRANSFER_NO_TARGET! };
  try {
    await repo.transferOwnership(clubId, toProfileId.trim());
    return {
      ok: true,
      notice: "The club is theirs. You are a manager here now.",
    };
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
}

/** Who ownership may be handed to: the team, minus whoever holds it now. */
export async function getTransferCandidates(clubId: number) {
  const rows = await repo.findTeam(clubId).catch(() => []);
  return rows
    .filter((row) => toClubRole(row.role) !== "owner")
    .map((row) => ({
      profileId: row.profile_id,
      name: row.profiles?.full_name?.trim() || "A member",
      role: toClubRole(row.role),
    }));
}
