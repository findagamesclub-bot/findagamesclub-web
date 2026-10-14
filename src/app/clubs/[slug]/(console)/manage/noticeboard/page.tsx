import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import PageHead from "@/components/ui/PageHead";
import NoticeboardEditor from "@/components/clubs/NoticeboardEditor";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Noticeboard" };

/**
 * What the club wants members to know this week.
 *
 * It had no screen of its own: it was one panel inside step four of the
 * five-step listing builder, behind `listing.edit`. That put a notice about
 * tonight's car park in the same place as the club's photos and its billing
 * rules, and it meant the person actually on the door could not pin one up.
 *
 * `noticeboard.manage` (0185), which an owner, a manager and a helper all
 * hold. A notice is this week's news rather than the club's public face, and
 * that is the whole reason it is not `listing.edit` any more.
 */
export default async function NoticeboardPage({
  params,
}: PageProps<"/clubs/[slug]/manage/noticeboard">) {
  const { slug } = await params;

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/noticeboard`);

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("noticeboard.manage")) notFound();

  const { faction } = clubIdentity(club.slug, club.name);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <PageHead
        title="Noticeboard"
        lede="Short notices at the top of your club page, newest first."
      />

      {/* Said here rather than discovered: a club that expects a notice to
          live for ever will write one that reads oddly in March. */}
      <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 2.5, maxWidth: 720 }}>
        Every member and every visitor to your club page sees these, and each
        one carries the date it went up. Editing a notice keeps its date, so
        fixing a typo does not push it back to the top.
      </Typography>

      <NoticeboardEditor slug={club.slug} notices={club.announcements} faction={faction} />
    </Container>
  );
}
