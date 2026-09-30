import "server-only";

import { sendEmail } from "@/lib/email/send";
import * as templates from "@/lib/email/templates";
import { deliver, siteUrl } from "./mail-recipient.service";
import { findSiteSettings } from "@/repositories/siteSettings.repository";

/** The emails a claim generates. Apart from the writes, like every other one. */

export async function claimReceived(
  claimantId: string, club: { slug: string; name: string; city: string },
  claimantName: string, claimId: number,
) {
  await deliver(claimantId, "club-claim", (name) => templates.claimReceived({
    name,
    clubName: club.name,
    url: `${siteUrl()}/clubs/${club.slug}`,
  }));

  try {
    const settings = await findSiteSettings();
    const to = (settings?.contact_email ?? "").trim();
    if (!to) return;

    await sendEmail({
      to,
      ...templates.claimSubmittedAdmin({
        clubName: club.name,
        city: club.city,
        claimantName: claimantName || "Somebody",
        url: `${siteUrl()}/admin/claims/${claimId}`,
      }),
    });
  } catch (error) {
    console.error("[claims] the queue notice did not send", error);
  }
}

export async function claimApproved(
  claimantId: string, club: { slug: string; name: string },
) {
  await deliver(claimantId, "claim-approved", (name) => templates.claimApproved({
    name,
    clubName: club.name,
    consoleUrl: `${siteUrl()}/clubs/${club.slug}/manage`,
    url: `${siteUrl()}/clubs/${club.slug}`,
  }));
}

export async function claimDeclined(
  claimantId: string, clubName: string, reason: string,
) {
  await deliver(claimantId, "claim-declined", (name) => templates.claimDeclined({
    name, clubName, reason,
  }));
}
