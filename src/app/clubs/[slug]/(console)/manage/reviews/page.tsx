import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHead from "@/components/ui/PageHead";
import NavTabs from "@/components/ui/NavTabs";
import Pager from "@/components/ui/Pager";
import StarRating from "@/components/ui/StarRating";
import ConsoleReviews from "@/components/reviews/ConsoleReviews";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getClubReviews } from "@/services/reviews.service";
import { getReported } from "@/services/myReports.service";
import type { ReviewView } from "@/repositories/reviews.repository";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Reviews" };

const PER_PAGE = 20;

/**
 * What members have said, for the club.
 *
 * There was nowhere in the console to read your own reviews at all: they lived
 * on the public page among everything else, so an owner checking them had to
 * scroll their own listing past the events and the leagues. The client asked
 * for this and for a way to mark one as inappropriate.
 *
 * Reporting is that way, and it is the same `flag_content` the public page
 * offers. A club cannot take a review down, which is deliberate (0128) and
 * said on the page rather than left to be discovered.
 *
 * `listing.edit`, so an owner and a manager both get it: this is the club's
 * public face, which is exactly what that capability covers.
 */
export default async function ClubReviewsPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/reviews">) {
  const { slug } = await params;
  const query = await searchParams;

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/reviews`);

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("listing.edit")) notFound();

  const asked = Array.isArray(query.view) ? query.view[0] : query.view;
  const view: ReviewView =
    asked === "low" ? "low" : asked === "reported" ? "reported" : "all";
  const page = Number(query.page) || 1;

  const [{ reviews, total, counts }, reportedKeys] = await Promise.all([
    getClubReviews(club.id, { view, page, oldest: false, perPage: PER_PAGE }),
    getReported(viewer.id),
  ]);

  const at = (name: ReviewView) =>
    name === "all" ? `/clubs/${slug}/manage/reviews`
      : `/clubs/${slug}/manage/reviews?view=${name}`;

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <PageHead
        title="Reviews"
        lede="What members have said about your club, newest first."
      />

      {club.reviewSummary ? (
        <Stack direction="row" spacing={1.5}
          sx={{ alignItems: "center", mb: 2.5, flexWrap: "wrap" }} useFlexGap>
          <StarRating value={club.reviewSummary.average} size="medium"
            caption={club.reviewSummary.average.toFixed(1)} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {club.reviewSummary.count === 1
              ? "from 1 review" : `from ${club.reviewSummary.count} reviews`}
          </Typography>
        </Stack>
      ) : null}

      {/* Said here rather than only in a help page, because this is the screen
          where somebody goes looking for a delete button. */}
      <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 2.5 }}>
        You cannot take a review down, and neither can we on your say-so. If one
        breaks the rules, report it and a site admin reads it and decides. That
        keeps a bad review and an against-the-rules review two different things.
      </Typography>

      <Box sx={{ mb: 3 }}>
        <NavTabs
          ariaLabel="Reviews"
          value={view}
          tabs={[
            { value: "all", label: "All", href: at("all"), count: counts.all },
            { value: "low", label: "Two stars or fewer", href: at("low"),
              count: counts.low },
            { value: "reported", label: "Reported", href: at("reported"),
              count: counts.reported },
          ]}
        />
      </Box>

      <Stack spacing={2.5}>
        <ConsoleReviews reviews={reviews} reportedKeys={reportedKeys}
          membersBase="/members" />

        <Pager page={page} total={total} noun="reviews" size={PER_PAGE}
          href={{
            path: `/clubs/${slug}/manage/reviews`,
            params: { view: view === "all" ? undefined : view },
          }} />
      </Stack>
    </Container>
  );
}
