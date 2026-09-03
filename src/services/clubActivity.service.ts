import "server-only";

import * as repo from "@/repositories/clubActivity.repository";
import type { ActivityRow } from "@/repositories/clubActivity.repository";

/**
 * The club's recent activity, newest first.
 *
 * Legacy calls this the activity feed and builds it from twenty-two sources
 * (club_store.py:20666). We reported four, so a member who had bought
 * coaching, ordered from the shop and booked event tickets saw none of it and
 * reasonably asked what the panel was for.
 *
 * Eighteen kinds now. The three still missing are the army list and unit notes
 * on a result, and the badge ladder, all of which need the Army Builder in
 * Milestone 3.
 *
 * Every line is timestamped from a real row rather than invented, so an empty
 * feed means nothing has happened rather than that something failed.
 */
export type ActivityKind =
  | "join" | "tier" | "rival" | "booking" | "result" | "rivalry-result"
  | "lfg" | "lfg-matched" | "waitlist" | "ticket" | "order" | "coaching"
  | "post" | "reply" | "results" | "league" | "round" | "table";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  at: string;
  /** Null for a visitor, who gets the anonymised sentence in `what` instead. */
  who: string | null;
  what: string;
  detail: string | null;
  href: string | null;
};

/** The fortnight legacy shows (club_store.py:20670). Lately, not a log. */
const WINDOW_DAYS = 14;

/**
 * How much of the panel any one kind may take.
 *
 * Now that eighteen things feed this, a busy board can bury everything else:
 * Didcot alone has twenty-nine threads, and a fortnight of replies to them
 * would leave no room for the joins, orders and results a reader came for.
 * Legacy does not do this and its feed is the poorer for it.
 *
 * It is a ceiling on the second pass only. Every kind that happened at all
 * gets its newest line first, so the cap trims the loud kinds without ever
 * silencing a quiet one.
 */
const PER_KIND = 4;

const KINDS = new Set<string>([
  "join", "tier", "rival", "booking", "result", "rivalry-result",
  "lfg", "lfg-matched", "waitlist", "ticket", "order", "coaching",
  "post", "reply", "results", "league", "round", "table",
]);

/** Where a line goes when you click it. The database returns only the part it knows. */
function linkFor(kind: string, ref: string, slug: string): string | null {
  switch (kind) {
    case "join":
    case "tier":
    case "rival":
      return ref ? `/members/${ref}` : `/clubs/${slug}/members`;
    case "booking":
    case "result":
    case "lfg":
    case "lfg-matched":
    case "waitlist":
      return `/clubs/${slug}/bookings`;
    // The point of splitting this off from an ordinary result: it goes to the
    // two of them rather than to the night it happened on.
    case "rivalry-result":
      return ref ? `/clubs/${slug}/rivalries/${ref}` : `/clubs/${slug}/rivalries`;
    case "ticket":
    case "results":
      return ref ? `/clubs/${slug}/events/${ref}` : `/clubs/${slug}/events`;
    case "order":
      return `/clubs/${slug}/shop`;
    case "coaching":
      return `/clubs/${slug}/coaching`;
    case "post":
    case "reply":
      return ref ? `/clubs/${slug}/board/${ref}` : `/clubs/${slug}/board`;
    case "league":
    case "round":
    case "table":
      return `/clubs/${slug}/competitions`;
    default:
      return null;
  }
}

export async function getRecentActivity(
  clubId: number,
  slug: string,
  limit = 18,
): Promise<ActivityItem[]> {
  // Deeper than the panel shows, because the caps below throw some away and
  // the panel should still come back full.
  //
  // A feed is a nice-to-have on a page full of other things: it should never
  // be the reason a club page fails to load.
  const rows: ActivityRow[] = await repo
    .findActivityFeed(clubId, WINDOW_DAYS, limit * 5)
    .catch(() => []);

  const now = Date.now();
  // The same person looking for the same game three times is one fact to a
  // reader, and three lines of it makes the panel look broken. Keeping the
  // newest is right: the feed answers "what is happening", not "how many times
  // did somebody press the button".
  //
  // The detail line is part of the key, or two different shop orders by the
  // same person would collapse into one now that the sentence above them is
  // just "ordered from the club shop". The kinds this rule exists for, looking
  // for a game chief among them, carry no detail, so it still catches them.
  const said = new Set<string>();
  const usable: ActivityRow[] = [];

  for (const row of rows) {
    // An unknown kind means the database is ahead of this file. Drop it rather
    // than render a line with no icon and no link.
    if (!KINDS.has(row.kind)) continue;
    // Results are timestamped from their event's date, and an event can be in
    // the future. Left in, next month's tournament sits at the top of a panel
    // headed LAST 14 DAYS, dated "today", for something nobody has played yet.
    if (new Date(row.at).getTime() > now) continue;

    const sentence = `${row.kind}|${row.who ?? ""}|${row.what}|${row.detail ?? ""}`;
    if (said.has(sentence)) continue;
    said.add(sentence);

    usable.push(row);
  }

  // Newest of each kind first, then fill up chronologically.
  //
  // Straight chronological with only a per-kind cap answers the client's
  // question, "does this report on all key events?", with no. Didcot's last
  // fortnight holds fifteen kinds, and the five busiest of them filled every
  // row between them: two people joined the club and neither appeared.
  // Something that happened once in a fortnight is the most newsworthy line in
  // the panel, not the most expendable.
  const picked = new Set<string>();
  const used = new Map<string, number>();
  const take = (row: ActivityRow) => {
    picked.add(row.id);
    used.set(row.kind, (used.get(row.kind) ?? 0) + 1);
  };

  for (const row of usable) {
    if (picked.size >= limit) break;
    if (!used.has(row.kind)) take(row);
  }
  for (const row of usable) {
    if (picked.size >= limit) break;
    if (picked.has(row.id)) continue;
    if ((used.get(row.kind) ?? 0) >= PER_KIND) continue;
    take(row);
  }

  // `usable` is already newest first, so filtering it back down keeps the
  // panel reading as a feed rather than as a ranking.
  return usable
    .filter((row) => picked.has(row.id))
    .map((row) => ({
      id: row.id,
      kind: row.kind as ActivityKind,
      at: row.at,
      who: row.who,
      what: row.what,
      detail: row.detail,
      // A visitor's rows carry no ref, and every destination behind them is
      // members-only anyway: a chevron there leads to a locked door.
      href: row.who ? linkFor(row.kind, row.ref, slug) : null,
    }));
}
