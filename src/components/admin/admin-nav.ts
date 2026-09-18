import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import PeopleIcon from "@mui/icons-material/ManageAccounts";
import NotificationsIcon from "@mui/icons-material/NotificationsActive";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import PersonIcon from "@mui/icons-material/PersonOutlined";
import InboxIcon from "@mui/icons-material/MoveToInbox";
import TuneIcon from "@mui/icons-material/Tune";
import type { NavGroup } from "@/components/ui/side-nav";

export type AdminCounts = {
  suspended?: number;
  /** Club requests still waiting. The one number worth a badge here. */
  waitingSubmissions?: number;
  /** Unread notices and unread messages, so the rail can carry both counts. */
  unreadNotifications?: number;
  unreadMessages?: number;
};

/**
 * The admin console, as data.
 *
 * Short on purpose. Claims, moderation, billing, featured listings and the
 * army catalogue each get a section here in the stage that builds them; adding
 * the heading now would promise five empty pages. Club requests arrived with
 * Stage 4 and its badge is the count still waiting, because that is the only
 * number on this rail that means somebody is waiting on us.
 *
 * Called "Club requests" and not "Listings". Under a heading that already says
 * CLUBS, "Listings" reads as the clubs on the site rather than the people
 * asking to be one of them, and the client read it that way on sight. A
 * request is a thing that needs an answer, which is the whole job of the page.
 */
export function adminGroups(counts: AdminCounts = {}): NavGroup[] {
  return [
    {
      title: "The site",
      items: [
        { label: "Overview", href: "/admin", icon: DashboardIcon, exact: true },
        { label: "Site settings", href: "/admin/settings", icon: TuneIcon },
      ],
    },
    {
      title: "Clubs",
      items: [
        { label: "Club requests", href: "/admin/submissions", icon: InboxIcon,
          count: counts.waitingSubmissions, alert: true },
      ],
    },
    {
      title: "People",
      items: [
        { label: "Accounts", href: "/admin/accounts", icon: PeopleIcon,
          count: counts.suspended, alert: true },
      ],
    },
    {
      // The console hides the site header, so everything that used to live up
      // there is here: the two things addressed to them personally, their own
      // profile, and the way out.
      title: "Keeping in touch",
      items: [
        { label: "Notifications", href: "/admin/notifications", icon: NotificationsIcon,
          count: counts.unreadNotifications, alert: true },
        { label: "Messages", href: "/admin/messages", icon: ForumIcon,
          count: counts.unreadMessages, alert: true },
      ],
    },
    {
      // Every entry here opens in the console's own right-hand column. The one
      // link that genuinely leaves it, the public directory, sits by Sign out
      // instead, so a rail item never means "and now you are somewhere else".
      title: "You",
      items: [
        { label: "Profile", href: "/admin/profile", icon: PersonIcon },
      ],
    },
  ];
}
