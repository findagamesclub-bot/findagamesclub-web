import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import PersonIcon from "@mui/icons-material/PersonOutlined";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import LoyaltyIcon from "@mui/icons-material/Loyalty";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import NotificationsIcon from "@mui/icons-material/NotificationsActive";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import SchoolIcon from "@mui/icons-material/School";
import StorefrontIcon from "@mui/icons-material/Storefront";
import GroupsIcon from "@mui/icons-material/Groups";
import EventIcon from "@mui/icons-material/Event";
import type { SvgIconComponent } from "@mui/icons-material";
import type { AccountCounts } from "@/services/dashboard.service";

/**
 * What the account area contains, as data.
 *
 * Separate from the components because three of them need it: the list itself,
 * the drawer that holds the list on a phone, and the button that opens the
 * drawer, which has to name the section you are already on.
 *
 * Every item here goes somewhere. A section that cannot show anything yet is
 * left out rather than greyed: Competitions is read-only until a club can run
 * one through the app, so advertising it only promises an empty page.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: SvgIconComponent;
  count?: number;
  /** Marks a count worth noticing rather than merely reporting. */
  alert?: boolean;
};

export type NavGroup = { title: string; items: NavItem[] };

export function accountGroups(counts: AccountCounts): NavGroup[] {
  return [
    {
      title: "You",
      items: [
        { label: "Overview", href: "/account", icon: DashboardIcon },
        { label: "Profile", href: "/account/profile", icon: PersonIcon },
      ],
    },
    {
      title: "Your clubs",
      items: [
        { label: "Memberships", href: "/account/memberships",
          icon: CardMembershipIcon, count: counts.clubs },
        { label: "Loyalty", href: "/account/loyalty", icon: LoyaltyIcon },
      ],
    },
    {
      title: "What you have played",
      items: [
        { label: "Your games", href: "/account/games", icon: SportsEsportsIcon,
          count: counts.unrecorded, alert: true },
      ],
    },
    {
      title: "What you have booked",
      items: [
        { label: "Event tickets", href: "/account/tickets",
          icon: ConfirmationNumberIcon, count: counts.tickets },
        { label: "Table bookings", href: "/account/bookings",
          icon: EventSeatIcon, count: counts.bookings },
        { label: "Coaching", href: "/account/coaching", icon: SchoolIcon,
          count: counts.coaching },
        { label: "Merchandise", href: "/account/orders", icon: StorefrontIcon,
          count: counts.orders },
      ],
    },
    {
      title: "Keeping in touch",
      items: [
        { label: "Messages", href: "/account/messages", icon: ForumIcon,
          count: counts.unreadMessages, alert: true },
        { label: "Event alerts", href: "/account/alerts",
          icon: NotificationsIcon, count: counts.alerts },
      ],
    },
    ...(counts.ownsClubs ? [{
      title: "Running a club",
      items: [
        { label: "My clubs", href: "/my-clubs", icon: GroupsIcon },
        { label: "My events", href: "/my-events", icon: EventIcon },
      ],
    }] : []),
  ];
}

/**
 * Exact match for the overview, prefix for the rest: /account would otherwise
 * light up on every page under it.
 */
export function isOn(href: string, pathname: string): boolean {
  return href === "/account" ? pathname === "/account" : pathname.startsWith(href);
}

export function currentItem(counts: AccountCounts, pathname: string): NavItem | undefined {
  return accountGroups(counts).flatMap((g) => g.items).find((item) => isOn(item.href, pathname));
}
