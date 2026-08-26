import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import * as templates from "@/lib/email/templates";
import { nightLabel } from "@/utils/dates";
import { formatPrice } from "@/utils/format";

/**
 * Booking emails.
 *
 * Legacy sends none at all for table bookings — it writes an in-app message
 * from a synthetic "{Club} admin" sender that nobody reads (club_store.py:16468).
 * Waitlist promotion is the one that genuinely cannot go unsent: the member is
 * committed to a table, at a price, at a moment they were not looking at the
 * site and did not ask for.
 *
 * Kept apart from bookings.service so a mail failure can never fail the
 * cancellation that triggered it. Every function swallows its own errors.
 */

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

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

export async function notifyPromoted(params: {
  profileId: string;
  clubName: string;
  clubSlug: string;
  sessionDate: string;
  sessionTime: string;
  gameTitle: string;
  price?: string | null;
}) {
  try {
    const to = await recipient(params.profileId);
    if (!to) return;

    const message = templates.tablePromoted({
      name: to.name,
      clubName: params.clubName,
      night: nightLabel(params.sessionDate),
      time: params.sessionTime,
      gameTitle: params.gameTitle,
      price: formatPrice(params.price ?? ""),
      url: `${siteUrl()}/clubs/${params.clubSlug}/bookings`,
    });

    const sent = await sendEmail({ to: to.email, ...message });
    if (!sent.ok) console.error("promotion email failed", { profileId: params.profileId });
  } catch (error) {
    console.error("promotion notification failed", { error });
  }
}
