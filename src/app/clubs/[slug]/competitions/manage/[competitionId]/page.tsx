import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Section from "@/components/ui/Section";
import BackLink from "@/components/ui/BackLink";
import PageHead from "@/components/account/PageHead";
import CompetitionHeader from "@/components/clubs/CompetitionHeader";
import StandingsEditor from "@/components/clubs/StandingsEditor";
import RoundsEditor from "@/components/clubs/RoundsEditor";
import LeaderboardIcon from "@mui/icons-material/LeaderboardOutlined";
import HistoryIcon from "@mui/icons-material/HistoryOutlined";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getManagedCompetitions } from "@/services/competitions.service";
import { getRoster } from "@/services/memberships.service";
import { clubIdentity } from "@/utils/club-identity";

export const metadata = { title: "Competition setup" };

/**
 * One competition: what it is, who is in it, and what happened each round.
 *
 * All three on one page rather than three. A club setting up a league does the
 * whole thing in one sitting, and a wizard would make them navigate between
 * steps they are flicking between anyway.
 */
export default async function CompetitionSetupPage({
  params,
}: PageProps<"/clubs/[slug]/competitions/manage/[competitionId]">) {
  const { slug, competitionId } = await params;

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/competitions/manage`);
  if (!(club.ownerId === viewer.id || viewer.role === "admin")) notFound();

  const competitions = await getManagedCompetitions(club.id);
  const competition = competitions.find((c) => String(c.id) === competitionId);
  if (!competition) notFound();

  const { faction } = clubIdentity(club.slug, club.name);

  // Only approved members can be linked to a row. Anybody else is a guest,
  // which is a name in the table and nothing more.
  const roster = (await getRoster(club.id))
    .filter((member) => member.status === "approved")
    .map((member) => ({ id: member.profileId, name: member.fullName }));

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <BackLink href={`/clubs/${slug}/competitions/manage`} label="Competitions" />
      <PageHead
        title={competition.title}
        lede={[competition.typeLabel, competition.statusLabel, competition.game,
               competition.season].filter(Boolean).join(" · ")}
      />

      <CompetitionHeader clubId={club.id} slug={slug} faction={faction}
        competition={competition} />

      <Section title="The table" icon={LeaderboardIcon}>
        <StandingsEditor competitionId={competition.id} slug={slug} faction={faction}
          standings={competition.standings} roster={roster} />
      </Section>

      <Section title="Rounds" icon={HistoryIcon}>
        <RoundsEditor competitionId={competition.id} slug={slug} faction={faction}
          rounds={competition.updates} />
      </Section>
    </Container>
  );
}
