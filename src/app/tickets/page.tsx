import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import EmptyState from "@/components/ui/EmptyState";
import MyTickets from "@/components/tickets/MyTickets";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyBookings } from "@/services/eventBookings.service";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "My tickets" };

export default async function MyTicketsPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/tickets");

  const bookings = await getMyBookings(viewer.id);

  // Cancelled ones stay, at the bottom: a booking that vanished is a booking
  // the member cannot prove they ever made.
  const live = bookings.filter((b) => b.status !== "cancelled");
  const past = bookings.filter((b) => b.status === "cancelled");

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="overline" sx={{ color: tokens.inkMuted }}>Your account</Typography>
        <Typography variant="h1" sx={{ fontSize: { xs: "1.9rem", md: "2.4rem" } }}>My tickets</Typography>
        <Typography variant="body1" sx={{ color: tokens.inkMuted, maxWidth: 560 }}>
          Every event you have reserved a place at. Quote the reference on the door.
        </Typography>
      </Stack>

      {bookings.length === 0 ? (
        <EmptyState
          title="No tickets yet"
          description="When you book onto an event, it lands here with its reference."
          action={{ label: "Browse events", href: "/events" }}
        />
      ) : (
        <MyTickets
          live={live.map((b) => ({ booking: b, ...clubIdentity(b.clubSlug, b.clubName) }))}
          past={past.map((b) => ({ booking: b, ...clubIdentity(b.clubSlug, b.clubName) }))}
        />
      )}
    </Container>
  );
}
