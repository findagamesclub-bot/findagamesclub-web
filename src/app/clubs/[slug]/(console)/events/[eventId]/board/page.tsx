import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import BoardMasthead from "@/components/board/BoardMasthead";
import EventBoard from "@/components/events/EventBoard";
import { getEventDetail } from "@/services/eventDetail.service";
import { getEventThreads } from "@/services/eventBoard.service";
import { getCurrentProfile } from "@/services/auth.service";
import { clubIdentity } from "@/utils/club-identity";
import { pageFrom } from "@/utils/paging";
import { nightLabel } from "@/utils/dates";
import { tokens } from "@/lib/tokens";

export async function generateMetadata(
  { params }: PageProps<"/clubs/[slug]/events/[eventId]/board">,
) {
  const { slug, eventId } = await params;
  const event = await getEventDetail(slug, eventId, null);
  return { title: event ? `Event board · ${event.title}` : "Event not found" };
}

/**
 * The board for one event.
 *
 * Ticket holders and the club, matching legacy's _can_access_event_board. The
 * gate is in the database, so a reader without a ticket gets no rows rather
 * than a filtered list; this page turns that into an explanation instead of an
 * empty screen.
 */
export default async function EventBoardPage(
  { params, searchParams }: PageProps<"/clubs/[slug]/events/[eventId]/board">,
) {
  const { slug, eventId } = await params;
  const query = await searchParams;

  const viewer = await getCurrentProfile();
  if (!viewer) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(`/clubs/${slug}/events/${eventId}/board`)}`);
  }

  const event = await getEventDetail(slug, eventId, viewer);
  if (!event) notFound();

  const { faction, monogram } = clubIdentity(event.clubSlug, event.clubName);
  // A page of threads, not every thread with every reply inside it.
  const board = event.canSeePrivate
    ? await getEventThreads(event.id, pageFrom(query.page))
    : { threads: [], total: 0, replies: 0, page: 1, perPage: 8, failed: false };

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      {/* The club board's own plate, which this is one of. Two boards that
          behave the same way look the same way. */}
      <BoardMasthead
        eyebrow={`EVENT BOARD · ${event.startDate
          ? nightLabel(event.startDate).toUpperCase() : "DIDCOT"}`}
        title={event.title}
        clubName={event.clubName}
        clubSlug={event.clubSlug}
        monogram={monogram}
        back={{ href: `/clubs/${slug}/events/${eventId}`, label: event.title }}
        faction={faction}
        threads={board.total}
        replies={board.replies}
      />

      {event.canSeePrivate ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 2.5 }}>
          {`Everybody holding a ticket for ${event.title} can read and post here.`}
        </Typography>
      ) : null}

      {event.canSeePrivate ? (
        <EventBoard
          threads={board.threads}
          total={board.total}
          page={board.page}
          perPage={board.perPage}
          failed={board.failed}
          faction={faction}
          slug={slug}
          eventKey={eventId}
          eventId={event.id}
        />
      ) : (
        <Typography variant="body1" sx={{ color: tokens.inkMuted, maxWidth: 560 }}>
          The board is for people going to this event. Book a ticket and it opens
          up, along with the noticeboard and the draw.
        </Typography>
      )}
    </Container>
  );
}
