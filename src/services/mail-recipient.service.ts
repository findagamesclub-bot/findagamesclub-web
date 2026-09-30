import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { UNSUBSCRIBE_SLOT, unsubscribeLine } from "@/lib/email/templates/layout";
import type { Email } from "@/lib/email/templates";
import {
  savedPreferencesFor, unsubscribeToken,
} from "@/repositories/notificationPrefs.repository";
import {
  FAMILY_META, emailOffFamilies, familyFor,
  type Family, type NotificationKind,
} from "@/utils/notification-families";

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

/**
 * Look the person up, check they still want this, write it, post it.
 *
 * `kind` is required and typed, so a sender that forgets the gate does not
 * compile. That is the whole of "one place decides whether to send": there are
 * forty-five notification kinds and thirty senders, and the day one of them
 * remembers on its own is the day the next one forgets.
 *
 * A kind nobody has placed in a family is sent. A feature added later is then
 * noisy rather than silently muted, which is the failure somebody notices.
 */
export async function deliver(
  profileId: string, kind: NotificationKind, make: (name?: string) => Email,
) {
  try {
    const family = familyFor(kind);
    const locked = family ? Boolean(FAMILY_META[family].locked) : false;

    if (family && !locked && (await emailOffFamilies(
      // A read we could not do falls back to the defaults, which is what a new
      // account gets. Sending everything on a failed read would defeat the two
      // families that default to off, and dropping everything would lose a
      // receipt; the defaults are the only answer that is right either way.
      (await savedPreferencesFor(profileId)) ?? [],
    )).has(family)) return;

    const to = await recipient(profileId);
    if (!to) return;

    const message = make(to.name);
    const url = family && !locked
      ? await unsubscribeUrl(profileId, family)
      : null;

    const sent = await sendEmail({
      to: to.email,
      ...message,
      html: message.html.replace(UNSUBSCRIBE_SLOT, footerLine(url, family)),
      // The plain-text part carries it too. A reader whose client shows text
      // only would otherwise have the header and nothing they can click.
      text: url ? `${message.text}\n\nTo stop these emails: ${url}` : message.text,
      // What makes Gmail and Apple Mail show their own unsubscribe button, and
      // what an inbox provider looks for before deciding this is bulk mail.
      headers: url
        ? {
            "List-Unsubscribe": `<${url}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
    });
    if (!sent.ok) console.error("email failed", { profileId, subject: message.subject });
  } catch (error) {
    console.error("email failed", { profileId, error });
  }
}

async function unsubscribeUrl(profileId: string, family: Family) {
  const token = await unsubscribeToken(profileId, family);
  return token ? `${siteUrl()}/unsubscribe/${token}` : null;
}

/** Nothing at all for a locked family: a switch that does not exist is worse
    than no switch. */
function footerLine(url: string | null, family: Family | null): string {
  if (!url || !family) return "";
  return unsubscribeLine(
    url, FAMILY_META[family].label.toLowerCase(), `${siteUrl()}/account/notifications`);
}
