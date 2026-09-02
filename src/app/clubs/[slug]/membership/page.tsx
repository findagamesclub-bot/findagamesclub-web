import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import TierComparison from "@/components/clubs/TierComparison";
import EmptyState from "@/components/ui/EmptyState";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership } from "@/services/memberships.service";
import { buildTierComparison } from "@/utils/tier-comparison";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget } from "@/utils/back-link";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/membership">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Membership · ${club.name}` : "Club not found" };
}

export default async function MembershipComparisonPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/membership">) {
  const { slug } = await params;
  const query = await searchParams;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const { faction } = clubIdentity(club.slug, club.name);
  const back = backTarget(query.from, club);
  const viewer = await getCurrentProfile();
  const membership = viewer
    ? await getMyMembership(club.id, viewer.id)
    : { id: null, status: "none" as const, tierKey: null, tierAssignedAt: null };

  const rows = buildTierComparison(club.membershipTiers);
  // Priced, not "not the default tier". A club whose entry tier costs £10 has
  // two paid tiers, and this counted one of them.
  const paid = club.membershipTiers.filter((t) => !t.isFree).length;

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader back={back}
        title="Membership"
        clubName={club.name}
        clubSlug={club.slug}
        faction={faction}
        stats={[
          { label: club.membershipTiers.length === 1 ? "tier" : "tiers",
            value: String(club.membershipTiers.length) },
          // Only when it says something the tier count does not. A club whose
          // tiers are all paid read "2 TIERS · 2 PAID TIERS", which is the same
          // fact twice.
          ...(paid && paid !== club.membershipTiers.length
            ? [{ label: paid === 1 ? "paid tier" : "paid tiers", value: String(paid) }]
            : []),
          { label: "privileges compared", value: String(rows.length) },
        ]}
        note="Every privilege each tier includes, side by side. Nothing is hidden behind a count."
      />

      {rows.length ? (
        <TierComparison
          tiers={club.membershipTiers}
          rows={rows}
          faction={faction}
          yourTierKey={membership.status === "approved" ? membership.tierKey : null}
        />
      ) : (
        <EmptyState
          title={`${club.name} has not set up membership tiers`}
          description="When the club adds tiers, what each one includes will be compared here."
          action={{ label: `Back to ${club.name}`, href: `/clubs/${club.slug}` }}
        />
      )}
    </Container>
  );
}
