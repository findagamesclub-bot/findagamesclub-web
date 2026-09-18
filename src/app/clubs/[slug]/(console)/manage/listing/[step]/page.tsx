import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import ListingSteps from "@/components/listing/ListingSteps";
import ProfileStep from "@/components/listing/ProfileStep";
import ContentStep from "@/components/listing/ContentStep";
import ScheduleStep from "@/components/listing/ScheduleStep";
import ReviewStep from "@/components/listing/ReviewStep";
import PricingStep from "@/components/listing/PricingStep";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { readiness } from "@/services/listing.service";
import {
  findEditableContent, findEditablePricing, findEditableSchedule, findPricingReadiness,
} from "@/repositories/listingSections.repository";
import { parseTokens } from "@/utils/listing-draft";
import { LISTING_STEPS } from "@/utils/listing-steps";
import type { StepTarget } from "@/components/listing/StepTarget";
import { readinessSummary, readinessFraction } from "@/utils/listing-readiness";

/**
 * The listing editor, one step per URL.
 *
 * Legacy's five steps and its own labels. A step per address rather than a
 * wizard held in memory, so a club secretary who stops after two steps on a
 * club night can come back to the one they were on.
 */
// Shared with the public builder, so the two cannot disagree about what step
// three is called.
const STEPS = LISTING_STEPS;

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/manage/listing/[step]">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Listing · ${club.name}` : "Club not found" };
}

export default async function ListingStepPage({
  params,
}: PageProps<"/clubs/[slug]/manage/listing/[step]">) {
  const { slug, step } = await params;
  if (!STEPS.some((s) => s.slug === step)) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/listing/${step}`);

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("listing.edit")) notFound();

  // Ids and storage paths, which the public shape has no use for.
  const editable = step === "content" ? await findEditableContent(club.id) : null;
  const timetable = step === "schedule" ? await findEditableSchedule(club.id) : null;
  const pricing = step === "pricing" ? await findEditablePricing(club.id) : null;
  // Read on every step: the stepper counts the same eight checks wherever you
  // are standing.
  const money = await findPricingReadiness(club.id);

  // Computed from what is saved, never from the form. Legacy reads its own DOM,
  // which is why its checklist is wrong the moment you reload.
  const target: StepTarget = { kind: "club", slug };

  const { checks, status, done } = readiness({
    name: club.name, city: club.city, summary: club.summary,
    description: club.description, formats: club.formats,
    venueName: club.venue.name, postcode: club.venue.postcode,
    venueAddress: club.venue.address, website: club.contact.website,
    contactEmail: club.contact.email,
    ages: club.ages, memberCount: club.memberCount,
    tablesAvailable: club.tablesAvailable,
    featuredGames: club.games, facilities: club.facilities,
    paymentMethods: club.paymentMethods,
    basicMembershipPriced: money.basicMembershipPriced,
    loyaltyReady: money.loyaltyReady,
    sessions: club.schedule.map((s) => ({ day: s.day, time: s.time, label: s.label })),
  });

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <PageHead
        title="Your listing"
        lede="What people see in the directory and on your club page. Saving publishes it."
      />

      <ListingSteps
        steps={STEPS.map((s) => ({
          ...s,
          status: status[STEPS.findIndex((x) => x.slug === s.slug) + 1] ?? "",
          done: done[STEPS.findIndex((x) => x.slug === s.slug) + 1] ?? false,
        }))}
        current={step}
        base={`/clubs/${slug}/manage/listing`}
        summary={readinessSummary(checks)}
        fraction={readinessFraction(checks)}
      />

      {step === "profile" ? (
        <ProfileStep
          target={target}
          values={{
            name: club.name,
            city: club.city,
            neighbourhood: club.neighbourhood ?? "",
            summary: club.summary ?? "",
            description: club.description ?? "",
            formats: club.formats,
            venueName: club.venue.name ?? "",
            venueAddress: club.venue.address ?? "",
            postcode: club.venue.postcode ?? "",
            website: club.contact.website ?? "",
            contactEmail: club.contact.email ?? "",
            ages: parseTokens(club.ages),
            memberCount: club.memberCount === null ? "" : String(club.memberCount),
            tablesAvailable: club.tablesAvailable === null ? "" : String(club.tablesAvailable),
          }}
        />
      ) : null}

      {step === "content" ? (
        <ContentStep
          target={target}
          clubId={club.id}
          values={{
            games: club.games,
            facilities: club.facilities,
            paymentMethods: club.paymentMethods,
            socialLinks: club.socialLinks,
            categories: editable?.categories ?? [],
            photos: (editable?.images ?? []).map((image) => ({
              key: `saved-${image.id}`,
              preview: "",
              path: image.storagePath,
              src: image.src,
              alt: image.alt,
            })),
          }}
        />
      ) : null}

      {step === "schedule" && timetable ? (
        <ScheduleStep target={target} nights={timetable.nights} notices={timetable.notices} />
      ) : null}

      {step === "pricing" && pricing ? (
        <PricingStep target={target} models={pricing.models} tiers={pricing.tiers}
          loyaltyEnabled={pricing.loyaltyEnabled} />
      ) : null}

      {step === "review" ? (
        <ReviewStep checks={checks} base={`/clubs/${slug}/manage/listing`} clubSlug={slug}
          paused={club.status === "paused"}
          // Owner or admin only. A manager edits the listing; taking the club
          // out of the directory is not the same kind of act, and the database
          // refuses them anyway.
          canPause={access.role === "owner" || access.role === "admin"} />
      ) : null}
    </Container>
  );
}
