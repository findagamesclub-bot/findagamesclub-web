import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Faction } from "@/lib/tokens";

type Props = {
  games: string[];
  faction: Faction;
  /** Anything past this collapses into a "+n" chip, so cards stay one height. */
  max?: number;
};

/**
 * Games a club plays, tinted with its faction colour.
 *
 * Outlined grey chips made every club look the same at a glance. Tinting them
 * means a row of cards is scannable by colour before you've read a word.
 */
export default function GameChips({ games, faction, max = 3 }: Props) {
  if (games.length === 0) return null;

  const shown = games.slice(0, max);
  const extra = games.length - shown.length;

  const chip = {
    fontFamily: "var(--font-display)",
    fontSize: "0.82rem",
    fontWeight: 600,
    lineHeight: 1,
    px: 1, py: 0.625,
    borderRadius: "2px",
    whiteSpace: "nowrap",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as const;

  return (
    <Stack direction="row" spacing={0.625} useFlexGap sx={{ flexWrap: "wrap" }}>
      {shown.map((game) => (
        <Typography
          key={game}
          component="span"
          sx={{ ...chip, backgroundColor: faction.soft, color: faction.deep }}
        >
          {game}
        </Typography>
      ))}
      {extra > 0 ? (
        <Box component="span" sx={{ ...chip, backgroundColor: "transparent", color: "text.secondary", border: "1px solid", borderColor: "divider" }}>
          +{extra}
        </Box>
      ) : null}
    </Stack>
  );
}
