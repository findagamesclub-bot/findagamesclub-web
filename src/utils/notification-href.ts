/**
 * Where a notification should actually take the person reading it.
 *
 * The link is written when the notice is created, and by then it has already
 * guessed which shell the reader uses. That guess goes stale: somebody made an
 * admin today has a week of notices pointing at the member area, and an admin
 * who stands down has the reverse. The role at reading time is the one that
 * matters, so the stored path is corrected on the way out.
 *
 * Only messages move. Everything else lives at one address whoever opens it.
 */
const MEMBER_INBOX = "/account/messages/";
const ADMIN_INBOX = "/admin/messages/";

export function notificationHref(href: string | null | undefined, isAdmin: boolean): string {
  const path = String(href ?? "").trim();
  if (!path) return "";

  if (isAdmin && path.startsWith(MEMBER_INBOX)) {
    return ADMIN_INBOX + path.slice(MEMBER_INBOX.length);
  }
  if (!isAdmin && path.startsWith(ADMIN_INBOX)) {
    return MEMBER_INBOX + path.slice(ADMIN_INBOX.length);
  }
  return path;
}
