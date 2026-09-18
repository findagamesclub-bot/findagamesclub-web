import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
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
import EventNoticeboard from "@/components/events/EventNoticeboard";
import EventCalledOff from "@/components/events/EventCalledOff";
import LockedNote from "@/components/events/LockedNote";
import EventTags from "@/components/events/EventTags";
import SectionNav from "@/components/ui/SectionNav";
import ManageStrip from "@/components/ui/ManageStrip";
import EventPairings from "@/components/events/EventPairings";
import FacilityChips from "@/components/clubs/FacilityChips";
import EventHero from "@/components/events/EventHero";
import { getEventDetail } from "@/services/eventDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership } from "@/services/memberships.service";
import { getBuyableTickets, getTicketStanding } from "@/services/tickets.service";
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

  // What the buyer may spend, for the points field in the ticket drawer. Only
  // worth a query once there is something to spend it on: an event nobody has
  // added a ticket to has no total for points to come off.
  const standing = viewer && cart?.lines.length
    ? await getTicketStanding({
        clubId: event.clubId,
        profileId: viewer.id,
        subtotal: cart.subtotal,
        currency: cart.currency,
        discountPercent: cart.discountPercent,
        tierLabel: cart.tierLabel ?? null,
      }).catch(() => null)
    : null;

  // Only the club may read booking rows, so this is skipped rather than
  // fetched-and-hidden — RLS would return nothing anyway.
  const attendees = event.canManageClub ? await getAttendees(event.id) : [];

  // Who else is going, and what they are saying. Both are open to anybody
  // holding a ticket, matching legacy: before a tournament the thing you want
  // to know is who is turning up.
  // Two audiences now, not one. The roster opens when the event is over and
  // becomes "who was there"; the board stays with the people who wrote in it
  // whatever the date (0065).
  const canSeeRecord = event.canSeePrivate || event.hasEnded;
  const [roster, threads] = await Promise.all([
    canSeeRecord ? getEventRoster(event.id) : Promise.resolve([]),
    event.canSeePrivate ? getEventBoard(event.id) : Promise.resolve([]),
  ]);

  // Only for the results editor, so a winner can be linked to their profile
  // and the placing shows on it. Members-only by RLS, and a manager passes.
  const placingRoster = event.canManageClub
    ? (await getRoster(event.clubId).catch(() => []))
        .filter((m) => m.status === "approved")
        .map((m) => ({ id: m.profileId, name: m.fullName }))
    : [];

  const cancelled = event.status === "cancelled";
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

      {/* First thing on the page, above the artwork. Everything under it reads
          as a live event otherwise, which is exactly what the club saw: a
          cancelled event still offering its last ticket. */}
      {cancelled ? (
        <EventCalledOff
          reason={event.cancelReason}
          bookingReference={event.myCancelledReference ?? event.myBookingReference}
          bookingCount={event.myBookingCount}
        />
      ) : null}

      {/* Counted from what has actually sold, not from the figure the club
          typed when it listed the event. Null where an event sells no typed
          tickets at all, and the hero falls back to that figure. */}
      <EventHero event={event} faction={faction}
        ticketsRemaining={tickets.length
          ? tickets.reduce<number | null>(
              (n, t) => (n === null || t.remaining === null ? null : n + t.remaining), 0)
          : null}
        admin={event.canManageClub ? { slug, eventKey: eventId } : undefined} />

      {event.canManageClub ? (
        // Straight to the three pages that run this event, rather than to the
        // console's front door: somebody opening their own event page on a
        // club night is going to the roster or the draw.
        <ManageStrip links={[
          { label: "Edit event", href: `/clubs/${slug}/manage/events/${event.id}` },
          { label: "The draw", href: `/clubs/${slug}/manage/events/${event.id}/pairings` },
          { label: `Who is coming (${attendees.length})`,
            href: `/clubs/${slug}/manage/events/${event.id}/roster` },
        ]} />
      ) : null}

      {/* The navLabels on the sections below were written for this and had
          nothing reading them. A tournament page runs to seven sections, and
          the noticeboard being first in the source is only half the answer to
          the club's worry that it gets missed: a shortcut to it from the top
          is the other half. Hides itself under three sections, so a thin event
          page does not grow a bar with two things on it. */}
      <SectionNav />

      <Box sx={{ display: "grid", gap: 4, mt: 1,
                 gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0,2fr) minmax(300px,1fr)" } }}>
        <Box sx={{ minWidth: 0 }}>
      {event.summary ? (
        <Typography variant="body1" sx={{ mt: 3, maxWidth: 680 }}>{event.summary}</Typography>
      ) : null}

      {/* The games were shown as bare chips and the format and event type were
          not shown at all, though both are stored and the directory filters
          events by format. Somebody could search for a wargaming event and
          find no mention of wargaming on the event they opened. */}
      <EventTags formats={event.formats} types={event.eventTypes}
        games={event.featuredGames} faction={faction} />

      {/* First, not last. The club feared it would be missed at the bottom and
          they were right: it sat under the map and the draw. It is the one
          block where the club is telling ticket holders something with a
          deadline on it, so it opens the page for the people it is addressed
          to. A visitor without a ticket never sees it and loses nothing.

          Same gate as the roster, the board and the draw: legacy hides all of
          it from anybody without a ticket. */}
      {/* Either half is enough. An event with notices and no info board used to
          render nothing at all, because the condition only asked about the
          board.

          And when there is a board the reader cannot open, say so rather than
          rendering nothing: hiding it is how somebody deciding whether to book
          never learns that ticket holders get the timings and the parking.
          Same call as a blocked ticket, which is shown with its reason. */}
      {event.hasNoticeboard ? (
        <Section title="Tournament noticeboard" icon={InfoIcon} navLabel="Noticeboard">
          {event.canSeePrivate ? (
            <EventNoticeboard text={event.infoBoard ?? ""} notices={event.notices}
              faction={faction} />
          ) : (
            <LockedNote
              title="This part is for people who are coming"
              body={event.hasEnded
                ? "The club posted directions, timings and updates here for everybody who had a ticket."
                : "The club has posted directions, timings and updates here. Book a place and they appear."}
            />
          )}
        </Section>
      ) : null}

      {/* The club sees the section even when it is empty, because an empty
          results section is the prompt to fill it in — but only once the event
          has actually been played. Standings on a tournament nobody has turned
          up to yet is a section asking to be filled in with results that do
          not exist. Everybody else sees nothing until there is something to
          see. */}
      {event.placings.length || (event.canManageClub && event.hasEnded) ? (
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

      {/* The service decides who gets these at all: the room before the event,
          everybody after it: a
          draw is only any use to somebody playing in it. */}
      {/* Called what the console calls it, so a member and the club are talking
          about the same thing. */}
      {event.pairings.length ? (
        <Section title="The draw" icon={TableRestaurantIcon} navLabel="The draw">
          <EventPairings
            pairings={event.pairings}
            faction={faction}
            viewerName={viewer?.full_name ?? null}
          />
        </Section>
      ) : null}

      {/* What a ticket unlocks, together: the roster and the board. */}
      {canSeeRecord ? (
        <EventCommunity
          showBoard={event.canSeePrivate}
          hasEnded={event.hasEnded}
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

      {/* The same chips the club page and the map use. An event lists its own
          facilities because a tournament often runs somewhere the club does
          not usually play. */}
      {event.facilities.length ? (
        <Section title="Event facilities" icon={CheckCircleIcon} navLabel="Facilities">
          <FacilityChips values={event.facilities} />
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
              eventId={event.id}
              hasEnded={event.hasEnded}
              cancelled={cancelled}
            />
          ) : event.ticketTypes.length ? (
            <EventTickets
              tickets={tickets}
              cart={cart}
              standing={standing}
              fullName={viewer?.full_name ?? ""}
              email={viewer?.email ?? ""}
              faction={faction}
              slug={event.clubSlug}
              eventKey={event.legacyId}
              eventId={event.id}
              signedIn={Boolean(viewer)}
              hasEnded={event.hasEnded}
              cancelled={cancelled}
              myBookingReference={event.myBookingReference}
              myBookingCount={event.myBookingCount}
            />
          ) : null}
        </Stack>
      </Box>
    </Container>
  );
}
