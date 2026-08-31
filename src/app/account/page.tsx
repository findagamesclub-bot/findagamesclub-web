import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import PageHead from "@/components/account/PageHead";
import DashboardPanels from "@/components/account/DashboardPanels";
import StatStrip from "@/components/account/StatStrip";
import { getCurrentProfile } from "@/services/auth.service";
import { getDashboard } from "@/services/dashboard.service";

export const metadata = { title: "Your dashboard" };

export default async function AccountPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/account");

  const data = await getDashboard(viewer.id);
  const approved = data.memberships.filter((m) => m.status === "approved");
  const pending = data.memberships.filter((m) => m.status === "pending");
  const owing = approved.filter((m) => m.standing.overdue);
  const upcomingTickets = data.tickets.filter((t) => t.status !== "cancelled");
  const points = data.loyalty.reduce((n, card) => n + card.available, 0);
  const played = data.games.filter((game) => game.outcome !== null).length;

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

      <Box sx={{ mt: 2.5, display: "grid", gap: 2.5,
                 gridTemplateColumns: {
                   xs: "1fr",
                   md: "repeat(2, minmax(0, 1fr))",
                   xl: "repeat(3, minmax(0, 1fr))",
                 } }}>
        <DashboardPanels data={data} pending={pending.length} />
      </Box>
    </>
  );
}
