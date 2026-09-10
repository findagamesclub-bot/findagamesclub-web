import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MonoLabel from "@/components/ui/MonoLabel";
import StatTiles, { type Tile } from "@/components/ui/StatTiles";
import MonthBarChart, { type MonthSeries } from "@/components/ui/MonthBarChart";
import { mono, tokens } from "@/lib/tokens";

/**
 * A section's own year, in the shape the overview uses.
 *
 * Each console section answers a different question, and the number at the top
 * of it never says whether things are getting better or worse. Two orders
 * waiting is fine in a month with thirty and a disaster in a month with two.
 *
 * Deliberately one component rather than a chart per section: an owner should
 * not have to learn a new picture every time they click something.
 */
export default function SectionPulse({
  label = "How it is going",
  tiles,
  labels,
  series,
  note,
}: {
  label?: string;
  tiles?: Tile[];
  labels: string[];
  series: MonthSeries[];
  /** What the reader should take from it, when the bars alone would not say. */
  note?: string;
}) {
  // Nothing has happened, so there is nothing to draw. A row of flat bars
  // reads as broken rather than as empty.
  const anything = series.some((s) => s.values.some((v) => v > 0));
  if (!anything) return null;

  return (
    <Box sx={{ mt: 4 }}>
      <MonoLabel>{label}</MonoLabel>

      {tiles?.length ? (
        <Box sx={{ mb: 2.5 }}><StatTiles tiles={tiles} /></Box>
      ) : null}

      <Box sx={{ p: 2, border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                 backgroundColor: tokens.paper }}>
        <MonthBarChart labels={labels} series={series} />
        {note ? (
          <Stack sx={{ mt: 1.5 }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                              letterSpacing: "0.06em", color: tokens.inkMuted }}>
              {note}
            </Typography>
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}
