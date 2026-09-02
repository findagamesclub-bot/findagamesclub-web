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
import BoardCategories from "@/components/clubs/BoardCategories";
import ClubNights from "@/components/clubs/ClubNights";
import LookingForGameSummary from "@/components/clubs/LookingForGameSummary";
import ClubActivity from "@/components/clubs/ClubActivity";
import ClubNoticeboard from "@/components/clubs/ClubNoticeboard";
import ClubCompetitions from "@/components/clubs/ClubCompetitions";
import { getClubEventsPage } from "@/services/events.service";
import { getReviewCount } from "@/services/reviews.service";
import { getCompetitionOverview } from "@/services/competitions.service";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import PushPinIcon from "@mui/icons-material/PushPin";
import { getRecentActivity } from "@/services/clubActivity.service";
import { getClubRivalries } from "@/services/games.service";
import { getUnlinkedNames } from "@/services/memberRecords.service";
import TimelineIcon from "@mui/icons-material/Timeline";
import { getOpenPosts } from "@/services/lookingForGames.service";
import { londonToday } from "@/services/bookingCalendar.service";
import { addDays } from "@/utils/booking-sessions";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import { categoryOptions, tierRank } from "@/utils/discussion-categories";
import { MembershipTiers, PricingList } from "@/components/clubs/ClubTiers";
import MembershipPerks from "@/components/members/MembershipPerks";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import Section from "@/components/ui/Section";
import SectionNav from "@/components/ui/SectionNav";
import BackToTop from "@/components/ui/BackToTop";
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
import { getJoinedCount, getMyMembership, getPendingRequests, getRoster } from "@/services/memberships.service";
import { getPayments, standing } from "@/services/payments.service";
import JoinClubPanel from "@/components/members/JoinClubPanel";
import ClubReviews from "@/components/reviews/ClubReviews";
import { getProgramme, getStandings } from "@/services/loyalty.service";
import ClubStandings from "@/components/loyalty/ClubStandings";
import LockIcon from "@mui/icons-material/Lock";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
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
  const [programme, shopItems, coachingOn, joinedCount, upcoming, past, reviewTotal] =
    await Promise.all([
    getProgramme(club.id),
    getShop({
      clubId: club.id, tiers: club.membershipTiers, canManageClub: canManage,
      signedIn: Boolean(viewer), isApprovedMember: false, viewerTierKey: null,
    }),
    isCoachingOn(club.id),
    getJoinedCount(club.id),
    getClubEventsPage(club.id, { past: false, page: 1 }),
    // Three on the club page, and the true total for the link, which a slice
    // of a capped list could not have told us.
    getClubEventsPage(club.id, { past: true, page: 1, size: 3 }),
    getReviewCount(club.id),
  ]);

  const membership = viewer
    ? await getMyMembership(club.id, viewer.id)
    : { id: null, status: "none" as const, tierKey: null, tierAssignedAt: null };

  // The roster is members-only by policy, so a non-member would silently read
  // zero rows. Asking at all would render "0 members" on a club with eighty.
  const isMember = canManage || membership.status === "approved";

  // The viewer's own tier. A member with no tier key sits on the basic one,
  // which is what the club charges nothing for.
  // Same gating the board itself applies, so a locked category looks the same
  // in both places rather than appearing open here and refusing there.
  const boardCategories = club.discussionCategories.length
    ? categoryOptions({
        categories: club.discussionCategories,
        tiers: club.membershipTiers.map((t) => ({ label: t.label, reserved: t.reservedCategories })),
        viewerRank: tierRank(club.membershipTiers, membership.tierKey),
        canManageClub: canManage,
      })
    : [];

  const myTier = membership.status === "approved"
    ? club.membershipTiers.find((t) => t.key === membership.tierKey)
      ?? club.membershipTiers.find((t) => t.isBasic)
      ?? null
    : null;
  const canSeeRoster = isMember;
  const [roster, pending, myPayments, standings, openPosts, activity, rivalries,
         unmatched, competitions] = await Promise.all([
    canSeeRoster ? getRoster(club.id) : Promise.resolve(null),
    canManage ? getPendingRequests(club.id) : Promise.resolve(null),
    // A member can read their own payments by policy, so they can be told
    // where they stand instead of having to ask the club.
    membership.id ? getPayments(membership.id) : Promise.resolve([]),
    // Wallet rows are members-only by policy, so this is skipped rather than
    // fetched-and-hidden. Legacy gates the same table the same way
    // (detail.js:2142).
    programme && isMember ? getStandings(club.id) : Promise.resolve([]),
    // Posts are members-only by policy, so this is skipped rather than
    // fetched-and-hidden. Sixty days is the same window the booking calendar
    // uses, so the two never disagree about what is "upcoming".
    isMember
      ? getOpenPosts(club.id, londonToday(), addDays(londonToday(), 60), viewer?.id ?? null)
      : Promise.resolve(new Map<string, never[]>()),
    // Every source is members-only by policy, so this is skipped rather than
    // fetched-and-hidden. Legacy gates its feed the same way (detail.js:4194).
    isMember ? getRecentActivity(club.id, club.slug) : Promise.resolve([]),
    // Only to know whether the tile is worth showing; the page itself does the
    // real read. Members only, so a visitor never pays for it.
    isMember ? getClubRivalries(club.id).catch(() => []) : Promise.resolve([]),
    // Owner only: it drives a button nobody else sees.
    canManage ? getUnlinkedNames(club.id).catch(() => []) : Promise.resolve([]),
    // Public, like the rest of the page. Caught rather than thrown: a club page
    // should not go down because one section's tables are not there yet.
    getCompetitionOverview(club.id)
      .catch(() => ({ featured: [], activeCount: 0, completedCount: 0 })),
  ]);

  // Flattened out of the per-night map and cut to the soonest few: the club
  // page is answering "is anyone about", not listing every night.
  const lookingForGame = [...(openPosts.values() as Iterable<{ date: string }[]>)]
    .flat()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  // Legacy's fallback: clubs.announcement is the newest notice copied onto the
  // club row, so it only stands in when the noticeboard table is empty
  // (detail.js:4332).
  const notices = club.announcements.length
    ? club.announcements
    : club.announcement
      ? [{ message: club.announcement, createdAt: "" }]
      : [];

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubHeader club={club} canBook={isMember && (club.tablesAvailable ?? 0) > 0}
        joinedCount={joinedCount} />

      {/* Fifteen sections is a long page, and a reader after the pricing had to
          scroll past the photos, the map and the activity feed to reach it. */}
      <SectionNav />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,2fr) minmax(280px,1fr)" }, gap: 4, mt: 4 }}>
        <Stack spacing={0}>
          {/* First thing in the column, because a notice is time-sensitive and
              the club wrote it to be read before anything else. */}
          {notices.length ? (
            <Section title="Noticeboard" icon={PushPinIcon}
              note={`What ${club.name} wants members to know right now.`}>
              <ClubNoticeboard notices={notices} />
            </Section>
          ) : null}

          {club.description ? (
            <Section title="About" icon={InfoIcon}>
              <Typography variant="body1" sx={{ whiteSpace: "pre-line" }}>{club.description}</Typography>
            </Section>
          ) : null}

          {/* Legacy gives this a section and a primary button
              (detail.js:927). Ours had a four-character "Book" link inside a
              stat, on a page three thousand pixels long. */}
          <Section navLabel="Book" title="Club nights and table booking" icon={EventSeatIcon}>
            <ClubNights
              schedule={club.schedule}
              tablesAvailable={club.tablesAvailable}
              slug={club.slug}
              clubName={club.name}
              faction={faction}
              canBook={isMember && (club.tablesAvailable ?? 0) > 0}
              signedIn={Boolean(viewer)}
              isMember={isMember}
            />

            <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${tokens.rule}` }}>
              <LookingForGameSummary
                posts={lookingForGame as never[]}
                slug={club.slug}
                clubName={club.name}
                faction={faction}
                isMember={isMember}
              />
            </Box>
          </Section>

          {club.games.length ? (
            <Section navLabel="Games" title="Featured games" icon={CasinoIcon}>
              <GameChips games={club.games} faction={faction} max={club.games.length} />
            </Section>
          ) : null}

          {/* Legacy lists these on the club page and links each one into the
              board with its filter already applied (detail.js:1385). */}
          {boardCategories.length ? (
            <Section
              title="Discussion board"
              icon={ForumIcon}
              action={
                <NextLink href={`/clubs/${club.slug}/board`} style={{ textDecoration: "none" }}>
                  <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                    Open the board
                  </Typography>
                </NextLink>
              }
            >
              <Stack spacing={1.5}>
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  What {club.name} talks about. Pick one to open the board filtered to it.
                </Typography>
                <BoardCategories options={boardCategories} slug={club.slug} faction={faction} />
              </Stack>
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
            <Section navLabel="Find us" title="Getting there" icon={PlaceIcon}>
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

          {upcoming.events.length ? (
            <Section navLabel="Events" title="Upcoming events" icon={EventIcon}
              action={
                past.total ? (
                  <NextLink href={`/clubs/${club.slug}/events`} style={{ textDecoration: "none" }}>
                    <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                      All events
                    </Typography>
                  </NextLink>
                ) : undefined
              }>
              <ClubEventList events={upcoming.events} clubSlug={club.slug}
                clubVenue={{ name: club.venue.name, postcode: club.venue.postcode }} />
            </Section>
          ) : null}

          {past.events.length ? (
            <Section navLabel="Past events" title="Past events" icon={EventIcon}
              action={
                past.total > 3 ? (
                  <NextLink href={`/clubs/${club.slug}/events`} style={{ textDecoration: "none" }}>
                    <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                      See all {past.total}
                    </Typography>
                  </NextLink>
                ) : undefined
              }>
              <ClubEventList events={past.events} clubSlug={club.slug}
                clubVenue={{ name: club.venue.name, postcode: club.venue.postcode }} />
            </Section>
          ) : null}

          {/* Legacy gives leagues and campaigns their own block on the club
              page (detail.js:411). It is how a club shows it plays seriously,
              so it sits with the events rather than below the fold. */}
          {competitions.featured.length ? (
            <Section navLabel="Leagues" title="Leagues and campaigns" icon={MilitaryTechIcon}
              note={`How ${club.name} runs its competitive play, and who is winning.`}>
              <ClubCompetitions overview={competitions} slug={club.slug} faction={faction} />
            </Section>
          ) : null}

          {/* The tier you are actually on, not all six. Legacy shows the same
              block only to a member with a tier (detail.js:5317). */}
          {myTier && myTier.benefitGroups.length ? (
            <Section navLabel="Your perks" title="Your membership perks" icon={WorkspacePremiumIcon}>
              <MembershipPerks
                groups={myTier.benefitGroups}
                tierLabel={myTier.label}
                faction={faction}
              />
            </Section>
          ) : null}

          {club.membershipTiers.length ? (
            <Section title="Membership" icon={CardMembershipIcon}
              action={
                club.membershipTiers.length > 1 ? (
                  <NextLink href={`/clubs/${club.slug}/membership`} style={{ textDecoration: "none" }}>
                    <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                      Compare tiers
                    </Typography>
                  </NextLink>
                ) : undefined
              }>
              <MembershipTiers tiers={club.membershipTiers} slug={club.slug} />
            </Section>
          ) : null}

          {/* Legacy's activity feed, in the same place and gated the same way. */}
          <Section navLabel="Activity" title="Recent activity" icon={TimelineIcon}>
            <ClubActivity
              items={activity}
              clubName={club.name}
              faction={faction}
              isMember={isMember}
            />
          </Section>

          {/* Legacy puts this on the club page, not only on the loyalty page
              (detail.js:2111). Shown whenever the club runs a programme, so a
              non-member learns the scheme exists and what joining is worth. */}
          {programme ? (
            <Section
              navLabel="Loyalty"
              title="Loyalty leaderboard"
              icon={CardGiftcardIcon}
              action={
                <NextLink href={`/clubs/${club.slug}/loyalty`} style={{ textDecoration: "none" }}>
                  <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                    View loyalty tiers
                  </Typography>
                </NextLink>
              }
            >
              {isMember ? (
                <ClubStandings
                  standings={standings}
                  tiers={programme.tiers}
                  faction={faction}
                  limit={5}
                  showFigures={false}
                />
              ) : (
                <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                  <LockIcon sx={{ fontSize: 17, color: tokens.inkMuted, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                    Approved members can see the loyalty league table.
                  </Typography>
                </Stack>
              )}
              {isMember && standings.length > 5 ? (
                <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 1.5 }}>
                  Showing the top 5 of {standings.length}.
                </Typography>
              ) : null}
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
              total={reviewTotal}
              viewerId={viewer?.id ?? null}
              canManageClub={canManage}
              isAdmin={viewer?.role === "admin"}
              signedIn={Boolean(viewer)}
            />
          </Section>

        </Stack>

        <Stack spacing={3} sx={{ mt: 7 }} id="join">
          <JoinClubPanel
            clubId={club.id}
            slug={club.slug}
            clubName={club.name}
            membership={membership}
            hasLoyalty={Boolean(programme)}
            hasShop={shopItems.length > 0}
            hasCoaching={coachingOn}
            hasRivalries={rivalries.length > 0}
            hasCompetitions={competitions.featured.length > 0}
            unmatchedResults={unmatched.length}
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
      <BackToTop />
    </Container>
  );
}
