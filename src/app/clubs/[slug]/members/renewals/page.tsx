import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import RenewalBrowser from "@/components/members/RenewalBrowser";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubRenewals } from "@/services/renewals.service";
import { countRenewals } from "@/utils/renewal-filter";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget } from "@/utils/back-link";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/members/renewals">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Memberships · ${club.name}` : "Club not found" };
}

/**
 * Who owes the club money, and who is about to.
 *
 * Members-only pages answer "where do I stand". This is the other side of it
 * and only the club sees it: legacy keeps it as its own Renewals section rather
 * than mixed into the roster, because chasing money and browsing a roster are
 * different jobs done at different times.
 */
export default async function ClubRenewalsPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/members/renewals">) {
  const { slug } = await params;
  const query = await searchParams;

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/members/renewals`);

  // Money is the club's business and nobody else's, so this is not a members
  // page with extra columns: a member reaching it gets nothing at all.
  const canManage = club.ownerId === viewer.id || viewer.role === "admin";
  if (!canManage) notFound();

  const { faction } = clubIdentity(club.slug, club.name);
  const rows = await getClubRenewals(club.id, club.membershipTiers);
  const counts = countRenewals(rows);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader
        back={backTarget(query.from, club)}
        title="Memberships"
        clubName={club.name}
        clubSlug={club.slug}
        faction={faction}
        stats={[
          { label: counts.all === 1 ? "member" : "members", value: String(counts.all) },
          ...(counts.due
            ? [{ label: "owing", value: String(counts.due), emphasis: true }]
            : []),
        ]}
      />

      <RenewalBrowser rows={rows} slug={club.slug}
        tiers={club.membershipTiers} faction={faction} />
    </Container>
  );
}
