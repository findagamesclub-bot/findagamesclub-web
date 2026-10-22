import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import ClubResults from "@/components/bookings/ClubResults";
import SectionPulse from "@/components/console/SectionPulse";
import EmptyState from "@/components/ui/EmptyState";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getPlayedLog } from "@/services/clubResults.service";
import { isPlayedSort, isPlayedTab, owedAnswer } from "@/utils/played-log";
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
 *
 * Filtered in SQL. It read the newest forty games and sifted them in the
 * browser, which is why the client's month filter had to arrive with a new
 * read underneath it: a month filter over a window of forty answers about the
 * forty, and a club a few seasons in has a thousand games a year.
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

  const one = (key: string) => {
    const value = query[key];
    return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
  };

  // Bound before the guard rather than called twice: a type guard narrows the
  // value it was handed, not the next call that happens to return the same
  // string.
  const asked = one("state");
  const order = one("sort");
  const tab = isPlayedTab(asked) ? asked : "all";
  const sort = isPlayedSort(order) ? order : "newest";
  const search = one("q");
  const page = Number(one("page")) || 1;

  const month = one("month");
  const game = one("game");
  const member = one("member");

  const view = await getPlayedLog(club.id, {
    tab, sort, query: search, page, month, game, member,
  });

  const { faction } = clubIdentity(club.slug, club.name);
  const counts = view.counts;
  // One fact at two levels of detail. The header adds the two groups the club
  // owes an answer on; the tabs underneath split them. Counting them twice in
  // two places is how a header and its own tabs end up disagreeing.
  const waiting = counts ? owedAnswer(counts) : 0;

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader
        back={backTarget(query.from, club)}
        title="Scores"
        clubName={club.name}
        clubSlug={club.slug}
        faction={faction}
        note={waiting || counts?.unscored
          ? "A result counts once the club has confirmed it. Until then it stays here."
          : null}
        stats={[
          { label: counts?.all === 1 ? "game played" : "games played",
            value: String(counts?.all ?? 0) },
          ...(waiting
            ? [{ label: "waiting on you", value: String(waiting), emphasis: true }]
            : []),
          ...(counts?.unscored
            ? [{ label: "no score yet", value: String(counts.unscored) }] : []),
        ]}
      />

      {counts?.all || view.failed ? (
        <>
          <ClubResults view={view} slug={club.slug} faction={faction}
            filters={{ tab, sort, query: search, month, game, member, page }} />

          {/* Ruled against waiting, month by month, counted across every month
              the club has played in rather than across the page in front of
              you: a chart that moved every time somebody changed a filter
              would be answering a different question each time. */}
          {view.months.length ? (
            <SectionPulse
              label="Games and rulings"
              labels={view.months.map((m) => m.label)}
              series={[
                { name: "Ruled", color: tokens.positive,
                  values: view.months.map((m) => m.ruled) },
                { name: "Waiting on the club", color: tokens.brass,
                  values: view.months.map((m) => m.waiting) },
                { name: "No score yet", color: tokens.rule,
                  values: view.months.map((m) => m.unscored) },
              ]}
            />
          ) : null}
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
