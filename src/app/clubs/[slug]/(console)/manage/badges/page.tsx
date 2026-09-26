import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import NavTabs from "@/components/ui/NavTabs";
import BadgeBoard from "@/components/clubs/BadgeBoard";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getAwardsPage, listBadges } from "@/services/badges.service";
import { getRoster } from "@/services/memberships.service";
import {
  badgeStateCounts, badgeTabs, readBadgeFilters, siftBadges,
} from "@/utils/badge-filters";

export const metadata = { title: "Badges" };

/**
 * Badges this club gives out itself.
 *
 * The client asked for two kinds and only one of them is here. "Member for 1
 * year, 2 years" and the competition badges are worked out from the join date
 * and the standings, so they appear on a member's profile without anybody
 * doing anything. This page is the other half: the ones nothing can derive.
 *
 * `members.manage`, so an owner or a manager but not a helper. A badge is the
 * club speaking about somebody; a helper runs a night.
 */
export default async function ClubBadgesPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/badges">) {
  const { slug } = await params;
  const query = await searchParams;
  const asked = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const showing = asked === "awarded" ? "awarded" : "badges";
  const filters = readBadgeFilters(query);

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/badges`);

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("members.manage")) notFound();

  // One wave. The roster is only needed by the award picker, but it is the
  // same round trip whether this page asks for it or the dialog does. The
  // awards are only read on the tab that draws them: a club a few seasons in
  // has thousands, and the definitions tab needs none of them.
  const [badges, awarded, roster] = await Promise.all([
    listBadges(club.id),
    showing === "awarded" ? getAwardsPage(club.id, filters) : null,
    getRoster(club.id).catch(() => []),
  ]);

  const members = roster
    .filter((m) => m.status === "approved")
    .map((m) => ({ id: m.profileId, name: m.fullName }));

  // A handful of rows somebody typed by hand, so the definitions tab is sifted
  // here rather than in SQL. The size of the list is what decides which is
  // right, and a club does not invent a thousand badges.
  const shown = siftBadges(badges, filters);

  // From the badge rows rather than from the awards, so the tab is right on
  // both tabs and stays right when the list underneath is narrowed to one.
  const held = badges.reduce((sum, badge) => sum + badge.awarded, 0);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <PageHead
        title="Badges"
        lede={showing === "awarded"
          ? "Everybody holding one of your badges, and why. Year badges are not here because nobody hands those out."
          : "Things this club gives out: a tournament win, or painting the terrain nobody else will. Members earn their year badges on their own."}
      />

      <Box sx={{ mb: 3 }}>
        <NavTabs
          ariaLabel="Badges"
          value={showing}
          tabs={[
            { value: "badges", label: "Badges",
              href: `/clubs/${slug}/manage/badges`, count: badges.length },
            { value: "awarded", label: "Who has one",
              href: `/clubs/${slug}/manage/badges?tab=awarded`, count: held },
          ]}
        />
      </Box>

      <BadgeBoard
        slug={slug} showing={showing} members={members}
        badges={shown} allBadges={badges} filters={filters}
        badgeTabs={badgeTabs(badgeStateCounts(badges, filters.query))}
        awarded={awarded}
      />
    </Container>
  );
}
