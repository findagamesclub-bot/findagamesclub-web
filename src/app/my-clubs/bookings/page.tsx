import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import EmptyState from "@/components/ui/EmptyState";
import PageHead from "@/components/ui/PageHead";
import BackLink from "@/components/ui/BackLink";
import OwnerBookings from "@/components/owner/OwnerBookings";
import { getCurrentProfile } from "@/services/auth.service";
import { getOwnedBookings, getScoreQueue } from "@/services/ownerBookings.service";
import { londonToday } from "@/services/bookingCalendar.service";

export const metadata = { title: "All table bookings" };

/**
 * Every table booked at every club this person owns, either side of today.
 *
 * The club's own page is where a night is managed, because that is where the
 * waiting list and the free tables are. This is the answer to "is anybody
 * playing anywhere this week", which four club pages cannot give.
 *
 * It read forwards only and was titled "All table bookings", so a club whose
 * last night had been and gone opened an empty page. That is the client's
 * item 7, and it is a page lying about its own name rather than a missing
 * read: the tables were there the whole time.
 */
export default async function OwnerBookingsPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/my-clubs/bookings");

  const [bookings, queue] = await Promise.all([
    getOwnedBookings(viewer.id),
    getScoreQueue(viewer.id),
  ]);
  if (!queue.clubs.length) redirect("/my-clubs");

  // The split is London's, from the server, so a reader in another timezone
  // does not see last night's table counted as still to come.
  const today = londonToday();
  const ahead = bookings.filter((one) => one.date >= today).length;

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <BackLink href="/my-clubs" label="My clubs" />
      <PageHead
        title="Table bookings"
        lede={bookings.length
          ? `${ahead ? `${ahead} still to come` : "Nothing still to come"} and ${
              bookings.length - ahead} played, across ${
              queue.clubs.length === 1 ? "your club" : `${queue.clubs.length} clubs`}.`
          : "Tables booked at any of your clubs appear here."}
      />

      {bookings.length ? (
        <OwnerBookings bookings={bookings} today={today} />
      ) : (
        <Stack>
          <EmptyState
            title="Nothing booked yet"
            description="Tables members book at any of your clubs show up here, the ones still to come first."
            action={{ label: "My clubs", href: "/my-clubs" }}
          />
        </Stack>
      )}
    </Container>
  );
}
