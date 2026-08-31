import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import type { Email } from "@/lib/email/templates";

/**
 * Addressing and posting a transactional email.
 *
 * Addresses live in auth.users rather than profiles, so the lookup needs the
 * admin client. Every function here swallows its own errors: an email is a
 * consequence of a write that has already happened, and a bounced message must
 * never turn a placed order into "could not place that order".
 */

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function recipient(
  profileId: string,
): Promise<{ email: string; name?: string } | null> {
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

/** Look the person up, write the message with their name, post it. */
export async function deliver(profileId: string, make: (name?: string) => Email) {
  try {
    const to = await recipient(profileId);
    if (!to) return;
    const message = make(to.name);
    const sent = await sendEmail({ to: to.email, ...message });
    if (!sent.ok) console.error("email failed", { profileId, subject: message.subject });
  } catch (error) {
    console.error("email failed", { profileId, error });
  }
}
