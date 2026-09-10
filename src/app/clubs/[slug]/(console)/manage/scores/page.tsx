import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import ClubResults from "@/components/bookings/ClubResults";
import SectionPulse from "@/components/console/SectionPulse";
import EmptyState from "@/components/ui/EmptyState";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubResults } from "@/services/clubResults.service";
import { londonToday } from "@/services/bookingCalendar.service";
import { countByMonth } from "@/utils/club-pulse";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget } from "@/utils/back-link";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({
  params,
}: PageProps<"/clubs/[slug]/manage/scores">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Scores · ${club.name}` : "Club not found" };
}

/**
 * Every game played at the club, and what the club has said about it.
 *
 * Its own page rather than a section of the bookings calendar. The rail
 * carries a count of games needing a ruling, and an entry with a count has to
 * lead somewhere of its own: pointing it at an anchor inside the bookings page
 * meant two entries sharing one path, so clicking Scores lit Table bookings.
 *
 * The calendar is about nights that have not happened. This is about ones that
 * have, which is a different job on a different day.
 */
export default async function ClubScoresPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/scores">) {
  const { slug } = await params;
  const query = await searchParams;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const viewer = await getCurrentProfile();
  const access = await getClubAccess(club.id, viewer);
  if (!access.can("results.manage")) redirect(`/clubs/${slug}/manage`);

  const { faction } = clubIdentity(club.slug, club.name);
  const played = await getClubResults(club.id).catch(() => []);

  const waiting = played.filter(
    (r) => r.recorded && r.confirmation !== "admin-confirmed").length;
  const unscored = played.filter((r) => !r.recorded).length;

  // Worked out from the results already loaded, so the chart costs no query.
  const on = (rows: typeof played) => countByMonth(rows.map((r) => r.date), londonToday());
  const ruledMonths = on(played.filter((r) => r.confirmation === "admin-confirmed"));
  const waitingMonths = on(played.filter(
    (r) => r.recorded && r.confirmation !== "admin-confirmed"));
  const unscoredMonths = on(played.filter((r) => !r.recorded));

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader
        back={backTarget(query.from, club)}
        title="Scores"
        clubName={club.name}
        clubSlug={club.slug}
        faction={faction}
        note={waiting || unscored
          ? "A result counts once the club has confirmed it. Until then it stays here."
          : null}
        stats={[
          { label: played.length === 1 ? "game played" : "games played",
            value: String(played.length) },
          ...(waiting
            ? [{ label: "waiting on you", value: String(waiting), emphasis: true }]
            : []),
          ...(unscored ? [{ label: "no score yet", value: String(unscored) }] : []),
        ]}
      />

      {played.length ? (
        <>
          <ClubResults results={played} slug={club.slug} faction={faction} />

          {/* Ruled against waiting, month by month. A club that has let the
              queue build since spring cannot see that from a count of what is
              open today. */}
          <SectionPulse
            label="Games and rulings"
            labels={ruledMonths.map((m) => m.label)}
            series={[
              { name: "Ruled", color: tokens.positive,
                values: ruledMonths.map((m) => m.value) },
              { name: "Waiting on the club", color: tokens.brass,
                values: waitingMonths.map((m) => m.value) },
              { name: "No score yet", color: tokens.rule,
                values: unscoredMonths.map((m) => m.value) },
            ]}
          />
        </>
      ) : (
        <EmptyState
          title="Nothing played yet"
          description="Once a table booking passes, the game appears here for a score and a ruling."
          action={{ label: "See the nights", href: `/clubs/${club.slug}/bookings` }}
        />
      )}
    </Container>
  );
}
