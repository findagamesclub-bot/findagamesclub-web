"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
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
import { display, mono, tokens } from "@/lib/tokens";
import type { AccountCounts } from "@/services/dashboard.service";

/**
 * The clicked item, while the section it points at is still coming.
 *
 * Has to be a child of the Link to read its status. It replaces the count
 * rather than sitting beside it, so the row does not change width mid-click.
 */
function Pending({ fallback }: { fallback: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return pending
    ? <CircularProgress size={14} thickness={5} sx={{ color: tokens.brass, flexShrink: 0 }} />
    : <>{fallback}</>;
}

type Item = {
  label: string;
  href: string;
  icon: SvgIconComponent;
  count?: number;
  /** Marks a count worth noticing rather than merely reporting. */
  alert?: boolean;
};

/**
 * The account's own navigation.
 *
 * A sidebar rather than tabs: ten sections do not fit a strip, and a tab bar
 * that scrolls sideways hides half of itself. It also keeps every section
 * inside one shell — tickets used to open a page with no account navigation on
 * it at all, so getting back meant the browser's back button.
 *
 * Every item here goes somewhere. A section that cannot show anything yet is
 * left out rather than greyed: Competitions is read-only until a club can run
 * one through the app, so advertising it only promises an empty page.
 */
export default function AccountSidebar({ counts }: { counts: AccountCounts }) {
  const pathname = usePathname();

  const groups: { title: string; items: Item[] }[] = [
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

  return (
    <Stack component="nav" aria-label="Your account" spacing={2.5}>
      {groups.map((group) => (
        <Box key={group.title}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                            letterSpacing: "0.12em", color: tokens.inkMuted,
                            px: 1.5, pb: 0.875 }}>
            {group.title.toUpperCase()}
          </Typography>

          <Stack spacing={0.25}>
            {group.items.map((item) => {
              // Exact match for the overview, prefix for the rest: /account
              // would otherwise light up on every page under it.
              const on = item.href === "/account"
                ? pathname === "/account"
                : pathname.startsWith(item.href);
              const Icon = item.icon;

              const badge = item.count ? (
                <Box sx={{ minWidth: 20, px: 0.75, height: 19, borderRadius: 999,
                           display: "grid", placeItems: "center", flexShrink: 0,
                           backgroundColor: item.alert ? tokens.danger : tokens.rule,
                           color: item.alert ? "#fff" : tokens.inkMuted }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                                    fontWeight: 700, lineHeight: 1 }}>
                    {item.count}
                  </Typography>
                </Box>
              ) : null;

              const row = (marker: React.ReactNode) => (
                <Stack direction="row" spacing={1.25}
                  sx={{
                    alignItems: "center", px: 1.5, py: 1, borderRadius: 1.5,
                    color: tokens.ink,
                    backgroundColor: on ? tokens.brassSoft : "transparent",
                    cursor: "pointer",
                    "&:hover": { backgroundColor: on ? tokens.brassSoft : tokens.surface },
                  }}>
                  <Icon sx={{ fontSize: 19, flexShrink: 0,
                              color: on ? tokens.brass : "inherit" }} />
                  <Typography sx={{ flex: 1, fontFamily: display, fontSize: "0.95rem",
                                    letterSpacing: "0.005em",
                                    fontWeight: on ? 700 : 500 }}>
                    {item.label}
                  </Typography>

                  {marker}
                </Stack>
              );

              return (
                <NextLink key={item.label} href={item.href}
                  style={{ textDecoration: "none", color: "inherit" }}>
                  {row(<Pending fallback={badge} />)}
                </NextLink>
              );
            })}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
