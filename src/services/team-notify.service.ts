import "server-only";

import * as templates from "@/lib/email/templates";
import { deliver, siteUrl } from "./mail-recipient.service";
import { sendEmail } from "@/lib/email/send";

/**
 * Team emails.
 *
 * Apart from clubTeam.service for the same reason membership-notify is apart
 * from memberships: the row is already written by the time these run, and a
 * mail failure must never undo an invitation. Every function here swallows its
 * own errors.
 *
 * An invitation is the one email in the app that has to reach somebody with no
 * account, so it posts to a raw address rather than looking a profile up.
 */

export async function notifyInvited(params: {
  email: string | null;
  profileId: string | null;
  clubName: string;
  invitedBy: string;
  role: "manager" | "helper";
  token: string;
}) {
  const url = `${siteUrl()}/team/invites/${params.token}`;
  const message = (name?: string) => templates.teamInvite({
    name, clubName: params.clubName, invitedBy: params.invitedBy,
    role: params.role, url,
  });

  // Somebody with an account gets it at the address they signed up with, which
  // is the one they read. The address typed into the form may be a work one
  // they never check.
  if (params.profileId) {
    await deliver(params.profileId, message);
    return;
  }

  if (!params.email) return;
  try {
    const sent = await sendEmail({ to: params.email, ...message() });
    if (!sent.ok) console.error("team invite email failed", { email: params.email });
  } catch (error) {
    console.error("team invite email failed", { error });
  }
}

export async function notifyInviteAnswered(params: {
  inviterId: string;
  clubName: string;
  personName: string;
  accepted: boolean;
}) {
  await deliver(params.inviterId, (name) =>
    templates.teamInviteAnswered({
      name, clubName: params.clubName,
      personName: params.personName, accepted: params.accepted,
    }),
  );
}

export async function notifyRoleChanged(params: {
  profileId: string;
  clubName: string;
  clubSlug: string;
  role: "manager" | "helper";
}) {
  await deliver(params.profileId, (name) =>
    templates.teamRoleChanged({
      name, clubName: params.clubName, role: params.role,
      url: `${siteUrl()}/clubs/${params.clubSlug}/manage`,
    }),
  );
}
