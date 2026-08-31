import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";

/**
 * The five figures the dashboard is about, in one line.
 *
 * Mono and unboxed. Five numbers do not need five cards, and the cards below
 * are already doing that job.
 */
export default function StatStrip({
  stats,
}: {
  stats: { label: string; value: number; emphasis?: boolean }[];
}) {
  return (
    <Stack direction="row" spacing={{ xs: 2.5, sm: 4.5 }} useFlexGap
      sx={{ flexWrap: "wrap", alignItems: "baseline",
            py: 1.75, px: { xs: 2, sm: 2.5 }, borderRadius: 2,
            border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      {stats.map((stat) => (
        <Stack key={stat.label} direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
          <Typography sx={{ fontFamily: mono, fontSize: "1.5rem", fontWeight: 700,
                            lineHeight: 1,
                            color: stat.emphasis ? tokens.brass : tokens.ink }}>
            {stat.value}
          </Typography>
          <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", letterSpacing: "0.1em",
                            color: tokens.inkMuted }}>
            {stat.label.toUpperCase()}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
