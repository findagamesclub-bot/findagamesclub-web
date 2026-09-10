import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";

export type Part = { key: string; label: string; value: number; color: string };

/**
 * One bar showing how a whole splits, with the parts named underneath.
 *
 * For a question with a fixed set of answers and no time in it: how the roster
 * stands on payment, how far a job has got. A donut would work and takes four
 * times the room to say the same thing, and twelve columns would imply months
 * that are not there.
 *
 * Every part is named and counted in text under the bar, so the split is
 * readable without relying on the colours at all.
 */
export default function SplitBar({
  parts, height = 12,
}: {
  parts: Part[];
  height?: number;
}) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  if (total <= 0) return null;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row"
        sx={{ height, borderRadius: height / 2, overflow: "hidden",
              border: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>
        {parts.map((p) => (p.value > 0 ? (
          <Box key={p.key} title={`${p.label}: ${p.value}`}
            sx={{ flex: p.value, backgroundColor: p.color }} />
        ) : null))}
      </Stack>

      <Stack direction="row" spacing={2.5} useFlexGap sx={{ flexWrap: "wrap" }}>
        {parts.map((p) => (
          <Stack key={p.key} direction="row" spacing={0.875} sx={{ alignItems: "center" }}>
            <Box sx={{ width: 9, height: 9, borderRadius: 0.5, flexShrink: 0,
                       backgroundColor: p.color }} />
            <Typography sx={{ fontFamily: mono, fontSize: "0.78rem", fontWeight: 700,
                              fontVariantNumeric: "tabular-nums" }}>
              {p.value}
            </Typography>
            <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                              letterSpacing: "0.08em", color: tokens.inkMuted }}>
              {p.label.toUpperCase()}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
