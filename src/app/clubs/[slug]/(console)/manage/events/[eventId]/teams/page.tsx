import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import BackLink from "@/components/ui/BackLink";
import TeamBoard from "./TeamBoard";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getEvent } from "@/services/eventEditor.service";
import { getRoster } from "@/services/eventPairings.service";
import { getTeamDraw, getTeams, isTeamEvent } from "@/services/eventTeams.service";
import { consoleBackTarget } from "@/utils/back-link";

export const metadata = { title: "Teams" };

/** The teams at a team event, and how they are doing. */
export default async function TeamsPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/events/[eventId]/teams">) {
  const { slug, eventId } = await params;
  const { from } = await searchParams;

  const [viewer, club] = await Promise.all([getCurrentProfile(), getClubDetail(slug)]);
  if (!viewer) {
    redirect(`/auth/sign-in?next=/clubs/${slug}/manage/events/${eventId}/teams`);
  }
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("events.manage")) notFound();

  const event = await getEvent(club.id, Number(eventId));
  if (!event) notFound();

  // One wave. The switch, the teams and every fixture on the event: the
  // running table reads all of them, and five rounds is one query rather than
  // five, which is the call `getRoundArmies` already made.
  const [teamEvent, teams, fixtures, roster] = await Promise.all([
    isTeamEvent(event.id),
    getTeams(event.id).catch(() => []),
    getTeamDraw(event.id).catch(() => []),
    getRoster(event.id).catch(() => []),
  ]);

  const back = consoleBackTarget(from, { slug, id: event.id, title: event.title });

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <BackLink href={back.href} label={`Back to ${back.label}`} />

      <PageHead
        title="Teams"
        lede="Who plays for whom, and in what order. The draw starts by pairing first against first, so the list is the captain's call, and any table can be changed on the draw afterwards. Once the teams are in, every round is drawn from them."
      />

      <TeamBoard slug={slug} eventId={event.id} teamEvent={teamEvent}
        teams={teams} fixtures={fixtures} roster={roster} />
    </Container>
  );
}
