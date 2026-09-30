import "server-only";

import { sendEmail } from "@/lib/email/send";
import * as templates from "@/lib/email/templates";
import { deliver, siteUrl } from "./mail-recipient.service";
import { findSiteSettings } from "@/repositories/siteSettings.repository";
import { formatPence } from "@/utils/format";
import { shortDate } from "@/utils/dates";

/** `shortDate` returns null on anything it cannot read, and an email cannot. */
const day = (iso: string | null | undefined, fallback: string) =>
  (iso ? shortDate(iso.slice(0, 10)) : null) ?? fallback;

/**
 * The emails money generates.
 *
 * Apart from the writes, for the reason every other notify service is: a mail
 * failure must never undo a payment that has already been recorded. Nothing
 * here is awaited for a result and nothing throws.
 */

const billingUrl = (slug: string) => `${siteUrl()}/clubs/${slug}/manage/billing`;

type Club = { slug: string; name: string; ownerId: string | null };

export async function paymentReceived(
  club: Club, amountPence: number, paidTo: string | null,
) {
  if (!club.ownerId) return;
  await deliver(club.ownerId, "listing-payment-received", (name) => templates.paymentReceived({
    name,
    clubName: club.name,
    amount: formatPence(amountPence),
    paidTo: day(paidTo, "your next renewal"),
    url: billingUrl(club.slug),
  }));
}

export async function renewalDue(
  club: Club, amountPence: number, dueOn: string, daysLeft: number,
) {
  if (!club.ownerId) return;
  await deliver(club.ownerId, "listing-renewal-due", (name) => templates.renewalDue({
    name,
    clubName: club.name,
    amount: formatPence(amountPence),
    dueOn: day(dueOn, "soon"),
    daysLeft,
    url: billingUrl(club.slug),
  }));
}

export async function renewalOverdue(
  club: Club, amountPence: number, graceEnds: string,
) {
  if (!club.ownerId) return;
  await deliver(club.ownerId, "listing-overdue", (name) => templates.renewalOverdue({
    name,
    clubName: club.name,
    amount: formatPence(amountPence),
    graceEnds: day(graceEnds, "shortly"),
    url: billingUrl(club.slug),
  }));
}

export async function listingLapsed(
  club: Club, amountPence: number, hidden: boolean,
) {
  if (!club.ownerId) return;
  await deliver(club.ownerId, "listing-lapsed", (name) => templates.listingLapsed({
    name,
    clubName: club.name,
    amount: formatPence(amountPence),
    hidden,
    url: billingUrl(club.slug),
  }));
}

/** One message to the site contact address, whatever the number of admins. */
export async function overdueForUs(
  clubName: string, amountPence: number, dueOn: string,
) {
  try {
    const settings = await findSiteSettings();
    const to = (settings?.contact_email ?? "").trim();
    if (!to) return;

    await sendEmail({
      to,
      ...templates.paymentDueAdmin({
        clubName,
        amount: formatPence(amountPence),
        dueOn: day(dueOn, "recently"),
        url: `${siteUrl()}/admin/billing`,
      }),
    });
  } catch (error) {
    console.error("[billing] the overdue notice did not send", error);
  }
}
