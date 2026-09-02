import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import StatTiles from "@/components/ui/StatTiles";
import ScoreTrendChart from "@/components/ui/ScoreTrendChart";
import { streakLabel } from "@/utils/member-stats";
import { tokens } from "@/lib/tokens";
import type { ClubTracker } from "@/services/grudgeTracker.service";

/**
 * Recent form, the half of legacy's Insights tab that does not need an army.
 *
 * Its other half reads factions, detachments and unit performance out of the
 * Army Builder, which is Milestone 3, so it is not here and is not pretended
 * at with an empty panel.
 */
export default function GrudgeInsights({
  tracker, mineLabel,
}: {
  tracker: ClubTracker;
  /** Whose scores the solid line is. "You" only when it really is the reader. */
  mineLabel: string;
}) {
  const { record, trend } = tracker;
  const streak = streakLabel(record.streak);

  return (
    <Box>
      <StatTiles
        columns={2}
        tiles={[
          {
            label: "Last 5 matches",
            value: record.lastFive,
            note: record.lastFiveWinRate === null
              ? "Nothing scored yet"
              : `${record.lastFiveWinRate}% win rate · ${record.winRate}% across all ${record.played}`,
          },
          {
            label: "Current streak",
            value: streak ?? "No streak yet",
            note: record.streak
              ? `${record.streak.length} recent ${record.streak.length === 1 ? "result" : "results"}`
              : "Nothing scored yet",
            emphasis: record.streak?.kind === "won",
          },
          {
            label: "Average score for",
            // Said plainly rather than shown as a zero, which would read as
            // having scored nothing rather than as nobody filling scores in.
            value: record.averageFor === null ? "—" : String(record.averageFor),
            note: "Across scored matches",
          },
          {
            label: "Average score against",
            value: record.averageAgainst === null ? "—" : String(record.averageAgainst),
            note: "Across scored matches",
          },
        ]}
      />

      <Box sx={{ mt: 2 }}>
        {trend.length >= 2 ? (
          <Box sx={{ p: 2, border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                     backgroundColor: tokens.paper }}>
            <ScoreTrendChart points={trend} mineLabel={mineLabel} />
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Two scored games are enough to draw a form line. There is one so far.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
