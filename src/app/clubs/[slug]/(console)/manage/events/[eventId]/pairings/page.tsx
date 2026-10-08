import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import BackLink from "@/components/ui/BackLink";
import PairingsBoard from "./PairingsBoard";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getEvent } from "@/services/eventEditor.service";
import { getDrawPublic, getRoster, getRounds } from "@/services/eventPairings.service";
import { getRoundArmies } from "@/services/eventPairingArmies.service";
import { getTeamDraw, getTeams, isTeamEvent } from "@/services/eventTeams.service";
import { getBuilderFor } from "@/services/armyBuilder.service";
import { getMemberLists } from "@/services/resultArmies.service";
import { clubIdentity } from "@/utils/club-identity";
import { eventRecordsArmies } from "@/utils/event-meta";
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

  // One wave. The audience setting is a boolean out of a function, because the
  // column is newer than the generated types; it rides along rather than
  // costing a round trip of its own.
  const [rounds, roster, drawPublic, builder, lists, teamEvent, teams, fixtures] =
    await Promise.all([
      getRounds(event.id), getRoster(event.id), getDrawPublic(event.id),
      getBuilderFor(club.id).catch(() => null),
      getMemberLists(club.id).catch(() => []),
      // Empty at an ordinary event, which is what keeps this page the page it
      // was. Both ride in the wave that was already here rather than costing
      // a round trip of their own.
      isTeamEvent(event.id),
      getTeams(event.id).catch(() => []),
      getTeamDraw(event.id).catch(() => []),
    ]);

  // The armies need the match ids the first wave produced, so they cannot join
  // it. One query for every table on the event rather than one per round: a
  // club flicking between round tabs is reading the same page.
  const armies = await getRoundArmies(
    rounds.flatMap((round) => round.matches.map((match) => match.id)));

  // Two short strings, not the catalogue itself. The dialog fetches that on
  // its first open, because a published snapshot is close to a megabyte.
  //
  // Null hides the army fields outright, which is the client's second
  // condition: a 40k club running a Blood Bowl weekend names Blood Bowl on the
  // event, and a faction cascade on those tables is boxes nobody can fill in.
  const records = builder?.enabled && builder.editionId && builder.catalogueVersion
    && eventRecordsArmies(event.featuredGames)
    ? { editionId: builder.editionId, catalogueVersion: builder.catalogueVersion }
    : null;
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
        // The second half of this names what the draw button does, so it has
        // to follow the event: "everybody coming is shuffled onto a table" is
        // not what happens at a team event and reads as the wrong page.
        lede={teamEvent
          ? "Which team plays which, and who plays whom inside it, round by round. Wargamers call these the pairings. Make the draw and your teams are shuffled against each other, with a table for board one, board two and so on."
          : "Who plays whom, on which table, round by round. Wargamers call these the pairings. Make the draw and everybody coming is shuffled onto a table, two at a time."}
      />

      <PairingsBoard
        slug={slug} eventId={event.id} rounds={rounds} roster={roster}
        roundCount={event.roundCount} faction={faction}
        showing={Number(round) || undefined} drawPublic={drawPublic}
        builder={records} lists={lists} armies={armies}
        teamEvent={teamEvent} teams={teams} fixtures={fixtures}
      />
    </Container>
  );
}
