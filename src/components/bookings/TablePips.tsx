import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens, type Faction } from "@/lib/tokens";

/**
 * Capacity, drawn as the tables in the hall.
 *
 * The first version used 10px hollow squares in the rule colour, which is a
 * near-white on a near-white card: on a quiet night you saw ten ghosts and read
 * nothing. Free tables are now solid light blocks and taken ones solid in the
 * club's colour, because solid shapes at this size read and outlines do not.
 *
 * Two cues, not one: taken blocks are also taller than free ones, so the count
 * survives a colourblind reader and a greyscale print. The figure beside them
 * is the plain-language version and always agrees.
 */
export default function TablePips({
  capacity, taken, faction,
}: { capacity: number; taken: number; faction: Faction }) {
  const free = Math.max(capacity - taken, 0);
  const full = free === 0;
  const label = full ? "Full" : `${free} of ${capacity} free`;

  const figure = (
    <Typography
      component="span"
      sx={{
        fontFamily: "var(--font-mono)", fontSize: "0.85rem", whiteSpace: "nowrap",
        color: full ? tokens.danger : tokens.ink, fontWeight: full ? 700 : 600,
      }}
    >
      {full ? "Full" : free}
      {!full ? (
        <Box component="span" sx={{ color: tokens.inkMuted, fontWeight: 400 }}>
          {` of ${capacity} free`}
        </Box>
      ) : null}
    </Typography>
  );

  // Past a dozen the blocks stop being countable, so the figure carries it alone.
  if (capacity > 12) return figure;

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", whiteSpace: "nowrap" }}>
      <Stack direction="row" spacing="3px" role="img" aria-label={label}
        sx={{ alignItems: "flex-end" }}>
        {Array.from({ length: capacity }, (_, i) => {
          const used = i < taken;
          return (
            <Box
              key={i}
              aria-hidden
              sx={{
                width: 9,
                height: used ? 16 : 11,
                borderRadius: "2px",
                bgcolor: used ? faction.base : "#C9D3E0",
              }}
            />
          );
        })}
      </Stack>
      {figure}
    </Stack>
  );
}
