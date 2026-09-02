import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";
import type { Breakdown } from "@/services/games.service";
import MonoLabel from "@/components/ui/MonoLabel";

/**
 * A record split by something — game system, or competition.
 *
 * Legacy has these as two identical tables side by side, which is the right
 * call: "he only beats me at Kill Team" and "he only beats me in the league"
 * are the same question asked of a different column.
 */
export default function RivalryBreakdown({
  title, note, rows,
}: {
  title: string;
  note: string;
  rows: Breakdown[];
}) {
  if (!rows.length) return null;

  return (
    <Box>
      <MonoLabel mb={0.5}>{title}</MonoLabel>
      <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 1.25 }}>
        {note}
      </Typography>

      <Stack spacing={0}
        sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
        {rows.map((row, i) => (
          <Box key={row.label}
            sx={{ display: "grid", alignItems: "baseline", gap: 1.5, px: 2, py: 1.25,
                  gridTemplateColumns: { xs: "minmax(0, 1fr) auto",
                                         sm: "minmax(0, 1fr) 132px 76px" },
                  borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}`,
                  backgroundColor: i % 2 ? tokens.surface : tokens.paper }}>
            <Typography variant="body2" sx={{ minWidth: 0 }}>{row.label}</Typography>
            {/* Letters rather than "0-0-1": a bare triple never says which
                number is which, and this is read by people looking for the
                game they keep losing at. */}
            <Stack direction="row" spacing={1.25}
              sx={{ justifyContent: { sm: "flex-end" }, flexShrink: 0 }}>
              <Count n={row.wins} letter="W" />
              <Count n={row.draws} letter="D" />
              <Count n={row.losses} letter="L" />
            </Stack>
            <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted,
                              textAlign: { sm: "right" },
                              display: { xs: "none", sm: "block" } }}>
              {`${row.played} ${row.played === 1 ? "game" : "games"}`}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function Count({ n, letter }: { n: number; letter: string }) {
  return (
    <Typography sx={{ fontFamily: mono, fontVariantNumeric: "tabular-nums",
                      fontSize: "0.84rem", color: n === 0 ? tokens.inkMuted : tokens.ink }}>
      {n}
      <Box component="span" sx={{ fontSize: "0.7rem", color: tokens.inkMuted, ml: 0.25 }}>
        {letter}
      </Box>
    </Typography>
  );
}
