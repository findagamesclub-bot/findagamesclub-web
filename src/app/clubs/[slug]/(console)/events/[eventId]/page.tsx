import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import ClubGallery from "@/components/clubs/ClubGallery";
import LinkButton from "@/components/ui/LinkButton";
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
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import Section from "@/components/ui/Section";
import EventPlacings from "@/components/events/EventPlacings";
import EventNoticeboard from "@/components/events/EventNoticeboard";
import EventCalledOff from "@/components/events/EventCalledOff";
import TakenDownNotice from "@/components/ui/TakenDownNotice";
import { getEventSuspension } from "@/services/adminListings.service";
import ClaimNamesNotice from "@/components/events/ClaimNamesNotice";
import LockedNote from "@/components/events/LockedNote";
import EventTags from "@/components/events/EventTags";
import SectionNav from "@/components/ui/SectionNav";
import ManageStrip from "@/components/ui/ManageStrip";
import EventPairings from "@/components/events/EventPairings";
import EventTeams from "@/components/events/EventTeams";
import EventTeamDraw from "@/components/events/EventTeamDraw";
import TeamResults from "@/components/events/TeamResults";
import EventArmyMeta from "@/components/events/EventArmyMeta";
import EmptyState from "@/components/ui/EmptyState";
import FacilityChips from "@/components/clubs/FacilityChips";
import EventHero from "@/components/events/EventHero";
import { getEventDetail } from "@/services/eventDetail.service";
import { countClaimableNames } from "@/services/memberCodes.service";
import { getEventMeta } from "@/services/meta.service";
import { armyMetaWait, eventRecordsArmies } from "@/utils/event-meta";
import { londonToday } from "@/services/bookingCalendar.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership } from "@/services/memberships.service";
import { getBuyableTickets, getTicketStanding } from "@/services/tickets.service";
import { getAttendees } from "@/services/eventBookings.service";
import { getEventRoster, getEventThreads } from "@/services/eventBoard.service";
import EventCommunity from "@/components/events/EventCommunity";
import EventTickets from "@/components/tickets/EventTickets";
import TicketSalesBoard from "@/components/tickets/TicketSalesBoard";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget, carryFrom } from "@/utils/back-link";
import VenueMap from "@/components/map/VenueMap";
import { mono, tokens } from "@/lib/tokens";
import { owed } from "@/utils/door-list";

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
  // Rides the roster's wave rather than a wave of its own: it needs nothing
  // the roster does not already have, and it was costing a round trip of its
  // own further down the page.
  const [roster, threads, eventArmies] = await Promise.all([
    canSeeRecord ? getEventRoster(event.id) : Promise.resolve([]),
    // The summary shows three titles and a count, so it takes the first page
    // rather than every thread on the event.
    event.canSeePrivate
      ? getEventThreads(event.id, 1)
      : Promise.resolve({ threads: [], total: 0, replies: 0, page: 1, perPage: 8,
                          failed: false }),
    // Asked whenever the event could have 40k armies against it, which is no
    // longer gated on the event having started: a club types its placings and
    // its draw in before and during the day, and waiting for the start date
    // meant the panel was empty exactly when they were looking for it.
    eventRecordsArmies(event.featuredGames)
      ? getEventMeta(event.id).catch(() => [])
      : Promise.resolve([]),
  ]);

  // Why the panel is empty, for the club only. Computed rather than inferred
  // at the call site, because the three reasons are a date rule, a game-list
  // rule and "nothing typed in yet", and the sentence has to name the right
  // one.
  // A team event's own result. `event.placings` is the individual table and
  // stays empty at a team event, which is why the Results section used to show
  // nothing at all however the teams had finished.
  const placedTeams = event.teams.some((team) => team.finalRank !== null);

  const metaWait = armyMetaWait({
    games: event.featuredGames, rows: eventArmies.length,
  });

  // The roster, the army switch and the club's army lists used to be read
  // here for the results editor. The editor is in the console now, so this
  // page is three queries lighter for the club and reads exactly what a
  // member reads.

  // Asked only of somebody holding a ticket, because that is the first thing
  // the function checks and almost nobody reading an event page holds one. So
  // this costs a round trip for the handful of people it is for and nothing
  // at all for everybody else.
  const claimable = viewer && event.myBookingCount > 0
    ? await countClaimableNames(event.id)
    : 0;

  const cancelled = event.status === "cancelled";
  // Only on an event that is actually down, which is almost none of them, so
  // every other event page pays nothing for a banner it never draws. The
  // function answers nobody but the club's own team and an admin, so an
  // ordinary reader gets null and sees the hero's own "Taken down" and no
  // reason, which is right: our reason is written for the club.
  const takenDown = event.status === "suspended"
    ? await getEventSuspension(event.id)
    : null;
  const isSiteAdmin = viewer?.role === "admin";
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

      {/* Ours rather than the club's, and never both: an event an admin has
          taken down has not been called off, and saying both would be the page
          telling two different stories about the same evening. */}
      {takenDown ? (
        <TakenDownNotice kind="event" reason={takenDown.reason} at={takenDown.at}
          byName={takenDown.byName} canAct={isSiteAdmin}
          ask={{ id: event.id, slug: event.clubSlug,
                 askedAt: takenDown.askedAt, askedNote: takenDown.askedNote }} />
      ) : null}

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
          ...(event.teams.length
            ? [{ label: "Teams",
                 href: `/clubs/${slug}/manage/events/${event.id}/teams` }]
            : []),
          { label: `Who is coming (${attendees.length})`,
            href: `/clubs/${slug}/manage/events/${event.id}/roster` },
        ]} />
      ) : null}

      {/* Under the hero rather than beside the results: it is the one thing on
          this page that is about the reader rather than about the event. */}
      <ClaimNamesNotice slug={slug} eventKey={eventId} eventId={event.id}
        count={claimable} />

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

      {/* What was brought. Hidden outright when the event is not 40k, which is
          the client's own condition, and until it has started, which is the
          rule the placings already follow.

          Three separate rules can empty this and it used to vanish for all
          three, so the club's only way to find out which one applied was to
          ask. It now says so on the screen, and only to the club: a visitor
          has nothing to do about it and an empty panel would be noise. */}
      {eventArmies.length ? (
        <Section navLabel="Armies" title="Event analytics" icon={EmojiEventsIcon}
          note="What was taken to this event, from the finishing places and the draw.">
          <EventArmyMeta rows={eventArmies} top={3}
            href={`/clubs/${slug}/events/${eventId}/armies`} />
        </Section>
      ) : event.canManageClub && metaWait ? (
        <Section navLabel="Armies" title="Event analytics" icon={EmojiEventsIcon}
          note="What was taken to this event, from the finishing places and the draw.">
          <EmptyState title="No analytics yet" description={metaWait} />
        </Section>
      ) : null}

      {/* Who entered, and how the teams stand. Above the individual results
          because at a team event the team is the unit: somebody reading this
          page wants to know how their team did before how they did. Public,
          like the ticket types are: a tournament publishes who is playing. */}
      {event.teams.length ? (
        <Section title="Teams" icon={GroupWorkIcon} navLabel="Teams">
          <EventTeams teams={event.teams} fixtures={event.teamFixtures}
            faction={faction} viewerName={viewer?.full_name ?? null} />
        </Section>
      ) : null}

      {/* The club sees the section even when it is empty, because an empty
          results section is the prompt to fill it in — but only once the event
          has actually been played. Standings on a tournament nobody has turned
          up to yet is a section asking to be filled in with results that do
          not exist. Everybody else sees nothing until there is something to
          see. */}
      {event.placings.length || placedTeams || (event.canManageClub && event.hasEnded) ? (
        <Section title="Results" icon={EmojiEventsIcon}
          note={!event.placings.length && event.canManageClub
            ? "Nobody is on the results yet. Record the winner and any other places you want to show."
            : undefined}>
          {/* Read-only for everybody, the club included. Recording a place is
              done in the console beside the draw, because that is the same
              evening's work and doing half of it on the page members read was
              what the client asked about. */}
          {/* A team event finished as teams, so that is the result and it
              leads. The individual placings stay underneath where there are
              any: an event switched to teams part way through can be carrying
              both, and the one nobody can reach is the one that goes stale. */}
          {placedTeams ? <TeamResults teams={event.teams} faction={faction} /> : null}

          {event.placings.length ? (
            <Box sx={{ mt: placedTeams ? 3 : 0 }}>
              {placedTeams ? (
                <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                  letterSpacing: "0.1em", color: tokens.inkMuted,
                                  mb: 1.25 }}>
                  INDIVIDUAL PLACES
                </Typography>
              ) : null}
              <EventPlacings
                placings={event.placings}
                faction={faction}
                viewerName={viewer?.full_name ?? null}
              />
            </Box>
          ) : null}

          {event.canManageClub ? (
            <Box sx={{ mt: 2 }}>
              <LinkButton href={`/clubs/${slug}/manage/events/${event.id}/placings`}
                variant="outlined" size="small">
                {event.placings.length ? "Edit the results" : "Record the results"}
              </LinkButton>
            </Box>
          ) : null}
        </Section>
      ) : null}

      {/* The service decides who gets these at all: the room before the event,
          everybody after it: a
          draw is only any use to somebody playing in it. */}
      {/* Called what the console calls it, so a member and the club are talking
          about the same thing. */}
      {event.pairings.length || event.teamFixtures.length || event.drawLocked ? (
        <Section title="The draw" icon={TableRestaurantIcon} navLabel="The draw">
          {/* A team event's draw is the fixtures: the flat list of tables
              underneath says who plays whom and never says which team they
              are playing for, which is the whole question. */}
          {event.teamFixtures.length ? (
            <EventTeamDraw
              fixtures={event.teamFixtures}
              faction={faction}
              viewerName={viewer?.full_name ?? null}
            />
          ) : event.pairings.length ? (
            <EventPairings
              pairings={event.pairings}
              faction={faction}
              viewerName={viewer?.full_name ?? null}
            />
          ) : (
            <LockedNote
              title="This part is for people who are coming"
              body="The club has drawn the tables. Book a place and the draw appears here, whether or not you are a member." />
          )}
        </Section>
      ) : null}

      {/* What a ticket unlocks, together: the roster and the board. */}
      {canSeeRecord ? (
        <EventCommunity
          showBoard={event.canSeePrivate}
          hasEnded={event.hasEnded}
          roster={roster}
          threads={threads.threads}
          threadCount={threads.total}
          faction={faction}
          viewerId={viewer?.id ?? null}
          canManage={event.canManageClub}
          slug={slug}
          eventId={eventId}
          trail={trail}
          hasAttendees={attendees.length > 0}
        />
      ) : null}

      {/* The same gallery the club page uses, with the same lightbox, arrows
          and counter: an event's photos are photos and should open the way
          every other photo on the site opens. It draws nothing below two,
          because the first one is already the banner above and showing it
          twice is the clutter 16c was about. */}
      {event.images.length > 1 ? (
        <Section title="Photos" icon={PhotoLibraryIcon} navLabel="Photos">
          <ClubGallery images={event.images} slug={event.clubSlug}
            name={event.clubName} />
        </Section>
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
          {/* The club gets the sales board AND the desk, in that order.
              It used to get the board instead of the desk, on the reasoning
              that "adding your own event's ticket to a basket and checking
              out to yourself is not a thing anybody does". A tournament
              organiser playing in their own RTT is an ordinary Saturday in
              this hobby, and the client reported exactly that: a club owner
              could not book a place at their own event. The board is their
              job and leads; the desk sits under it priced off their own tier,
              the same desk everybody else uses. */}
          {event.ticketTypes.length && event.canManageClub ? (
            <TicketSalesBoard
              tickets={tickets}
              // What is still owed, through the same `owed()` the door list
              // uses. Totalling every booking here read £104.50 against a door
              // list saying £61.75, because it counted the ones the club had
              // already been paid for.
              due={owed(attendees).amount}
              faction={faction}
              slug={event.clubSlug}
              eventId={event.id}
              hasEnded={event.hasEnded}
              cancelled={cancelled}
              takenDown={event.status === "suspended"}
            />
          ) : null}

          {event.ticketTypes.length ? (
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
              takenDown={event.status === "suspended"}
              myBookingReference={event.myBookingReference}
              myBookingCount={event.myBookingCount}
            />
          ) : null}
        </Stack>
      </Box>
    </Container>
  );
}
