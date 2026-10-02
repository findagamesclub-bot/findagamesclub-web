import { NextResponse } from "next/server";

import { cronRefusal } from "../guard";
import * as repo from "@/repositories/billing.repository";
import * as notify from "@/services/billing-notify.service";
import * as featuredRepo from "@/repositories/featured.repository";
import * as featuredNotify from "@/services/featured-notify.service";

/**
 * The letters time sends.
 *
 * Cron is for time passing, not for reads (scale rule 6). Standing is computed
 * on read by the view, so this job never decides that a club has lapsed: it
 * asks who crossed a line today, writes to them, and closes the ones past
 * grace. A club whose grace ends on a Sunday is lapsed on Sunday whether or not
 * anybody's cron woke up.
 *
 * Three stages in one pass, because they are three questions about the same
 * table and splitting them would mean three schedules to get wrong.
 *
 * Guarded by `CRON_SECRET`. Without it set the route refuses outright rather
 * than running open, because a job that emails every club in the directory is
 * not a thing to leave on the public internet by omission.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const refusal = cronRefusal(request);
  if (refusal) return refusal;

  // Featured slots first, and deliberately outside everything below.
  //
  // A slot ends on its own, which is 0113's design and the right one, but the
  // cost is that nothing happens at the moment a date passes and the club has
  // to be told by somebody asking. It is not governed by the billing switch:
  // a club can be on the front page while charging for listings is off, so
  // putting this under the `enabled` return would have meant the one case that
  // actually happens today never being announced.
  let featuredEnded = 0;
  try {
    for (const slot of await featuredRepo.findEndedSlotsAsJob()) {
      // Stamp and ring the bell in one statement, then write. False means
      // somebody else got there first, which is what makes a job that runs
      // twice in a day harmless rather than a second letter.
      if (!await featuredRepo.markFeaturedAnnouncedAsJob(slot.slot_id)) continue;
      await featuredNotify.featuredEnded(
        { slug: slot.club_slug, name: slot.club_name, ownerId: slot.owner_id },
        slot.starts_on, slot.ends_on);
      featuredEnded += 1;
    }
  } catch (error) {
    // Logged and carried, not fatal: the slots are nobody's money and the
    // three billing stages underneath are.
    console.error("[billing] the featured stage failed", error);
  }

  // Read as the job, and let a failure be a failure. Going through the
  // ordinary settings read meant an unreadable table came back as "off", and
  // the job answered "Billing is switched off" every night while billing was
  // on. A no-op that looks like a decision is the worst kind of silence.
  let settings;
  try {
    settings = await repo.findBillingSettingsAsJob();
  } catch (error) {
    console.error("[billing] could not read the settings", error);
    return NextResponse.json(
      { error: "Could not read the billing settings, so no chasing was done.",
        featuredEnded },
      { status: 500 });
  }

  if (!settings) {
    return NextResponse.json(
      { error: "There is no billing settings row, so no chasing was done.",
        featuredEnded },
      { status: 500 });
  }

  // Nothing to chase while billing is off, and writing to forty clubs about a
  // charge that does not exist is the worst possible way to find that out.
  if (!settings.enabled) {
    return NextResponse.json({
      ran: false, reason: "Billing is switched off.", featuredEnded });
  }

  const done = { reminded: 0, overdue: 0, lapsed: 0 };
  // Named, so a failure says which stage stopped and how far it got. A cron
  // that answers 500 with no body tells whoever reads the log nothing.
  let stage = "reminder";

  try {
  const reminders = await repo.findDueAsJob("reminder");
  for (const row of reminders) {
    if (!row.club_id) continue;
    await notify.renewalDue(
      { slug: row.club_slug, name: row.club_name, ownerId: row.owner_id },
      row.price_pence, row.period_end, row.days_left);
    done.reminded += 1;
  }

  stage = "ending";
  const ending = await repo.findDueAsJob("ending");
  for (const row of ending) {
    if (!row.club_id) continue;
    const graceEnds = new Date(row.period_end);
    graceEnds.setUTCDate(graceEnds.getUTCDate() + settings.grace_period_days);
    await notify.renewalOverdue(
      { slug: row.club_slug, name: row.club_name, ownerId: row.owner_id },
      row.price_pence, graceEnds.toISOString().slice(0, 10));
    done.overdue += 1;
  }

  stage = "grace_over";
  const over = await repo.findDueAsJob("grace_over");
  for (const row of over) {
    // The letter first, then the switch. If expiring throws, somebody has
    // still been told, which is the half that cannot be done late.
    await notify.listingLapsed(
      { slug: row.club_slug, name: row.club_name, ownerId: row.owner_id },
      row.price_pence, settings.auto_hide_lapsed);
    await notify.overdueForUs(row.club_name, row.price_pence, row.period_end);
    await repo.expireSubscriptionAsJob(row.subscription_id).catch((error: unknown) => {
      console.error("[billing] could not expire a subscription", error);
    });
    done.lapsed += 1;
  }

  } catch (error) {
    console.error(`[billing] the ${stage} stage failed`, error);
    return NextResponse.json(
      { error: `The ${stage} stage failed, so the run stopped there.`,
        featuredEnded, ...done },
      { status: 500 });
  }

  return NextResponse.json({ ran: true, featuredEnded, ...done });
}
