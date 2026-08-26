import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import * as templates from "@/lib/email/templates";

/**
 * Membership emails.
 *
 * Kept apart from memberships.service so a mail failure can never roll back a
 * membership decision — the row is already written by the time these run, and
 * every function here swallows its own errors.
 */

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Addresses live in auth.users, not profiles, so this needs the admin client. */
async function recipient(profileId: string): Promise<{ email: string; name?: string } | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(profileId);
    if (error || !data.user?.email) return null;
    return {
      email: data.user.email,
      name: (data.user.user_metadata?.full_name as string) || undefined,
    };
  } catch {
    return null;
  }
}

async function deliver(profileId: string, make: (name?: string) => templates.Email) {
  const to = await recipient(profileId);
  if (!to) return;
  const message = make(to.name);
  const sent = await sendEmail({ to: to.email, ...message });
  if (!sent.ok) console.error("membership email failed", { profileId, subject: message.subject });
}

export async function notifyRequested(params: {
  applicantId: string;
  ownerId: string | null;
  clubName: string;
  clubSlug: string;
  applicantName: string;
}) {
  await deliver(params.applicantId, (name) =>
    templates.membershipRequested({
      name,
      clubName: params.clubName,
      url: `${siteUrl()}/clubs/${params.clubSlug}`,
    }),
  );

  // A club with no owner has nobody to tell. That is a data gap, not an error.
  if (!params.ownerId) return;
  await deliver(params.ownerId, () =>
    templates.membershipPendingForOwner({
      clubName: params.clubName,
      applicantName: params.applicantName,
      url: `${siteUrl()}/clubs/${params.clubSlug}/members`,
    }),
  );
}

export async function notifyApproved(params: {
  memberId: string;
  clubName: string;
  clubSlug: string;
  tierLabel?: string | null;
}) {
  await deliver(params.memberId, (name) =>
    templates.membershipApproved({
      name,
      clubName: params.clubName,
      tierLabel: params.tierLabel,
      url: `${siteUrl()}/clubs/${params.clubSlug}`,
    }),
  );
}

export async function notifyDeclined(params: {
  memberId: string;
  clubName: string;
  reason?: string | null;
}) {
  await deliver(params.memberId, (name) =>
    templates.membershipDeclined({
      name,
      clubName: params.clubName,
      reason: params.reason,
      url: `${siteUrl()}/clubs`,
    }),
  );
}
