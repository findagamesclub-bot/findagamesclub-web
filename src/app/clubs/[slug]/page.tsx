import { notFound } from "next/navigation";
import NextLink from "next/link";
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
import VenueMap from "@/components/map/VenueMap";
import Button from "@mui/material/Button";
import PlaceIcon from "@mui/icons-material/Place";
import DirectionsIcon from "@mui/icons-material/Directions";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership, getPendingRequests, getRoster } from "@/services/memberships.service";
import { getPayments, standing } from "@/services/payments.service";
import JoinClubPanel from "@/components/members/JoinClubPanel";
import ClubReviews from "@/components/reviews/ClubReviews";
import { getProgramme } from "@/services/loyalty.service";
import { getShop, isCoachingOn } from "@/services/clubExtras.service";

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

  const { faction, monogram } = clubIdentity(club.slug, club.name);

  const viewer = await getCurrentProfile();
  const canManage = Boolean(viewer && (club.ownerId === viewer.id || viewer.role === "admin"));

  // Only the sections this club actually runs get a tile in the panel.
  const [programme, shopItems, coachingOn] = await Promise.all([
    getProgramme(club.id),
    getShop({
      clubId: club.id, tiers: club.membershipTiers, canManageClub: canManage,
      signedIn: Boolean(viewer), isApprovedMember: false, viewerTierKey: null,
    }),
    isCoachingOn(club.id),
  ]);

  const membership = viewer
    ? await getMyMembership(club.id, viewer.id)
    : { id: null, status: "none" as const, tierKey: null, tierAssignedAt: null };

  // The roster is members-only by policy, so a non-member would silently read
  // zero rows. Asking at all would render "0 members" on a club with eighty.
  const isMember = canManage || membership.status === "approved";
  const canSeeRoster = isMember;
  const [roster, pending, myPayments] = await Promise.all([
    canSeeRoster ? getRoster(club.id) : Promise.resolve(null),
    canManage ? getPendingRequests(club.id) : Promise.resolve(null),
    // A member can read their own payments by policy, so they can be told
    // where they stand instead of having to ask the club.
    membership.id ? getPayments(membership.id) : Promise.resolve([]),
  ]);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubHeader club={club} canBook={isMember && (club.tablesAvailable ?? 0) > 0} />

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

          {/* Street level, next to the address, because "what is it near and
              can I park" is the question the sidebar's address cannot answer. */}
          {club.venue.coordinates ? (
            <Section title="Getting there" icon={PlaceIcon}>
              <Stack spacing={2}>
                <VenueMap
                  latitude={club.venue.coordinates.latitude}
                  longitude={club.venue.coordinates.longitude}
                  name={club.name}
                  monogram={monogram}
                  faction={faction}
                />

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}
                  sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}>
                  <Stack spacing={0.25}>
                    {[club.venue.name, club.venue.address, club.venue.postcode]
                      .filter(Boolean)
                      .map((line) => (
                        <Typography key={line} variant="body2">{line}</Typography>
                      ))}
                  </Stack>

                  {club.venue.directionsUrl ? (
                    <Button
                      component="a"
                      href={club.venue.directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      variant="outlined"
                      startIcon={<DirectionsIcon />}
                      sx={{ flexShrink: 0, color: tokens.ink, borderColor: tokens.rule,
                            "&:hover": { borderColor: faction.base, color: faction.deep } }}
                    >
                      Get directions
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            </Section>
          ) : null}

          {club.upcomingEvents.length ? (
            <Section title="Upcoming events" icon={EventIcon}
              action={
                club.pastEvents.length ? (
                  <NextLink href={`/clubs/${club.slug}/events`} style={{ textDecoration: "none" }}>
                    <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                      All events
                    </Typography>
                  </NextLink>
                ) : undefined
              }>
              <ClubEventList events={club.upcomingEvents} clubSlug={club.slug} />
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

          {/* Always shown now, not only when reviews exist — the section is
              also the way in to writing the first one. */}
          <Section
            title="Reviews"
            icon={StarIcon}
            action={
              club.reviewSummary ? (
                <StarRating
                  value={club.reviewSummary.average}
                  caption={`${club.reviewSummary.average.toFixed(1)} from ${club.reviewSummary.count}`}
                />
              ) : undefined
            }
          >
            <ClubReviews
              clubId={club.id}
              slug={club.slug}
              faction={faction}
              reviews={club.reviews}
              viewerId={viewer?.id ?? null}
              canManageClub={canManage}
              isAdmin={viewer?.role === "admin"}
              signedIn={Boolean(viewer)}
            />
          </Section>

          {club.pastEvents.length ? (
            <Section title="Past events" icon={EventIcon}
              action={
                club.pastEvents.length > 3 ? (
                  <NextLink href={`/clubs/${club.slug}/events`} style={{ textDecoration: "none" }}>
                    <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                      See all {club.pastEvents.length}
                    </Typography>
                  </NextLink>
                ) : undefined
              }>
              <ClubEventList events={club.pastEvents.slice(0, 3)} clubSlug={club.slug} />
            </Section>
          ) : null}
        </Stack>

        <Stack spacing={3} sx={{ mt: 7 }}>
          <JoinClubPanel
            clubId={club.id}
            slug={club.slug}
            clubName={club.name}
            membership={membership}
            hasLoyalty={Boolean(programme)}
            hasShop={shopItems.length > 0}
            hasCoaching={coachingOn}
            signedIn={Boolean(viewer)}
            faction={faction}
            memberCount={roster ? roster.length : null}
            pendingCount={pending ? pending.length : null}
            tiers={club.membershipTiers}
            canManage={canManage}
            takesBookings={(club.tablesAvailable ?? 0) > 0}
            standing={standing(myPayments, membership.tierKey, membership.tierAssignedAt)}
            payments={myPayments}
          />
          <ClubSidebar club={club} />
        </Stack>
      </Box>
    </Container>
  );
}
