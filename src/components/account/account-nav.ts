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
import AddClubIcon from "@mui/icons-material/AddBusiness";
import type { NavGroup } from "@/components/ui/side-nav";
import type { AccountCounts } from "@/services/dashboard.service";

/**
 * What the account area contains, as data.
 *
 * Separate from the components because three of them need it: the list itself,
 * the drawer that holds the list on a phone, and the button that opens the
 * drawer, which has to name the section you are already on.
 */
export function accountGroups(counts: AccountCounts): NavGroup[] {
  return [
    {
      title: "You",
      items: [
        { label: "Overview", href: "/account", icon: DashboardIcon, exact: true },
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
    {
      // "List your club" is here for everybody, not only for somebody who runs
      // none. Running one club is the commonest reason to run a second, and the
      // current app agrees: its Create Listing button is in the top bar whoever
      // you are. Hiding it from owners was this rail deciding they were done.
      title: "Running a club",
      items: [
        ...(counts.ownsClubs ? [
          { label: "My clubs", href: "/my-clubs", icon: GroupsIcon },
          { label: "My events", href: "/my-events", icon: EventIcon },
        ] : []),
        { label: "Club listings", href: "/account/listings", icon: AddClubIcon },
      ],
    },
  ];
}
