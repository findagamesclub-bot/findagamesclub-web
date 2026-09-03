import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { tokens } from "@/lib/tokens";

export type Segment = { key: string; value: number; color: string; title: string };

/**
 * A tile-sized bar, split by whatever the figure above it is made of.
 *
 * It carries no labels and no axis, which is the point: it sits under a
 * number that has already been named, and its whole job is to show the
 * proportions that number came from. Every segment carries a title, so the
 * split is reachable on hover and by a screen reader rather than living only
 * in the colours.
 */
export default function MicroBar({
  segments, height = 7,
}: {
  segments: Segment[];
  height?: number;
}) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  if (total <= 0) return null;

  return (
    <Stack direction="row"
      sx={{ height, borderRadius: height / 2, overflow: "hidden",
            backgroundColor: tokens.surface, border: `1px solid ${tokens.rule}` }}>
      {segments.map((s) => (s.value > 0 ? (
        <Box key={s.key} title={s.title} sx={{ flex: s.value, backgroundColor: s.color }} />
      ) : null))}
    </Stack>
  );
}
