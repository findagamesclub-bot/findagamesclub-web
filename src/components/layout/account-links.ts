/**
 * Where a signed-in person can go from the header.
 *
 * One list, read by the desktop account menu and by the mobile drawer. They
 * were two hand-kept menus and the phone one had nothing in it at all: a
 * member signed in on a phone could not reach their dashboard, their public
 * profile or their messages from anywhere in the app.
 *
 * Deliberately short. Everything the account holds is one click inside the
 * dashboard, so listing those sections here as well only makes two places to
 * keep in step.
 */
export type AccountLink = {
  href: string;
  label: string;
  /** Carries the unread count. The one thing worth knowing before you click. */
  badge?: "messages";
};

/**
 * Where the console is, for somebody on a club's team.
 *
 * One club goes straight in and names it, because that is the whole journey
 * and a hub in the middle of it is a page nobody wanted. Several clubs go to
 * the hub, because there is a choice to make first.
 */
export type ManageLink = { href: string; label: string } | null;

export function manageLink(clubs: { slug: string; name: string }[]): ManageLink {
  if (clubs.length === 0) return null;
  if (clubs.length === 1) return {
    href: `/clubs/${clubs[0]!.slug}/manage`,
    label: `Manage ${clubs[0]!.name}`,
  };
  return { href: "/my-clubs", label: "Manage your clubs" };
}

export function accountLinks(
  viewerId: string, manage: ManageLink = null, isAdmin = false,
): AccountLink[] {
  return [
    // An admin's dashboard is the admin console. Sending them to the member
    // one, which reports the clubs they have joined and the tickets they hold,
    // was the menu answering a question they had not asked.
    isAdmin
      ? { href: "/admin", label: "Admin dashboard" }
      : { href: "/account", label: "Dashboard" },
    // Above the profile and the messages: somebody who runs a club opens this
    // menu to get to work more often than to read their own page.
    ...(manage ? [manage] : []),
    // The page other members see, rather than the editor inside the account.
    // An admin gets theirs at its address inside the console, because their
    // rail is the only navigation they have once the header is hidden.
    { href: isAdmin ? "/admin/profile" : `/members/${viewerId}`, label: "Profile" },
    { href: "/account/messages", label: "Messages", badge: "messages" },
  ];
}
