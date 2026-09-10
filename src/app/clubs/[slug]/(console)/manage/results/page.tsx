import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import DonutChart from "@/components/ui/DonutChart";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmptyState from "@/components/ui/EmptyState";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import ResultMatcher from "@/components/clubs/ResultMatcher";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getRoster } from "@/services/memberships.service";
import { getMatchedNames, getUnlinkedNames, groupUnlinked }
  from "@/services/memberRecords.service";
import MatchedList from "@/components/clubs/MatchedList";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget } from "@/utils/back-link";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/manage/results">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Match results · ${club.name}` : "Club not found" };
}

/**
 * Say who the names in this club's results belong to.
 *
 * Owner only. Everything imported from the old site carries a player's name
 * and no account, which is why league records, podium finishes and badges do
 * not appear on anybody's profile. One pass down this list fixes all three.
 */
export default async function ClubResultsPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/results">) {
  const { slug } = await params;
  const query = await searchParams;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/results`);

  const access = await getClubAccess(club.id, viewer);
  // Matching a name to an account writes to that person's public record,
  // which the link function has always reserved for a manager.
  if (!access.can("members.manage")) redirect(`/clubs/${slug}/manage`);

  const { faction } = clubIdentity(club.slug, club.name);
  const back = backTarget(query.from, club);

  const [rows, matched, roster] = await Promise.all([
    getUnlinkedNames(club.id),
    getMatchedNames(club.id).catch(() => []),
    getRoster(club.id).catch(() => []),
  ]);

  const members = roster.map((member) => ({ id: member.profileId, name: member.fullName }));
  const byId = new Map(members.map((member) => [member.id, member.name]));
  const done = matched.map((row) => ({
    ...row,
    memberName: byId.get(row.memberId) ?? "A member",
  }));
  const people = groupUnlinked(rows);

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader
        title="Match results to members"
        clubName={club.name}
        clubSlug={club.slug}
        back={back}
        faction={faction}
        note={rows.length
          ? "These came across from your old site with a player's name but no account. Say who each one is and their league record, podium finishes and badges appear on their profile."
          : null}
        stats={[
          { label: rows.length === 1 ? "result" : "results",
            value: String(rows.length), emphasis: true },
          { label: people.length === 1 ? "name" : "names", value: String(people.length) },
          { label: "members", value: String(members.length) },
        ]}
      />

      {/* A job that finishes, unlike everything else in the console, so the
          picture is how much of it is left rather than a month by month run. */}
      {rows.length || done.length ? (
        <Box sx={{ mb: 3, p: 2, border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                   backgroundColor: tokens.paper, maxWidth: 340 }}>
          <DonutChart
            centreValue={`${Math.round((done.length / Math.max(1, done.length + rows.length)) * 100)}%`}
            centreLabel="matched"
            slices={[
              { key: "done", label: "Matched to a member", value: done.length,
                color: tokens.positive },
              { key: "left", label: "Still a name only", value: rows.length,
                color: tokens.brass },
            ]}
          />
        </Box>
      ) : null}

      {rows.length ? (
        <Stack spacing={2}>
          <ResultMatcher people={people} roster={members} slug={club.slug} faction={faction} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Not everyone will be a member. Guests and visitors have no account
            to match, so leave those rows alone. They stay on this list, which
            is why the count above will not always reach zero.
          </Typography>
        </Stack>
      ) : (
        <EmptyState
          title="Nothing left to match"
          description="Every name in this club's results either belongs to a member or belongs to a guest."
          action={{ label: "Back to the club", href: `/clubs/${club.slug}` }}
        />
      )}

      {done.length ? (
        <MatchedList rows={done} slug={club.slug} />
      ) : null}
    </Container>
  );
}
