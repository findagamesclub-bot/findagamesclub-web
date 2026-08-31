import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import CompetitionManager from "@/components/clubs/CompetitionManager";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
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
  if (!(club.ownerId === viewer.id || viewer.role === "admin")) notFound();

  const { faction } = clubIdentity(club.slug, club.name);
  const competitions = await getManagedCompetitions(club.id);
  const running = competitions.filter((c) => !c.isCompleted).length;

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader back={backTarget(query.from, club)}
        title="Competitions" clubName={club.name} clubSlug={club.slug} faction={faction}
        stats={[
          { label: competitions.length === 1 ? "in total" : "in total",
            value: String(competitions.length) },
          ...(running ? [{ label: "running", value: String(running), emphasis: true }] : []),
        ]} />

      <CompetitionManager clubId={club.id} slug={slug} faction={faction}
        competitions={competitions} />
    </Container>
  );
}
