import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";

export type Tile = {
  label: string;
  value: string;
  /** The working behind the figure. "44.4%" on its own invites "out of what". */
  note: string;
  emphasis?: boolean;
  /**
   * A small graphic under the note. Optional on purpose: a tile whose figure
   * has nothing to show is better plain than padded out with a chart of one
   * number.
   */
  chart?: React.ReactNode;
};

/**
 * A row of figures, each carrying its own working.
 *
 * Used by the member dashboard and by the grudge tracker on a profile. They
 * showed the same shapes with two copies of the markup, which is how a
 * "current streak" tile ends up looking like two different things depending on
 * whose page you are on.
 */
export default function StatTiles({
  tiles, columns = 3,
}: {
  tiles: Tile[];
  columns?: 2 | 3;
}) {
  return (
    <Box sx={{ display: "grid", gap: 2,
               gridTemplateColumns: {
                 xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))",
                 lg: `repeat(${columns}, minmax(0, 1fr))`,
               } }}>
      {tiles.map((t) => (
        <Stack key={t.label} spacing={0.5}
          sx={{ p: 2, border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                backgroundColor: tokens.paper }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", fontWeight: 700,
                            letterSpacing: "0.12em", color: tokens.inkMuted }}>
            {t.label.toUpperCase()}
          </Typography>
          <Typography sx={{ fontFamily: mono, fontVariantNumeric: "tabular-nums",
                            fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.15,
                            color: t.emphasis ? tokens.brass : tokens.ink }}>
            {t.value}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.inkMuted, fontSize: "0.82rem" }}>
            {t.note}
          </Typography>
          {/* Pushed to the bottom, so the graphics line up across a row even
              when one tile's note wraps onto a second line. */}
          {t.chart ? <Box sx={{ pt: 1.25, mt: "auto" }}>{t.chart}</Box> : null}
        </Stack>
      ))}
    </Box>
  );
}
