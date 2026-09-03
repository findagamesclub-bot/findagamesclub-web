import Box from "@mui/material/Box";
import AnalyticsPanel from "@/components/account/AnalyticsPanel";
import LoyaltyProgress from "@/components/account/LoyaltyProgress";
import RankedBars from "@/components/account/RankedBars";
import DonutChart from "@/components/ui/DonutChart";
import MonthlyGamesChart from "@/components/account/MonthlyGamesChart";
import { clubIdentity } from "@/utils/club-identity";
import { byClub, byGame, byOpponent, mostPlayed, mostWins } from "@/utils/member-analytics";
import { gamesByMonth } from "@/utils/member-form";
import { tokens } from "@/lib/tokens";
import type { LoyaltyCard } from "@/services/dashboard.service";
import { UNNAMED_OPPONENT, type MyGame } from "@/services/games.service";

/**
 * The six breakdowns legacy puts on a member's dashboard.
 *
 * Every one is worked out from games already loaded for this page, so the
 * whole block costs nothing to fetch. That is also why it is safe to show all
 * six: none of them is a query somebody pays for.
 *
 * Two of them are rankings over the same list of opponents, ordered
 * differently on purpose. "Who do I beat" and "who do I play" are separate
 * questions, and at Didcot they give separate answers.
 */
export default function MemberAnalytics({
  games, loyalty, today,
}: {
  games: MyGame[];
  loyalty: LoyaltyCard[];
  /**
   * Passed in rather than read here. The month buckets end on "this month",
   * and a browser in another timezone would draw a different last column from
   * the server, which is a hydration mismatch rather than a rounding error.
   */
  today: string;
}) {
  // A game with nobody named carries a placeholder, not a name. Left alone,
  // every one of them tallies into a single row with a record against somebody
  // who was never there.
  const opponents = byOpponent(games.map((g) => ({
    ...g,
    opponentName: !g.opponentId && g.opponentName === UNNAMED_OPPONENT
      ? "" : g.opponentName,
  })));
  const won = games.filter((g) => g.outcome === "won").length;
  const drawn = games.filter((g) => g.outcome === "drew").length;
  const lost = games.filter((g) => g.outcome === "lost").length;
  const unscored = games.length - won - drawn - lost;

  const clubs = mostPlayed(byClub(games));
  const months = gamesByMonth(games, today);

  return (
    <Box sx={{ display: "grid", gap: 2.5,
               gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } }}>
      <AnalyticsPanel eyebrow="Results" title="Overall record">
        <DonutChart
          centreValue={String(games.length)}
          centreLabel={games.length === 1 ? "game" : "games"}
          slices={[
            { key: "won", label: "Wins", value: won, color: tokens.positive },
            { key: "drawn", label: "Draws", value: drawn, color: tokens.inkMuted },
            { key: "lost", label: "Losses", value: lost, color: tokens.danger },
            // Shown rather than quietly dropped, or the ring and the total
            // disagree and the panel looks like it has lost some games.
            ...(unscored > 0
              ? [{ key: "open", label: "Not scored", value: unscored, color: tokens.rule }]
              : []),
          ]}
        />
      </AnalyticsPanel>

      <AnalyticsPanel eyebrow="Loyalty" title="Points progress">
        <LoyaltyProgress cards={loyalty} />
      </AnalyticsPanel>

      <Box sx={{ gridColumn: { md: "span 2" } }}>
        <AnalyticsPanel eyebrow="Playing rhythm" title="Games by month">
          <MonthlyGamesChart months={months} />
        </AnalyticsPanel>
      </Box>

      <AnalyticsPanel eyebrow="Best matchups" title="Favourite opponents">
        <RankedBars rows={mostWins(opponents)} metric="won"
          empty="Win a scored game and the people you beat appear here." />
      </AnalyticsPanel>

      <AnalyticsPanel eyebrow="Rivals" title="Most played opponents">
        <RankedBars rows={mostPlayed(opponents)} metric="played"
          empty="Play somebody twice and they appear here." />
      </AnalyticsPanel>

      <AnalyticsPanel eyebrow="Game systems" title="Favourite games">
        <RankedBars rows={mostPlayed(byGame(games))} metric="played"
          empty="The games you book appear here." />
      </AnalyticsPanel>

      <AnalyticsPanel eyebrow="Club split" title="Where you play most">
        <DonutChart
          centreValue={String(games.length)}
          centreLabel={clubs.length === 1 ? "at one club" : `across ${clubs.length}`}
          slices={clubs.map((club) => ({
            key: club.key,
            label: club.label,
            value: club.played,
            // A club's own colour, the same one it wears on its card, its pin
            // and its chips. A palette invented for this chart would be the
            // only place in the app where a club is a different colour.
            color: clubIdentity(club.key, club.label).faction.base,
          }))}
        />
      </AnalyticsPanel>
    </Box>
  );
}
