import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlaceIcon from "@mui/icons-material/Place";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import InfoIcon from "@mui/icons-material/Info";
import GroupsIcon from "@mui/icons-material/Groups";
import Section from "@/components/ui/Section";
import EventPlacings from "@/components/events/EventPlacings";
import EventHero from "@/components/events/EventHero";
import { getEventDetail } from "@/services/eventDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership } from "@/services/memberships.service";
import { getBuyableTickets } from "@/services/tickets.service";
import { getAttendees } from "@/services/eventBookings.service";
import AttendeeList from "@/components/tickets/AttendeeList";
import EventTickets from "@/components/tickets/EventTickets";
import TicketSalesBoard from "@/components/tickets/TicketSalesBoard";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget, carryFrom } from "@/utils/back-link";
import VenueMap from "@/components/map/VenueMap";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/events/[eventId]">) {
  const { slug, eventId } = await params;
  const event = await getEventDetail(slug, eventId, null);
  return {
    title: event ? event.title : "Event not found",
    description: event?.summary ?? undefined,
  };
}

export default async function EventPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/events/[eventId]">) {
  const { slug, eventId } = await params;
  const query = await searchParams;
  const viewer = await getCurrentProfile();
  const event = await getEventDetail(slug, eventId, viewer);
  if (!event) notFound();

  // Eligibility is a membership question, so the ticket desk needs the viewer's
  // standing at this club, not just whether they are signed in.
  const membership = viewer ? await getMyMembership(event.clubId, viewer.id) : null;

  const { tickets, cart } = await getBuyableTickets({
    eventId: event.id,
    ticketTypes: event.ticketTypes,
    tiers: event.tiers,
    viewerId: viewer?.id ?? null,
    canManageClub: event.canManageClub,
    isApprovedMember: membership?.status === "approved",
    viewerTierKey: membership?.tierKey ?? null,
  });

  // Only the club may read booking rows, so this is skipped rather than
  // fetched-and-hidden — RLS would return nothing anyway.
  const attendees = event.canManageClub ? await getAttendees(event.id) : [];

  const { faction, monogram } = clubIdentity(event.clubSlug, event.clubName);
  const back = backTarget(query.from, { slug: event.clubSlug, name: event.clubName });
  // Passed on to the door list so its own back link lands where you started.
  const trail = carryFrom(query.from);

  return (
    <Container maxWidth="lg" component="main"
      sx={{ py: { xs: 4, md: 6 }, pb: { xs: 14, md: 6 } }}>
      <NextLink href={back.href} style={{ textDecoration: "none" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.5 }}>
          <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted, "&:hover": { color: faction.base } }}>
            {back.label}
          </Typography>
        </Stack>
      </NextLink>

      <EventHero event={event} faction={faction} />

      <Box sx={{ display: "grid", gap: 4, mt: 1,
                 gridTemplateColumns: { xs: "1fr", md: "minmax(0,2fr) minmax(300px,1fr)" } }}>
        <Box sx={{ minWidth: 0 }}>
      {event.summary ? (
        <Typography variant="body1" sx={{ mt: 3, maxWidth: 680 }}>{event.summary}</Typography>
      ) : null}

      {event.featuredGames.length ? (
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap", mt: 2.5 }}>
          {event.featuredGames.map((g) => (
            <Chip key={g} size="small" label={g} variant="outlined"
              sx={{ borderColor: tokens.rule }} />
          ))}
        </Stack>
      ) : null}

      {event.placings.length ? (
        <Section title="Results" icon={EmojiEventsIcon}>
          <EventPlacings placings={event.placings} faction={faction} />
        </Section>
      ) : null}

      {event.canManageClub ? (
        <Section title="Who is coming" icon={GroupsIcon}
          action={
            attendees.length > 5 ? (
              <NextLink href={`/clubs/${slug}/events/${eventId}/attendees${trail}`}
                style={{ textDecoration: "none" }}>
                <Typography variant="body2"
                  sx={{ color: tokens.brand, fontWeight: 600 }}>
                  See all {attendees.length}
                </Typography>
              </NextLink>
            ) : undefined
          }>
          {/* Five is enough to know who is coming at a glance. Past that it is
              a list to search, not to read, and that lives on its own page. */}
          <AttendeeList attendees={attendees.slice(0, 5)} faction={faction} figures={false} />
          {attendees.length > 5 ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 1.5 }}>
              Showing 5 of {attendees.length}.
            </Typography>
          ) : null}
        </Section>
      ) : null}

      {event.venue.name || event.venue.address ? (
        <Section title="Getting there" icon={PlaceIcon}>
          {event.coordinates ? (
            <Box sx={{ mb: 2 }}>
              <VenueMap
                latitude={event.coordinates.latitude}
                longitude={event.coordinates.longitude}
                name={event.venue.name ?? event.title}
                monogram={monogram}
                faction={faction}
              />
            </Box>
          ) : null}
          <Stack spacing={0.25}>
            {[event.venue.name, event.venue.address, event.venue.postcode]
              .filter(Boolean)
              .map((line) => (
                <Typography key={line} variant="body2">{line}</Typography>
              ))}
          </Stack>
          {event.directionsUrl ? (
            <Typography component="a" href={event.directionsUrl} target="_blank" rel="noreferrer"
              variant="body2" sx={{ color: tokens.brand, fontWeight: 600, mt: 1.5, display: "inline-block" }}>
              Get directions
            </Typography>
          ) : null}
        </Section>
      ) : null}

      {/* Club-only until tickets exist: legacy hides this from anyone without one. */}
      {event.canSeePrivate && event.infoBoard ? (
        <Section title="Notes for the day" icon={InfoIcon}>
          <Typography variant="body1" sx={{ whiteSpace: "pre-line" }}>{event.infoBoard}</Typography>
        </Section>
      ) : null}
        </Box>

        <Stack spacing={3} sx={{ mt: { md: 4 } }}>
          {/* The club sells the tickets, so it gets the sales board where a
              buyer gets the desk — adding your own event's ticket to a basket
              and checking out to yourself is not a thing anybody does. */}
          {event.ticketTypes.length && event.canManageClub ? (
            <TicketSalesBoard
              tickets={tickets}
              faction={faction}
              slug={event.clubSlug}
              eventKey={event.legacyId}
              hasEnded={event.hasEnded}
              trail={trail}
            />
          ) : event.ticketTypes.length ? (
            <EventTickets
              tickets={tickets}
              cart={cart}
              faction={faction}
              slug={event.clubSlug}
              eventKey={event.legacyId}
              eventId={event.id}
              signedIn={Boolean(viewer)}
              hasEnded={event.hasEnded}
              myBookingReference={event.myBookingReference}
              myBookingCount={event.myBookingCount}
            />
          ) : null}
        </Stack>
      </Box>
    </Container>
  );
}
