import "server-only";

import * as templates from "@/lib/email/templates";
import { deliver, siteUrl } from "./mail-recipient.service";

/**
 * Membership emails.
 *
 * Kept apart from memberships.service so a mail failure can never roll back a
 * membership decision — the row is already written by the time these run.
 */

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

export async function notifyTierRequested(params: {
  ownerId: string | null;
  clubName: string;
  clubSlug: string;
  memberName: string;
  tierLabel: string;
}) {
  if (!params.ownerId) return;
  await deliver(params.ownerId, () =>
    templates.tierUpgradeForOwner({
      clubName: params.clubName,
      memberName: params.memberName,
      tierLabel: params.tierLabel,
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

/** A receipt for money the club recorded, not money we took. */
export async function notifyPaid(params: {
  memberId: string;
  clubName: string;
  clubSlug: string;
  tierLabel: string;
  billingLabel: string;
  price: string;
  periodEnd: string | null;
}) {
  await deliver(params.memberId, (name) =>
    templates.membershipPaid({
      name,
      clubName: params.clubName,
      tierLabel: params.tierLabel,
      billingLabel: params.billingLabel,
      price: params.price,
      paidUntil: params.periodEnd
        ? new Date(params.periodEnd).toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric",
          })
        : null,
      url: `${siteUrl()}/clubs/${params.clubSlug}`,
    }),
  );
}

export async function notifyTierChanged(params: {
  memberId: string;
  clubName: string;
  clubSlug: string;
  tierLabel: string;
}) {
  await deliver(params.memberId, (name) =>
    templates.tierChanged({
      name,
      clubName: params.clubName,
      tierLabel: params.tierLabel,
      url: `${siteUrl()}/clubs/${params.clubSlug}`,
    }),
  );
}
