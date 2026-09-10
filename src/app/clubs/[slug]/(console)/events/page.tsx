import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import EventIcon from "@mui/icons-material/Event";
import HistoryIcon from "@mui/icons-material/History";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import ClubEventList from "@/components/clubs/ClubEventList";
import Section from "@/components/ui/Section";
import Pager from "@/components/ui/Pager";
import HorizontalBarChart from "@/components/ui/HorizontalBarChart";
import MonoLabel from "@/components/ui/MonoLabel";
import EmptyState from "@/components/ui/EmptyState";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getEventBookingCounts } from "@/services/eventBookings.service";
import { CLUB_EVENTS_PAGE, getClubEventsPage } from "@/services/events.service";
import { pageFrom } from "@/utils/paging";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget, FROM_CLUB_EVENTS } from "@/utils/back-link";
import { formatMoney } from "@/utils/format";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/events">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Events · ${club.name}` : "Club not found" };
}

export default async function ClubEventsPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/events">) {
  const { slug } = await params;
  const query = await searchParams;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const { faction } = clubIdentity(club.slug, club.name);
  const page = pageFrom(query.page);

  // Queried rather than read off the club, which carries every event a club has
  // ever run. Ten years of them is not a payload the club page should pay for.
  const [upcoming, past] = await Promise.all([
    getClubEventsPage(club.id, { past: false, page: 1 }),
    getClubEventsPage(club.id, { past: true, page }),
  ]);
  const back = backTarget(query.from, club);
  const viewer = await getCurrentProfile();
  const access = await getClubAccess(club.id, viewer);
  const canManage = access.can("events.manage");

  // Booking rows are the club's by policy, so this is skipped rather than
  // fetched-and-hidden — anyone else reads zero and would see "nobody booked".
  const sales = canManage ? await getEventBookingCounts(club.id) : undefined;

  const totals = sales
    ? [...sales.values()].reduce(
        (t, s) => ({ bookings: t.bookings + s.bookings, tickets: t.tickets + s.tickets, due: t.due + s.due }),
        { bookings: 0, tickets: 0, due: 0 },
      )
    : null;

  // Built from the sales already loaded, so the chart costs no query. Only
  // events that sold anything: a row of zeroes is a list, not a ranking.
  const ticketRows = sales
    ? [...upcoming.events, ...past.events]
        .map((event) => ({
          label: event.title,
          value: sales.get(event.id)?.tickets ?? 0,
          color: faction.base,
        }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
    : [];

  const stats = [
    { label: "coming up", value: String(upcoming.total),
      emphasis: upcoming.total > 0 },
    ...(totals && totals.tickets
      ? [
          { label: totals.tickets === 1 ? "ticket sold" : "tickets sold", value: String(totals.tickets) },
          { label: "due on the door", value: formatMoney(totals.due) },
        ]
      : []),
    ...(past.total ? [{ label: "run before", value: String(past.total) }] : []),
  ];

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader back={back}
        title="Events"
        clubName={club.name}
        clubSlug={club.slug}
        faction={faction}
        stats={stats}
        note={
          canManage
            ? "Figures count reserved bookings only. Open an event's door list to see who is coming."
            : null
        }
      />

      {/* Which events actually sell. Horizontal because the labels are event
          names, and a name does not fit under a column. */}
      {ticketRows.length ? (
        <Box sx={{ mb: 3, p: 2, border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                   backgroundColor: tokens.paper }}>
          <MonoLabel>Tickets sold, best first</MonoLabel>
          <HorizontalBarChart rows={ticketRows} />
        </Box>
      ) : null}

      {upcoming.events.length ? (
        <Section title="Coming up" icon={EventIcon}>
          <ClubEventList events={upcoming.events} clubSlug={club.slug} sales={sales}
            trail={FROM_CLUB_EVENTS}
            clubVenue={{ name: club.venue.name, postcode: club.venue.postcode }} />
        </Section>
      ) : (
        <EmptyState
          title="Nothing on the calendar"
          description={
            canManage
              ? "Events you run appear here with how they are selling."
              : `${club.name} has not announced its next event yet.`
          }
        />
      )}

      {past.total ? (
        <Section title="Already run" icon={HistoryIcon}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 2 }}>
            Newest first. Results, where the club recorded them, are on each event.
          </Typography>
          <ClubEventList events={past.events} clubSlug={club.slug} sales={sales}
            trail={FROM_CLUB_EVENTS}
            clubVenue={{ name: club.venue.name, postcode: club.venue.postcode }} />
          <Pager page={page} total={past.total} noun="past events" size={CLUB_EVENTS_PAGE}
            href={{
              path: `/clubs/${club.slug}/events`,
              params: { from: query.from ? String(query.from) : undefined },
            }} />
        </Section>
      ) : null}
    </Container>
  );
}
