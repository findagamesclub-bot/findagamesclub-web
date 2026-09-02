import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import EventBoard from "@/components/events/EventBoard";
import { getEventDetail } from "@/services/eventDetail.service";
import { getEventBoard } from "@/services/eventBoard.service";
import { getCurrentProfile } from "@/services/auth.service";
import { clubIdentity } from "@/utils/club-identity";
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
  { params }: PageProps<"/clubs/[slug]/events/[eventId]/board">,
) {
  const { slug, eventId } = await params;

  const viewer = await getCurrentProfile();
  if (!viewer) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(`/clubs/${slug}/events/${eventId}/board`)}`);
  }

  const event = await getEventDetail(slug, eventId, viewer);
  if (!event) notFound();

  const { faction } = clubIdentity(event.clubSlug, event.clubName);
  const posts = event.canSeePrivate ? await getEventBoard(event.id) : [];

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader
        title="Event board"
        clubName={event.clubName}
        clubSlug={event.clubSlug}
        back={{ href: `/clubs/${slug}/events/${eventId}`, label: event.title }}
        faction={faction}
        note={event.canSeePrivate
          ? `Everybody holding a ticket for ${event.title} can read and post here.`
          : null}
        stats={[
          { label: posts.length === 1 ? "thread" : "threads", value: String(posts.length) },
          ...(event.startDate
            ? [{ label: "event", value: nightLabel(event.startDate).toUpperCase() }]
            : []),
        ]}
      />

      {event.canSeePrivate ? (
        <EventBoard
          posts={posts}
          faction={faction}
          viewerId={viewer.id}
          canManage={event.canManageClub}
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
