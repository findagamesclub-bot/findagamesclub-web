import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import EmptyState from "@/components/ui/EmptyState";
import PageHead from "@/components/ui/PageHead";
import MyTickets from "@/components/tickets/MyTickets";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyBookings } from "@/services/eventBookings.service";
import { clubIdentity } from "@/utils/club-identity";
import { londonToday } from "@/services/bookingCalendar.service";

export const metadata = { title: "Your tickets" };

export default async function MyTicketsPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/account/tickets");

  const bookings = await getMyBookings(viewer.id);

  return (
    // A ticket is read, not scanned in a grid. Held to a column and centred,
    // so it keeps the proportions of the thing it stands for.
    <Box sx={{ maxWidth: 880, mx: "auto" }}>
      <PageHead
        title="Event tickets"
        lede="Every event you have reserved a place at. Quote the reference on the door."
      />

      {bookings.length === 0 ? (
        <EmptyState
          title="No tickets yet"
          description="When you book onto an event, it lands here with its reference."
          action={{ label: "Browse events", href: "/events" }}
        />
      ) : (
        // Cancelled ones stay, under their own tab: a booking that vanished is
        // a booking the member cannot prove they ever made.
        <MyTickets
          today={londonToday()}
          entries={bookings.map((b) => ({
            booking: b, ...clubIdentity(b.clubSlug, b.clubName),
          }))}
        />
      )}
    </Box>
  );
}
