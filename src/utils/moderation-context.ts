/**
 * Where a reported thing can be read in the place it was said (0189).
 *
 * The client's words: "can we add a link/button to the board comment, reply,
 * message or review so the admin can easily see the full context of the board
 * or message." A queue card carries the words and the reason, which is enough
 * to answer an obvious one and not enough for anything borderline: a reply
 * reads very differently depending on what it is replying to.
 *
 * Built here rather than in SQL. The queue returns which thread to open and
 * which event it hangs off, because those are facts about the data; what the
 * route is called is a fact about this app, and a path stored in a function
 * would have to be found and changed the next time one moved.
 *
 * A reply has no page of its own, so both kinds of reply open their PARENT
 * thread, which is the context anyway.
 */

export type ContextRow = {
  target_type: string;
  club_slug: string;
  context_id: number | null;
  event_key: string;
  target_gone: boolean;
};

export type ModerationContext = { href: string; label: string };

/**
 * Null where there is nowhere to go, which is three cases and not one.
 *
 * A private message has no page: `/admin/messages` is the admin's own inbox
 * and nothing on this site shows one person somebody else's conversation.
 * Anything already taken down has no page either, because the queue only
 * resolves a thread for content that is still there. And a club that has gone
 * takes its board with it.
 */
export function moderationContext(row: ContextRow): ModerationContext | null {
  if (row.target_gone || !row.club_slug) return null;

  const club = `/clubs/${row.club_slug}`;

  switch (row.target_type) {
    case "review":
      // The club page's own Reviews section, by the id `Section` derives from
      // its title. No thread to open: a review is read where it sits.
      return { href: `${club}#reviews`, label: "Open the club page" };

    case "post":
    case "reply":
      return row.context_id
        ? { href: `${club}/board/${row.context_id}`, label: "Open the thread" }
        : null;

    case "event_post":
    case "event_reply":
      return row.context_id && row.event_key
        ? {
          href: `${club}/events/${row.event_key}/board/${row.context_id}`,
          label: "Open the thread",
        }
        : null;

    default:
      return null;
  }
}
