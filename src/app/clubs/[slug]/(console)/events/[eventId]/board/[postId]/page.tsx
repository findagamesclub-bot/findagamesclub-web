import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import PageHead from "@/components/ui/PageHead";
import LinkButton from "@/components/ui/LinkButton";
import EventThread from "@/components/events/EventThread";
import { getCurrentProfile } from "@/services/auth.service";
import { getEventDetail } from "@/services/eventDetail.service";
import { getEventThread } from "@/services/eventBoard.service";
import { getReported } from "@/services/myReports.service";
import { clubIdentity } from "@/utils/club-identity";
import { pageFrom } from "@/utils/paging";

export const metadata = { title: "Thread" };

/**
 * One thread on an event board, with its replies paged.
 *
 * Its own page, the way the club board has worked since 0037. The board used
 * to render every thread expanded, so a thread with two hundred replies drew
 * two hundred of them inside a card with no way to collapse them, and the list
 * carried every reply on the event just to show eight titles.
 */
export default async function EventThreadPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/events/[eventId]/board/[postId]">) {
  const { slug, eventId, postId } = await params;
  const query = await searchParams;

  const viewer = await getCurrentProfile();
  if (!viewer) {
    redirect(`/auth/sign-in?next=/clubs/${slug}/events/${eventId}/board/${postId}`);
  }

  const event = await getEventDetail(slug, eventId, viewer);
  if (!event) notFound();
  // The board is for ticket holders. RLS says the same thing, so this is only
  // about which page somebody lands on.
  if (!event.canSeePrivate) notFound();

  const [board, reported] = await Promise.all([
    // Page 0 means the last one, which is where a conversation is read from.
    getEventThread(Number(postId), pageFrom(query.page) === 1 && !query.page
      ? 0 : pageFrom(query.page)),
    getReported(viewer.id),
  ]);
  if (!board) notFound();

  const { faction } = clubIdentity(slug, event.clubName);

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <Stack spacing={2}>
        <LinkButton variant="text" size="small"
          href={`/clubs/${slug}/events/${eventId}/board`}>
          Back to the board
        </LinkButton>
        <PageHead title={board.thread.title}
          lede={`${board.thread.replyCount === 1 ? "1 reply" : `${board.thread.replyCount} replies`} on ${event.title}`} />
        <EventThread
          board={board}
          faction={faction}
          viewerId={viewer.id}
          canManage={event.canManageClub}
          slug={slug}
          eventKey={eventId}
          eventDbId={event.id}
          reported={reported}
        />
      </Stack>
    </Container>
  );
}
