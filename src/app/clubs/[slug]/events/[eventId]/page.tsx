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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import Section from "@/components/ui/Section";
import EventPlacings from "@/components/events/EventPlacings";
import EventPairings from "@/components/events/EventPairings";
import FacilityChips from "@/components/clubs/FacilityChips";
import EventHero from "@/components/events/EventHero";
import { getEventDetail } from "@/services/eventDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership } from "@/services/memberships.service";
import { getBuyableTickets } from "@/services/tickets.service";
import { getAttendees } from "@/services/eventBookings.service";
import { getRoster } from "@/services/memberships.service";
import { getEventRoster, getEventBoard } from "@/services/eventBoard.service";
import EventCommunity from "@/components/events/EventCommunity";
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

  // Who else is going, and what they are saying. Both are open to anybody
  // holding a ticket, matching legacy: before a tournament the thing you want
  // to know is who is turning up.
  const [roster, threads] = event.canSeePrivate
    ? await Promise.all([getEventRoster(event.id), getEventBoard(event.id)])
    : [[], []];

  // Only for the results editor, so a winner can be linked to their profile
  // and the placing shows on it. Members-only by RLS, and a manager passes.
  const placingRoster = event.canManageClub
    ? (await getRoster(event.clubId).catch(() => []))
        .filter((m) => m.status === "approved")
        .map((m) => ({ id: m.profileId, name: m.fullName }))
    : [];

  const { faction, monogram } = clubIdentity(event.clubSlug, event.clubName);
  const back = backTarget(query.from, { slug: event.clubSlug, name: event.clubName }, query);
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

      {/* The same chips the club page and the map use. An event lists its own
          facilities because a tournament often runs somewhere the club does
          not usually play. */}
      {event.facilities.length ? (
        <Section title="Event facilities" icon={CheckCircleIcon} navLabel="Facilities">
          <FacilityChips values={event.facilities} />
        </Section>
      ) : null}

      {/* The club sees the section even when it is empty, because an empty
          results section is the prompt to fill it in. Everybody else sees
          nothing until there is something to see. */}
      {event.placings.length || event.canManageClub ? (
        <Section title="Results" icon={EmojiEventsIcon}
          note={!event.placings.length && event.canManageClub
            ? "Nobody is on the results yet. Record the winner and any other places you want to show."
            : undefined}>
          <EventPlacings
            placings={event.placings}
            faction={faction}
            viewerName={viewer?.full_name ?? null}
            admin={event.canManageClub
              ? { slug, eventKey: event.legacyId, eventId: event.id, roster: placingRoster }
              : undefined}
          />
        </Section>
      ) : null}

      {/* What a ticket unlocks, together: the roster and the board. */}
      {event.canSeePrivate ? (
        <EventCommunity
          roster={roster}
          threads={threads}
          faction={faction}
          viewerId={viewer?.id ?? null}
          canManage={event.canManageClub}
          slug={slug}
          eventId={eventId}
          trail={trail}
          hasAttendees={attendees.length > 0}
        />
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

      {/* Ticket holders and the club, same gate as the noticeboard below: a
          draw is only any use to somebody playing in it. */}
      {event.canSeePrivate && event.pairings.length ? (
        <Section title="Round pairings" icon={TableRestaurantIcon} navLabel="Pairings">
          <EventPairings
            pairings={event.pairings}
            faction={faction}
            viewerName={viewer?.full_name ?? null}
          />
        </Section>
      ) : null}

      {/* Club-only until tickets exist: legacy hides this from anyone without one. */}
      {event.canSeePrivate && event.infoBoard ? (
        <Section title="Tournament noticeboard" icon={InfoIcon} navLabel="Noticeboard">
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
