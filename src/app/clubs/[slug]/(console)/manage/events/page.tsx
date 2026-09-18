import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import NavTabs from "@/components/ui/NavTabs";
import EventsList from "./EventsList";
import BookingsBoard from "./BookingsBoard";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { listEvents } from "@/services/eventEditor.service";
import { getClubBookings, readFilters } from "@/services/clubBookings.service";
import { clubIdentity } from "@/utils/club-identity";

export const metadata = { title: "Events" };

/**
 * Everything the club runs, and everybody who has booked any of it.
 *
 * Two tabs for the same reason the shop has Items and Orders: what you sell
 * and who has bought it are two different jobs, and a club chasing money
 * should not have to open ten events to find the four people who owe.
 */
export default async function ManageEventsPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/events">) {
  const { slug } = await params;
  const query = await searchParams;
  const showing = query.tab === "bookings" ? "bookings" : "events";

  // Independent of each other, so one round trip rather than two.
  const [viewer, club] = await Promise.all([
    getCurrentProfile(),
    getClubDetail(slug),
  ]);
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/events`);

  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("events.manage")) notFound();

  // Only the tab being looked at is fetched, and only what it needs. The
  // bookings side used to load every event as well, purely to put a number on
  // the tab it was not showing. Every query to the database costs about the
  // same however small it is, so a query that only fills in a badge is most of
  // a second for a badge.
  const bookings = showing === "bookings"
    ? await getClubBookings(club.id, readFilters(query))
    : null;
  const listing = showing === "bookings" ? null : await listEvents(club.id);

  const { faction } = clubIdentity(club.slug, club.name);
  const eventCount = bookings ? bookings.eventCount : listing?.rows.length ?? 0;
  const bookingCount = bookings
    ? bookings.counts.all
    : (listing?.rows ?? []).reduce((n, event) => n + event.bookings, 0);
  const at = (name: string) => `/clubs/${slug}/manage/events?tab=${name}`;

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      {/* The lede follows the tab. On Bookings it is the only place that says
          what checking somebody in actually means, which is marking that they
          have turned up on the day. */}
      <PageHead
        title="Events"
        lede={showing === "bookings"
          ? "Everybody who has booked anything, across every event. Mark who has paid, and check people in as they arrive on the day."
          : "Tournaments, open days and club nights out. Write one as a draft, publish it when it is ready."}
      />

      <Box sx={{ mb: 3 }}>
        <NavTabs
          ariaLabel="Events"
          value={showing}
          accent={faction.base}
          tabs={[
            { value: "events", label: "Events", href: at("events"), count: eventCount },
            { value: "bookings", label: "Bookings", href: at("bookings"), count: bookingCount },
          ]}
        />
      </Box>

      {showing === "bookings" && bookings ? (
        <BookingsBoard slug={slug} view={bookings} faction={faction} />
      ) : listing ? (
        <EventsList slug={slug} events={listing.rows} today={listing.today} faction={faction} />
      ) : null}
    </Container>
  );
}
