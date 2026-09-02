import Stack from "@mui/material/Stack";
import EmptyState from "@/components/ui/EmptyState";
import RivalryScoreboard from "@/components/clubs/RivalryScoreboard";
import RivalryMeetings from "@/components/clubs/RivalryMeetings";
import RivalryBreakdown from "@/components/clubs/RivalryBreakdown";
import RivalryMatches from "@/components/clubs/RivalryMatches";
import { type Faction } from "@/lib/tokens";
import type { RivalryDetail } from "@/services/games.service";

/**
 * Two members, every game they have played, and where it turns.
 *
 * The leaderboard row answers who is ahead. This answers the questions that
 * come next: by how much, at which game, in which competition, and what is
 * booked between them. Legacy has the same page behind every row of its table.
 *
 * Every figure is written from the first member's side, which is the side the
 * database returns, so a reader never has to work out whose column is whose.
 */
export default function HeadToHead({
  detail, faction, viewerId, slug,
}: {
  detail: RivalryDetail;
  faction: Faction;
  slug: string;
  /** Their own name is marked, so they can find their side of it. */
  viewerId: string | null;
}) {
  const { rivalry, matches, breakdown, byCompetition, upcoming } = detail;
  const iAmOne = viewerId === rivalry.one.id;
  const iAmTwo = viewerId === rivalry.two.id;

  return (
    <Stack spacing={4}>
      <RivalryScoreboard rivalry={rivalry} faction={faction} viewerId={viewerId} />

      <RivalryMeetings meetings={upcoming} faction={faction} slug={slug} />

      {matches.length === 0 ? (
        <EmptyState
          title="No scored games yet"
          description={`${rivalry.one.name} and ${rivalry.two.name} have not finished a game with a score on it. Play one and enter the result afterwards, and the record starts here.`}
        />
      ) : (
        <>
          {breakdown.length > 1 ? (
            <RivalryBreakdown
              title="By game"
              note={`Wins, draws and losses from ${rivalry.one.name}'s side.`}
              rows={breakdown}
            />
          ) : null}

          {/* Only worth its space once they have met somewhere other than a
              casual table booking, which is when the split says something. */}
          {byCompetition.length > 1 ? (
            <RivalryBreakdown
              title="Where it happens"
              note={`The same record split by competition, from ${rivalry.one.name}'s side.`}
              rows={byCompetition}
            />
          ) : null}

          <RivalryMatches
            matches={matches}
            oneName={rivalry.one.name}
            twoName={rivalry.two.name}
            iAmOne={iAmOne}
            iAmTwo={iAmTwo}
          />
        </>
      )}
    </Stack>
  );
}
