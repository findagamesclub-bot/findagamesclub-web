import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import PeopleIcon from "@mui/icons-material/ManageAccounts";
import ReportIcon from "@mui/icons-material/Flag";
import PaymentsIcon from "@mui/icons-material/Payments";
import StarIcon from "@mui/icons-material/StarBorder";
import ShieldIcon from "@mui/icons-material/Shield";
import GavelIcon from "@mui/icons-material/Gavel";
import NotificationsIcon from "@mui/icons-material/NotificationsActive";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import PersonIcon from "@mui/icons-material/PersonOutlined";
import InboxIcon from "@mui/icons-material/MoveToInbox";
import GroupsIcon from "@mui/icons-material/Groups";
import EventIcon from "@mui/icons-material/EventNote";
import TuneIcon from "@mui/icons-material/Tune";
import type { NavGroup } from "@/components/ui/side-nav";

export type AdminCounts = {
  suspended?: number;
  /** Club requests still waiting. The one number worth a badge here. */
  waitingSubmissions?: number;
  /** Money owed or waiting to be paid, which is the only figure worth a badge. */
  billingOwed?: number;
  /** Claims nobody has answered. */
  openClaims?: number;
  /** Reported content waiting for an answer. */
  openFlags?: number;
  /** Unread notices and unread messages, so the rail can carry both counts. */
  unreadNotifications?: number;
  unreadMessages?: number;
};

/**
 * The admin console, as data.
 *
 * Short on purpose. Moderation and the army catalogue each get a section here
 * in the stage that builds them; adding the heading now would promise empty
 * pages. Badges are only on the entries where a number means somebody is
 * waiting on us: Clubs and Events hold everything by design, so a count there
 * would be the size of the site, not a job.
 *
 * Called "Club requests" and not "Listings". Beside an entry that genuinely is
 * every club on the site, "Listings" reads as that list rather than as the
 * people asking to join it, and the client read it that way on sight. A
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
      // One heading, because "Clubs" over the queues and "Clubs and events"
      // over the lists would put the word twice on one rail and leave somebody
      // deciding which of the two they meant. Everything here is about a club
      // or an event; the two lists lead because they are where you go when you
      // are looking for one rather than answering one.
      title: "Clubs and events",
      items: [
        { label: "Clubs", href: "/admin/clubs", icon: GroupsIcon },
        { label: "Events", href: "/admin/events", icon: EventIcon },
        { label: "Club requests", href: "/admin/submissions", icon: InboxIcon,
          count: counts.waitingSubmissions, alert: true },
        { label: "Club claims", href: "/admin/claims", icon: GavelIcon,
          count: counts.openClaims, alert: true },
        // Money owed reads as work, so it carries a badge. Featured does not:
        // an empty homepage slot is not somebody waiting on an answer.
        { label: "Billing", href: "/admin/billing", icon: PaymentsIcon,
          count: counts.billingOwed, alert: true },
        { label: "Featured", href: "/admin/featured", icon: StarIcon },
      ],
    },
    {
      // Its own group: the catalogue is not a club and not a person, it is the
      // reference every club's results are recorded against.
      title: "The game",
      items: [
        // No count. A catalogue with work outstanding is not somebody waiting
        // on an answer, which is what every alert badge here means.
        { label: "Army catalogue", href: "/admin/catalogue", icon: ShieldIcon },
      ],
    },
    {
      title: "People",
      items: [
        { label: "Accounts", href: "/admin/accounts", icon: PeopleIcon,
          count: counts.suspended, alert: true },
        // Under People rather than under the clubs: a report is about somebody
        // having said something, and answering it is the same job as suspending
        // whoever said it.
        { label: "Reported", href: "/admin/moderation", icon: ReportIcon,
          count: counts.openFlags, alert: true },
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
