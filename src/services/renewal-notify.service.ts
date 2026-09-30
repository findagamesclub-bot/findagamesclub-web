import "server-only";

import * as jobs from "@/repositories/cronJobs.repository";
import * as templates from "@/lib/email/templates";
import { deliver, siteUrl } from "./mail-recipient.service";
import { nightLabel } from "@/utils/dates";

/**
 * Membership renewals, by email.
 *
 * 0028 already warns the bell a week ahead. This is the other half: a bell
 * notice is only seen by somebody who opens the site, and the person whose
 * membership is about to run out is exactly the person who has not been in for
 * a while.
 *
 * Every send is claimed in the delivery ledger first, keyed on the period that
 * is ending. A job that watches a date pass has no row of its own to prove it
 * has already written, so without the claim a daily run would send the same
 * warning seven days running.
 */
export async function runRenewalReminders() {
  const done = { expiring: 0, lapsed: 0 };

  for (const row of await jobs.findExpiringMemberships("7 days")) {
    const period = row.ends_at.slice(0, 10);
    if (!(await jobs.claimDelivery(row.profile_id, "membership_expiring", `${row.membership_id}:${period}`))) {
      continue;
    }
    await deliver(row.profile_id, "membership_expiring", (name) =>
      templates.membershipExpiring({
        name,
        clubName: row.club_name,
        endsOn: nightLabel(period),
        url: `${siteUrl()}/account/memberships`,
      }));
    done.expiring += 1;
  }

  for (const row of await jobs.findLapsedMemberships("25 hours")) {
    const period = row.ends_at.slice(0, 10);
    if (!(await jobs.claimDelivery(row.profile_id, "membership-lapsed", `${row.membership_id}:${period}`))) {
      continue;
    }
    await deliver(row.profile_id, "membership-lapsed", (name) =>
      templates.membershipLapsed({
        name,
        clubName: row.club_name,
        url: `${siteUrl()}/account/memberships`,
      }));
    done.lapsed += 1;
  }

  return done;
}
