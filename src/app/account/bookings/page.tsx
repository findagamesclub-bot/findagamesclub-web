import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import EmptyState from "@/components/ui/EmptyState";
import PageHead from "@/components/account/PageHead";
import TableBookingRow from "@/components/account/TableBookingRow";
import CrossLink from "@/components/account/CrossLink";
import { getCurrentProfile } from "@/services/auth.service";
import { getDashboard } from "@/services/dashboard.service";
import { getMyGames } from "@/services/games.service";
import { countUnrecorded } from "@/utils/game-filter";

export const metadata = { title: "Your table bookings" };

/**
 * Every table the member has booked, across every club.
 *
 * Legacy only shows bookings on the club page that made them, so somebody in
 * three clubs checks three pages to answer "where am I playing this week".
 * Cancelling happens here too now: working out which club a booking belonged to
 * before you could drop it was the whole problem.
 *
 * Only what is still to come. A table that has been played is a game, and
 * games live on Your games with their results, which is linked below.
 */
export default async function AccountBookingsPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/account/bookings");

  const [{ bookings }, games] = await Promise.all([
    getDashboard(viewer.id),
    getMyGames(viewer.id),
  ]);
  const unrecorded = countUnrecorded(games);

  return (
    // Held to a column and centred, like the tickets: a row of one booking
    // stretched across a dashboard is harder to read, not easier.
    <Box sx={{ maxWidth: 880, mx: "auto" }}>
      <PageHead
        title="Table bookings"
        lede={bookings.length
          ? `${bookings.length} table${bookings.length === 1 ? "" : "s"} booked. Soonest first.`
          : "Tables you book at any of your clubs appear here."}
      />

      {bookings.length ? (
        <Stack spacing={1.5}>
          {bookings.map((booking) => (
            <TableBookingRow key={booking.id} booking={booking} />
          ))}
        </Stack>
      ) : (
        <EmptyState
          title="No tables booked"
          description="Club pages list the nights and how many tables are free. Members book from there."
          action={{ label: "Your clubs", href: "/account/memberships" }}
        />
      )}

      {/* A booking becomes a game the moment it is played, and the score goes
          on the other page. Saying so beats leaving somebody to find it. */}
      <CrossLink
        href="/account/games"
        title="Games you have played"
        body={unrecorded
          ? `${unrecorded} of your games has no score on it yet.`
          : "Past tables, scores and your record against everyone you play."}
        alert={unrecorded > 0}
      />
    </Box>
  );
}
