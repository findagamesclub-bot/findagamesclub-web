import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import Box from "@mui/material/Box";
import RenewalBrowser from "@/components/members/RenewalBrowser";
import SplitBar from "@/components/ui/SplitBar";
import MonoLabel from "@/components/ui/MonoLabel";
import { tokens } from "@/lib/tokens";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
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
  const access = await getClubAccess(club.id, viewer);
  const canManage = access.can("members.manage");
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

      {/* Where the roster stands on payment, before the list of who. A count
          of "12 owing" means one thing in a club of 15 and another in a club
          of 300, and the header cannot show which. */}
      {counts.all ? (
        <Box sx={{ mb: 3, p: 2, border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                   backgroundColor: tokens.paper }}>
          <MonoLabel>How the roster stands</MonoLabel>
          <SplitBar parts={[
            { key: "paid", label: "Paid up", value: counts.paid, color: tokens.positive },
            { key: "expiring", label: "Expiring", value: counts.expiring, color: tokens.brass },
            { key: "due", label: "Due", value: counts.due, color: "#A8542A" },
            { key: "overdue", label: "Overdue", value: counts.overdue, color: tokens.danger },
          ]} />
        </Box>
      ) : null}

      <RenewalBrowser rows={rows} slug={club.slug}
        tiers={club.membershipTiers} faction={faction} />
    </Container>
  );
}
