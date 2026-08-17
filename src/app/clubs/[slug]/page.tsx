import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ClubHeader from "@/components/clubs/ClubHeader";
import ClubSidebar from "@/components/clubs/ClubSidebar";
import ClubEventList from "@/components/clubs/ClubEventList";
import { MembershipTiers, PricingList } from "@/components/clubs/ClubTiers";
import Section from "@/components/ui/Section";
import { tokens } from "@/lib/tokens";
import { getClubDetail } from "@/services/clubDetail.service";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  if (!club) return { title: "Club not found" };
  return {
    title: club.name,
    description: club.summary ?? `${club.name} in ${club.city}.`,
  };
}

export default async function ClubPage({ params }: PageProps<"/clubs/[slug]">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubHeader club={club} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,2fr) minmax(280px,1fr)" }, gap: 4, mt: 4 }}>
        <Stack spacing={0}>
          {club.description ? (
            <Section title="About">
              <Typography variant="body1" sx={{ whiteSpace: "pre-line" }}>{club.description}</Typography>
            </Section>
          ) : null}

          {club.games.length ? (
            <Section title="Featured games">
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                {club.games.map((g) => <Chip key={g} label={g} size="small" variant="outlined" />)}
              </Stack>
            </Section>
          ) : null}

          {club.upcomingEvents.length ? (
            <Section title="Upcoming events">
              <ClubEventList events={club.upcomingEvents} />
            </Section>
          ) : null}

          {club.membershipTiers.length ? (
            <Section title="Membership">
              <MembershipTiers tiers={club.membershipTiers} />
            </Section>
          ) : null}

          {club.pricingModels.length ? (
            <Section title="Pricing">
              <PricingList models={club.pricingModels} />
            </Section>
          ) : null}

          {club.reviewSummary ? (
            <Section title={`Reviews · ${club.reviewSummary.average.toFixed(1)} from ${club.reviewSummary.count}`}>
              <Stack spacing={2}>
                {club.reviews.map((r) => (
                  <Stack key={r.id} spacing={0.5} sx={{ pt: 1, borderTop: `1px solid ${tokens.rule}` }}>
                    <Typography variant="subtitle1">
                      {r.authorName} · {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                    </Typography>
                    {r.comment ? <Typography variant="body2" color="text.secondary">{r.comment}</Typography> : null}
                  </Stack>
                ))}
              </Stack>
            </Section>
          ) : null}

          {club.pastEvents.length ? (
            <Section title="Past events">
              <ClubEventList events={club.pastEvents} />
            </Section>
          ) : null}
        </Stack>

        <Box sx={{ mt: 7 }}>
          <ClubSidebar club={club} />
        </Box>
      </Box>
    </Container>
  );
}
