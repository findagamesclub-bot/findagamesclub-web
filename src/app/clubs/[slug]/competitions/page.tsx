import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import NextLink from "next/link";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import CompetitionCard from "@/components/clubs/CompetitionCard";
import NavTabs from "@/components/ui/NavTabs";
import Pager from "@/components/ui/Pager";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getCompetitionPage, PER_PAGE } from "@/services/competitions.service";
import { countByStatus } from "@/repositories/competitions.repository";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/competitions">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Leagues and campaigns · ${club.name}` : "Club not found" };
}

export default async function CompetitionsPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/competitions">) {
  const { slug } = await params;
  const query = await searchParams;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const status = query.status === "completed" ? "completed" : "active";
  const page = Number(query.page) || 1;

  const [{ items, total }, otherCount] = await Promise.all([
    getCompetitionPage(club.id, status, page),
    countByStatus(club.id, status === "active" ? "completed" : "active"),
  ]);

  // A club that has never run one has no page, rather than an empty one.
  if (!total && !otherCount) notFound();

  const viewer = await getCurrentProfile();
  const canManage = Boolean(viewer && (club.ownerId === viewer.id || viewer.role === "admin"));

  const { faction } = clubIdentity(club.slug, club.name);
  const counts = {
    active: status === "active" ? total : otherCount,
    completed: status === "completed" ? total : otherCount,
  };

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      {/* Only the club sees this. A club with none has no public page at all,
          so the card on My clubs is the other way in. */}
      {canManage ? (
        <Box sx={{ mb: 2 }}>
          <NextLink href={`/clubs/${slug}/competitions/manage`} style={{ textDecoration: "none" }}>
            <Typography variant="body2"
              sx={{ color: faction.deep, fontWeight: 600,
                    "&:hover": { textDecoration: "underline" } }}>
              Set up and edit competitions
            </Typography>
          </NextLink>
        </Box>
      ) : null}

      <ClubSectionHeader
        title="Leagues and campaigns"
        clubName={club.name}
        clubSlug={club.slug}
        faction={faction}
        note={`Every league, ladder and campaign ${club.name} has run, and how each one finished.`}
        stats={[
          { label: "Running", value: String(counts.active), emphasis: true },
          { label: "Finished", value: String(counts.completed) },
        ]}
      />

      <NavTabs
        ariaLabel="Competition status"
        accent={faction.base}
        value={status}
        tabs={[
          { value: "active", label: "Running now", count: counts.active,
            href: `/clubs/${club.slug}/competitions` },
          { value: "completed", label: "Finished", count: counts.completed,
            href: `/clubs/${club.slug}/competitions?status=completed` },
        ]}
      />

      <Stack spacing={2.5} sx={{ mt: 3 }}>
        {items.length ? (
          items.map((competition) => (
            <CompetitionCard key={competition.id} competition={competition} faction={faction} />
          ))
        ) : (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {status === "active"
              ? "Nothing running at the moment. The finished tab has the history."
              : "None have finished yet."}
          </Typography>
        )}

        <Pager page={page} total={total} noun="competitions" size={PER_PAGE}
          hrefFor={(to) =>
            `/clubs/${club.slug}/competitions?${new URLSearchParams({
              ...(status === "completed" ? { status } : {}),
              ...(to > 1 ? { page: String(to) } : {}),
            })}`} />
      </Stack>
    </Container>
  );
}
