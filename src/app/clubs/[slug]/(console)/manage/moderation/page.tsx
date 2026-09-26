import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import ModerationQueue from "@/components/moderation/ModerationQueue";
import { clubModerationAction } from "./actions";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getClubQueue, readFilters } from "@/services/moderation.service";

export const metadata = { title: "Reported" };

/**
 * Reports on this club, answered by the people who run it.
 *
 * 0122 sent every report to a site admin, which is backwards for community
 * content and is not how anywhere else works: on Facebook Groups, Reddit and
 * Discord a report inside a community goes to that community's moderators and
 * the platform only steps in for site-wide rules or an appeal. The club is
 * closest to the context and the fastest to act.
 *
 * Two things never arrive here, because nobody rules on themselves: a review,
 * which is somebody's opinion of the club, and anything the club's own team
 * wrote. Both stay with the admin, and the database decides that, not this
 * page.
 *
 * `board.moderate`, which admits a helper. Taking a post down from the board is
 * already theirs; this is the same job with a reason attached.
 */
export default async function ClubModerationPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/moderation">) {
  const { slug } = await params;
  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/moderation`);

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("board.moderate")) notFound();

  const filters = readFilters(await searchParams);
  const queue = await getClubQueue(club.id, filters);

  return (
    // The console layout deliberately carries no Container and no `main`, so
    // every page under it brings its own, sized to what it holds.
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <PageHead
        title="Reported"
        lede="Things members have reported at your club. Read it in context, then leave it up or take it down. Taking something down keeps the thread together, and the person who wrote it is never told who reported them."
      />

      <ModerationQueue
        rows={queue.rows}
        tabs={queue.tabs}
        tab={filters.tab}
        type={filters.type}
        query={filters.query}
        total={queue.total}
        page={queue.page}
        perPage={queue.perPage}
        failed={queue.failed}
        action={clubModerationAction}
        basePath={`/clubs/${slug}/manage/moderation`}
        scope="club"
        extraFields={{ slug }}
      />
    </Container>
  );
}
