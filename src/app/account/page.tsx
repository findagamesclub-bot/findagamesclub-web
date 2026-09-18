import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import PageHead from "@/components/ui/PageHead";
import DashboardPanels from "@/components/account/DashboardPanels";
import StatStrip from "@/components/ui/StatStrip";
import MemberStats from "@/components/account/MemberStats";
import MemberAnalytics from "@/components/account/MemberAnalytics";
import ScoreTrendChart from "@/components/ui/ScoreTrendChart";
import MonoLabel from "@/components/ui/MonoLabel";
import { scoreTrend } from "@/utils/member-stats";
import { tokens } from "@/lib/tokens";
import { getCurrentProfile } from "@/services/auth.service";
import { getResumeCard } from "@/services/submissions.service";
import ListingResumeCard from "@/components/listing/ListingResumeCard";
import { getDashboard } from "@/services/dashboard.service";
import { londonToday } from "@/services/bookingCalendar.service";

export const metadata = { title: "Your dashboard" };

export default async function AccountPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/account");

  // Together, so a half-written listing costs the same one round trip the
  // dashboard already pays rather than a second wave for a card that is usually
  // not there.
  const [data, listing] = await Promise.all([
    getDashboard(viewer.id),
    getResumeCard(viewer.id).catch(() => null),
  ]);
  const approved = data.memberships.filter((m) => m.status === "approved");
  const pending = data.memberships.filter((m) => m.status === "pending");
  const owing = approved.filter((m) => m.standing.overdue);
  const upcomingTickets = data.tickets.filter((t) => t.status !== "cancelled");
  const points = data.loyalty.reduce((n, card) => n + card.available, 0);
  const played = data.games.filter((game) => game.outcome !== null).length;
  const trend = scoreTrend(data.games);

  const first = (viewer.full_name || "").trim().split(" ")[0] || "there";

  return (
    <>
      <PageHead
        title={`Hello, ${first}`}
        lede={owing.length
          ? `${owing.length === 1 ? "One club is" : `${owing.length} clubs are`} waiting on a payment.`
          : data.bookings.length
            ? `You are playing at ${data.bookings[0]!.clubName} next.`
            : "Everything is up to date."}
      />

      <Box>
        <StatStrip
          stats={[
            { label: "Clubs", value: approved.length },
            { label: "Games", value: played },
            { label: "Points", value: points, emphasis: points > 0 },
            { label: "Tickets", value: upcomingTickets.length },
            { label: "Bookings", value: data.bookings.length },
            { label: "Unread", value: data.unreadMessages, emphasis: data.unreadMessages > 0 },
          ]}
        />
      </Box>

      {/* Above the run they are on, because a listing waiting on them is the
          one thing here with a deadline attached, and the one thing nothing
          else on this page would mention. */}
      {listing ? (
        <Box sx={{ mt: 3 }}>
          <ListingResumeCard card={listing} />
        </Box>
      ) : null}

      {/* Three layers, each answering a different question and none of them
          repeating another. The strip above is the glance. This is the run
          they are on. The analytics below are the breakdowns. */}
      <Box sx={{ mt: 3 }}>
        <MonoLabel>Your form</MonoLabel>
        <MemberStats games={data.games} />
      </Box>

      {trend.length >= 2 ? (
        <Box sx={{ mt: 2.5, p: 2, border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                   backgroundColor: tokens.paper }}>
          <MonoLabel>Recent form</MonoLabel>
          <ScoreTrendChart points={trend} />
        </Box>
      ) : null}

      {/* Legacy's six dashboard breakdowns. Every one is worked out from games
          already loaded for this page, so the whole block costs no query. */}
      <Box sx={{ mt: 3 }}>
        <MonoLabel>Your analytics</MonoLabel>
        <MemberAnalytics games={data.games} loyalty={data.loyalty} today={londonToday()} />
      </Box>

      <Box sx={{ mt: 2.5, display: "grid", gap: 2.5,
                 gridTemplateColumns: {
                   xs: "minmax(0, 1fr)",
                   md: "repeat(2, minmax(0, 1fr))",
                   xl: "repeat(3, minmax(0, 1fr))",
                 } }}>
        <DashboardPanels data={data} pending={pending.length} />
      </Box>
    </>
  );
}
