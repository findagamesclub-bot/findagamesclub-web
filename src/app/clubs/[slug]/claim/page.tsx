import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import BackLink from "@/components/ui/BackLink";
import ClaimForm from "@/components/clubs/ClaimForm";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getMyClaim } from "@/services/claims.service";

export const metadata = { title: "Claim your club" };

/**
 * Somebody saying this listing is theirs.
 *
 * The directory was imported, so most of these pages are about real clubs that
 * none of those clubs can touch. This is the way in, and it only exists where
 * an admin has opened the listing to it: a club with an owner is somebody's,
 * and a change of hands there is a transfer, not a claim.
 */
export default async function ClaimClubPage({
  params,
}: PageProps<"/clubs/[slug]/claim">) {
  const { slug } = await params;

  const club = await getClubDetail(slug);
  if (!club) notFound();

  // Not open to claims is a 404 rather than a message: there is nothing to say
  // to somebody who has typed a URL for a door that is not there.
  if (!club.claimable) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/claim`);

  const mine = await getMyClaim(club.id);

  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <BackLink href={`/clubs/${slug}`} label={`Back to ${club.name}`} />

      <PageHead
        title={`Claim ${club.name}`}
        lede="This listing was put together without the club. Tell us who you are and we will hand it over, and from then on everything on the page is yours to change."
      />

      <ClaimForm
        slug={slug}
        clubName={club.name}
        existing={mine ? { id: mine.id, status: mine.status, note: mine.decision_note } : null}
      />
    </Container>
  );
}
