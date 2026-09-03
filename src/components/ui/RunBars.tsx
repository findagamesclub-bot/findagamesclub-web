import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { tokens } from "@/lib/tokens";

/**
 * One column per winning run, tallest being the longest.
 *
 * Sits under "longest win streak", which is a single number that cannot say
 * whether the member gets a run like that often or got one once. Three columns
 * of two and one column of two are the same number and a different season.
 *
 * Drawn in a single colour rather than by result, so it does not read as
 * another run of W and L squares: these are runs, not games.
 */
export default function RunBars({
  runs, height = 22,
}: {
  runs: number[];
  height?: number;
}) {
  if (!runs.length) return null;
  const tallest = Math.max(...runs);

  return (
    <Stack direction="row" spacing={0.5}
      sx={{ height, alignItems: "flex-end", overflow: "hidden" }}>
      {runs.map((run, i) => (
        <Box key={i} title={`${run} ${run === 1 ? "win" : "wins"} in a row`}
          sx={{ width: 7, flexShrink: 0, borderRadius: "2px 2px 0 0",
                // A floor, or a run of one against a run of six is a bar with
                // no height that reads as a gap in the chart.
                height: `${Math.max(18, (run / tallest) * 100)}%`,
                backgroundColor: run === tallest ? tokens.positive : `${tokens.positive}66` }} />
      ))}
    </Stack>
  );
}
