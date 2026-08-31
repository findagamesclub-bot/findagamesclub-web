import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import EmptyState from "@/components/ui/EmptyState";
import PageHead from "@/components/account/PageHead";
import BackLink from "@/components/ui/BackLink";
import OwnerBookings from "@/components/owner/OwnerBookings";
import { getCurrentProfile } from "@/services/auth.service";
import { getOwnedBookings, getScoreQueue } from "@/services/ownerBookings.service";

export const metadata = { title: "All table bookings" };

/**
 * Every table booked at every club this person owns, soonest first.
 *
 * The club's own page is where a night is managed, because that is where the
 * waiting list and the free tables are. This is the answer to "is anybody
 * playing anywhere this week", which four club pages cannot give.
 */
export default async function OwnerBookingsPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/my-clubs/bookings");

  const [bookings, queue] = await Promise.all([
    getOwnedBookings(viewer.id),
    getScoreQueue(viewer.id),
  ]);
  if (!queue.clubs.length) redirect("/my-clubs");

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <BackLink href="/my-clubs" label="My clubs" />
      <PageHead
        title="Table bookings"
        lede={bookings.length
          ? `${bookings.length} ${bookings.length === 1 ? "table" : "tables"} booked across ${
              queue.clubs.length === 1 ? "your club" : `${queue.clubs.length} clubs`}. Soonest first.`
          : "Tables booked at any of your clubs appear here."}
      />

      {bookings.length ? (
        <OwnerBookings bookings={bookings} />
      ) : (
        <Stack>
          <EmptyState
            title="Nothing booked yet"
            description="Tables members book at any of your clubs show up here, soonest first."
            action={{ label: "My clubs", href: "/my-clubs" }}
          />
        </Stack>
      )}
    </Container>
  );
}
