import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import GroupsIcon from "@mui/icons-material/Groups";
import BadgeIcon from "@mui/icons-material/AssignmentInd";
import EditIcon from "@mui/icons-material/EditNote";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import ScoreboardIcon from "@mui/icons-material/Scoreboard";
import LinkIcon from "@mui/icons-material/AddLink";
import SchoolIcon from "@mui/icons-material/School";
import EventIcon from "@mui/icons-material/Event";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import StorefrontIcon from "@mui/icons-material/Storefront";
import LoyaltyIcon from "@mui/icons-material/Loyalty";
import PaymentsIcon from "@mui/icons-material/Payments";
import type { NavGroup, NavItem } from "@/components/ui/side-nav";
import type { Capability, ClubAccess } from "@/utils/club-access";

/**
 * The club console, as data.
 *
 * Filtered by capability rather than by role, so a helper's console is the
 * three things a helper does and nothing else. Hiding a section they cannot
 * use is not the security: the policy is. It is so the console reads as a job
 * rather than as a list of doors that will not open.
 *
 * Sections still point at the pages that already exist. Stage 2 onwards moves
 * them under /manage one at a time, and each move leaves a redirect behind.
 */
type ConsoleItem = NavItem & { needs: Capability };

export type ConsoleCounts = {
  joinRequests?: number;
  scoresWaiting?: number;
  ordersWaiting?: number;
  renewalsDue?: number;
  /** Imported results still carrying a name rather than an account. */
  unmatchedResults?: number;
  /** Coaching places taken and not yet paid for. */
  coachingToPay?: number;
};

export function consoleGroups(
  slug: string, access: ClubAccess, counts: ConsoleCounts = {},
): NavGroup[] {
  const at = (path: string) => `/clubs/${slug}${path}`;

  const groups: { title: string; items: ConsoleItem[] }[] = [
    {
      title: "Your club",
      items: [
        // Everybody on the team lands here, so it is gated on the lowest
        // capability any of them holds rather than on one of its own.
        { label: "Overview", href: at("/manage"), icon: DashboardIcon,
          exact: true, needs: "bookings.manage" },
        // The club's own page, in five steps. Above Team because editing the
        // listing is the job an owner opens the console for most.
        // Points at step one and stays lit across all five.
        { label: "Listing", href: at("/manage/listing/profile"),
          owns: at("/manage/listing"), icon: EditIcon, needs: "listing.edit" },
        { label: "Team", href: at("/manage/team"), icon: BadgeIcon,
          needs: "team.manage" },
      ],
    },
    {
      title: "People",
      items: [
        { label: "Members", href: at("/members"), icon: GroupsIcon,
          count: counts.joinRequests, alert: true, needs: "members.manage" },
        { label: "Renewals", href: at("/members/renewals"), icon: PaymentsIcon,
          count: counts.renewalsDue, needs: "members.manage" },
      ],
    },
    {
      title: "Club nights",
      items: [
        { label: "Table bookings", href: at("/bookings"), icon: EventSeatIcon,
          needs: "bookings.manage" },
        // Its own page, not an anchor inside the bookings one. Two entries
        // sharing a path cannot both light up, because the matcher reads the
        // path and never the hash, so clicking Scores lit Table bookings.
        { label: "Scores", href: at("/manage/scores"), icon: ScoreboardIcon,
          count: counts.scoresWaiting, alert: true, needs: "results.manage" },
        // Results imported from the old site carrying a player's name and no
        // account. Occasional work, and finite: once they are matched the
        // entry has nothing left to do.
        //
        // members.manage rather than results.manage, because attaching a name
        // to an account writes to that person's profile. Ruling on a score is
        // the night's work; deciding who somebody is, is not.
        { label: "Match old results", href: at("/manage/results"), icon: LinkIcon,
          count: counts.unmatchedResults, needs: "members.manage" },
        // Sessions, who has booked them, and the switch. The count is what is
        // still owed: a booking is not work, being unpaid is.
        { label: "Coaching", href: at("/manage/coaching"), icon: SchoolIcon,
          count: counts.coachingToPay, alert: true, needs: "coaching.manage" },
      ],
    },
    {
      title: "Events",
      items: [
        { label: "Events", href: at("/events"), icon: EventIcon,
          needs: "events.manage" },
        { label: "Competitions", href: at("/competitions/manage"),
          icon: EmojiEventsIcon, needs: "competitions.manage" },
      ],
    },
    {
      title: "Community",
      items: [
        { label: "Board", href: at("/board"), icon: ForumIcon,
          needs: "board.moderate" },
        // What the club sells, the sizes left, and the orders waiting. The
        // count sits here because this is now the page that answers them:
        // while the queue lived on the club's own shop page, this badge sent
        // people somewhere they could do nothing about it.
        { label: "Shop", href: at("/manage/shop"), icon: StorefrontIcon,
          count: counts.ordersWaiting, alert: true, needs: "shop.manage" },
        // The programme's settings. What members have earned is on the club's
        // own loyalty page, which this links out to.
        { label: "Loyalty", href: at("/manage/loyalty"), icon: LoyaltyIcon,
          needs: "members.manage" },
      ],
    },
  ];

  // A group with nothing left in it is dropped, or a helper's console shows
  // four empty headings.
  return groups
    .map((g) => ({
      title: g.title,
      items: g.items.filter((item) => access.can(item.needs)),
    }))
    .filter((g) => g.items.length > 0);
}
