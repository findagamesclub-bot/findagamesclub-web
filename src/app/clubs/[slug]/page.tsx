import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ClubHeader from "@/components/clubs/ClubHeader";
import ClubGallery from "@/components/clubs/ClubGallery";
import GameChips from "@/components/clubs/GameChips";
import ClubSidebar from "@/components/clubs/ClubSidebar";
import ClubEventList from "@/components/clubs/ClubEventList";
import { MembershipTiers, PricingList } from "@/components/clubs/ClubTiers";
import Section from "@/components/ui/Section";
import StarRating from "@/components/ui/StarRating";
import InfoIcon from "@mui/icons-material/Info";
import CasinoIcon from "@mui/icons-material/Casino";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import SellIcon from "@mui/icons-material/Sell";
import StarIcon from "@mui/icons-material/Star";
import EventIcon from "@mui/icons-material/Event";
import { tokens } from "@/lib/tokens";
import { getClubDetail } from "@/services/clubDetail.service";
import { clubIdentity } from "@/utils/club-identity";

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

  const { faction } = clubIdentity(club.slug, club.name);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubHeader club={club} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,2fr) minmax(280px,1fr)" }, gap: 4, mt: 4 }}>
        <Stack spacing={0}>
          {club.description ? (
            <Section title="About" icon={InfoIcon}>
              <Typography variant="body1" sx={{ whiteSpace: "pre-line" }}>{club.description}</Typography>
            </Section>
          ) : null}

          {club.games.length ? (
            <Section title="Featured games" icon={CasinoIcon}>
              <GameChips games={club.games} faction={faction} max={club.games.length} />
            </Section>
          ) : null}

          {club.images.length > 1 ? (
            <Section title="Photos" icon={PhotoLibraryIcon}>
              <ClubGallery images={club.images} slug={club.slug} name={club.name} />
            </Section>
          ) : null}

          {club.upcomingEvents.length ? (
            <Section title="Upcoming events">
              <ClubEventList events={club.upcomingEvents} />
            </Section>
          ) : null}

          {club.membershipTiers.length ? (
            <Section title="Membership" icon={CardMembershipIcon}>
              <MembershipTiers tiers={club.membershipTiers} />
            </Section>
          ) : null}

          {club.pricingModels.length ? (
            <Section title="Pricing" icon={SellIcon}>
              <PricingList models={club.pricingModels} />
            </Section>
          ) : null}

          {club.reviewSummary ? (
            <Section
              title="Reviews"
              icon={StarIcon}
              action={
                <StarRating
                  value={club.reviewSummary.average}
                  caption={`${club.reviewSummary.average.toFixed(1)} from ${club.reviewSummary.count}`}
                />
              }
            >
              <Stack spacing={2}>
                {club.reviews.map((r) => (
                  <Stack key={r.id} spacing={0.75} sx={{ pt: 1.5, borderTop: `1px solid ${tokens.rule}` }}>
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                      <Typography variant="subtitle1">{r.authorName}</Typography>
                      <StarRating value={r.rating} />
                    </Stack>
                    {r.comment ? <Typography variant="body2" color="text.secondary">{r.comment}</Typography> : null}
                  </Stack>
                ))}
              </Stack>
            </Section>
          ) : null}

          {club.pastEvents.length ? (
            <Section title="Past events" icon={EventIcon}>
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
