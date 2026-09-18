import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import BackLink from "@/components/ui/BackLink";
import PairingsBoard from "./PairingsBoard";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getEvent } from "@/services/eventEditor.service";
import { getRoster, getRounds } from "@/services/eventPairings.service";
import { clubIdentity } from "@/utils/club-identity";
import { consoleBackTarget } from "@/utils/back-link";

export const metadata = { title: "The draw" };

/** The draw, round by round. */
export default async function PairingsPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/events/[eventId]/pairings">) {
  const { slug, eventId } = await params;
  const { round, from } = await searchParams;

  // Independent of each other, so one round trip rather than two.
  const [viewer, club] = await Promise.all([
    getCurrentProfile(),
    getClubDetail(slug),
  ]);
  if (!viewer) {
    redirect(`/auth/sign-in?next=/clubs/${slug}/manage/events/${eventId}/pairings`);
  }
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("events.manage")) notFound();

  const event = await getEvent(club.id, Number(eventId));
  if (!event) notFound();

  const [rounds, roster] = await Promise.all([
    getRounds(event.id), getRoster(event.id),
  ]);
  const { faction } = clubIdentity(club.slug, club.name);
  const back = consoleBackTarget(from, { slug, id: event.id, title: event.title });

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      {/* Back to wherever they came from. Arriving from the bookings list and
          being sent to the event editor is the page losing their place. */}
      <BackLink href={back.href} label={`Back to ${back.label}`} />

      <PageHead
        title="The draw"
        // Named plainly, with the jargon after it. "Pairings" is what a 40k
        // player calls this and what Best Coast Pairings is named for, so the
        // word has to be here; it is just not the thing to lead with when a
        // club secretary who has never run a tournament opens the page.
        lede="Who plays whom, on which table, round by round. Wargamers call these the pairings. Make the draw and everybody coming is shuffled onto a table, two at a time."
      />

      <PairingsBoard
        slug={slug} eventId={event.id} rounds={rounds} roster={roster}
        roundCount={event.roundCount} faction={faction}
        showing={Number(round) || undefined}
      />
    </Container>
  );
}
