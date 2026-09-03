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

export function accountLinks(viewerId: string): AccountLink[] {
  return [
    { href: "/account", label: "Dashboard" },
    // Not the same thing as the profile editor inside the account: this is the
    // page other members see.
    { href: `/members/${viewerId}`, label: "Your public profile" },
    { href: "/account/messages", label: "Messages", badge: "messages" },
  ];
}
