import "server-only";

import * as jobs from "@/repositories/cronJobs.repository";
import * as templates from "@/lib/email/templates";
import { listEvents } from "@/services/events.service";
import { deliver, siteUrl } from "./mail-recipient.service";
import { nightLabel } from "@/utils/dates";

/**
 * Saved searches, answered once a day.
 *
 * The matching runs through `listEvents`, the same call the events page makes,
 * with the filters exactly as they were saved. A second implementation in SQL
 * would be two sets of rules for one saved search, and the day they disagreed
 * the member would be told about an event their own saved search does not show.
 *
 * "New" means listed since the last digest, or since the alert was saved on the
 * first run. Somebody who saves a search today hears about what appears after
 * today rather than about the whole directory at once.
 */
const MOST = 8;

export async function runEventAlerts(limit = 200) {
  const due = await jobs.findDueAlerts(limit);
  const done = { looked: due.length, sent: 0 };
  if (!due.length) return done;

  for (const alert of due) {
    try {
      const fresh = await matchesSince(alert);
      if (fresh.length) {
        await sendDigest(alert, fresh);
        done.sent += 1;
      }
    } catch (error) {
      // One broken search must not stop the other hundred and ninety-nine.
      console.error("[alerts] one search failed", { id: alert.id, error });
    }
  }

  // Marked whether or not anything matched. A search with no new events has
  // still been looked at, and re-looking every hour is waste.
  await jobs.markAlertsSent(due.map((alert) => alert.id));
  return done;
}

async function matchesSince(alert: jobs.DueAlert) {
  const { events } = await listEvents({ ...(alert.filters ?? {}) });
  const since = new Date(alert.since).getTime();
  return events
    .filter((event) => new Date(event.createdAt).getTime() > since)
    .slice(0, MOST);
}

async function sendDigest(
  alert: jobs.DueAlert, events: Awaited<ReturnType<typeof matchesSince>>,
) {
  const query = new URLSearchParams(alert.filters ?? {}).toString();

  await deliver(alert.profile_id, "event-alert", (name) =>
    templates.eventAlertDigest({
      name,
      label: alert.label,
      events: events.map((event) => ({
        title: event.title,
        clubName: event.club.name,
        when: event.startDate ? nightLabel(event.startDate) : "",
        url: `${siteUrl()}/clubs/${event.club.slug}/events/${event.legacyId}`,
      })),
      url: `${siteUrl()}/events${query ? `?${query}` : ""}`,
    }));
}
