import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmptyState from "@/components/ui/EmptyState";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import RivalryTable from "@/components/clubs/RivalryTable";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership } from "@/services/memberships.service";
import { getClubRivalries } from "@/services/games.service";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget } from "@/utils/back-link";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/rivalries">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Rivalries · ${club.name}` : "Club not found" };
}

/**
 * Who plays whom at this club.
 *
 * Members only, like the roster it sits beside: it is a list of the club's
 * people and their results, which is not a visitor's business. The function
 * behind it checks membership itself, since it reads past RLS.
 */
export default async function ClubRivalriesPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/rivalries">) {
  const { slug } = await params;
  const query = await searchParams;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/rivalries`);

  const canManage = club.ownerId === viewer.id || viewer.role === "admin";
  const membership = await getMyMembership(club.id, viewer.id);
  if (!canManage && membership.status !== "approved") notFound();

  const { faction } = clubIdentity(club.slug, club.name);
  const back = backTarget(query.from, club);
  const rivalries = await getClubRivalries(club.id).catch(() => []);

  const games = rivalries.reduce((total, row) => total + row.played, 0);
  const level = rivalries.filter((row) => row.level && row.played > 1).length;

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader
        title="Rivalries"
        clubName={club.name}
        clubSlug={club.slug}
        back={back}
        faction={faction}
        note={rivalries.length
          ? "Ranked by games played, so the pairs who keep meeting come first."
          : null}
        stats={[
          { label: rivalries.length === 1 ? "pairing" : "pairings",
            value: String(rivalries.length), emphasis: true },
          { label: "games", value: String(games) },
          ...(level ? [{ label: "level", value: String(level) }] : []),
        ]}
      />

      {rivalries.length ? (
        <Stack spacing={2}>
          <RivalryTable rivalries={rivalries} viewerId={viewer.id} faction={faction} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Built from table bookings with a result on them. Add the score after
            a game and it counts here.
          </Typography>
        </Stack>
      ) : (
        <EmptyState
          title="No rivalries yet"
          description="Book a table against another member, add the score afterwards, and the pairing appears here."
          action={{ label: "Book a table", href: `/clubs/${club.slug}/bookings` }}
        />
      )}
    </Container>
  );
}
