import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import HorizontalBarChart from "@/components/ui/HorizontalBarChart";
import MonoLabel from "@/components/ui/MonoLabel";
import { tokens } from "@/lib/tokens";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import CompetitionManager from "@/components/clubs/CompetitionManager";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getManagedCompetitions } from "@/services/competitions.service";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget } from "@/utils/back-link";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/competitions/manage">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Competitions · ${club.name}` : "Club not found" };
}

/** Setting up a club's leagues, ladders and campaigns. Club only. */
export default async function ManageCompetitionsPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/competitions/manage">) {
  const { slug } = await params;
  const query = await searchParams;

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/competitions/manage`);
  const access = await getClubAccess(club.id, viewer);
  if (!access.can("competitions.manage")) notFound();

  const { faction } = clubIdentity(club.slug, club.name);
  const competitions = await getManagedCompetitions(club.id);
  const running = competitions.filter((c) => !c.isCompleted).length;

  // Built from what is already loaded. A finished competition is greyed rather
  // than dropped: last season's turnout is the thing this season is measured
  // against.
  const playerRows = competitions
    .map((c) => ({
      label: c.title,
      value: c.standings.length,
      color: c.isCompleted ? tokens.rule : faction.base,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader back={backTarget(query.from, club)}
        title="Competitions" clubName={club.name} clubSlug={club.slug} faction={faction}
        stats={[
          { label: competitions.length === 1 ? "in total" : "in total",
            value: String(competitions.length) },
          ...(running ? [{ label: "running", value: String(running), emphasis: true }] : []),
        ]} />

      {/* Who is actually turning out for each one. A league with two players
          and a ladder with thirty are not the same thing, and the cards below
          say "2 players" in the same type as everything else on them. */}
      {playerRows.length ? (
        <Box sx={{ mb: 3, p: 2, border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                   backgroundColor: tokens.paper }}>
          <MonoLabel>Players in each competition</MonoLabel>
          <HorizontalBarChart rows={playerRows} suffix=" players" />
        </Box>
      ) : null}

      <CompetitionManager clubId={club.id} slug={slug} faction={faction}
        competitions={competitions} />
    </Container>
  );
}
