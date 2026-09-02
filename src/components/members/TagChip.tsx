import Box from "@mui/material/Box";
import { type Faction } from "@/lib/tokens";
import { tokens } from "@/lib/tokens";

/**
 * A game somebody plays, or an army they bring.
 *
 * Two variants rather than two components, because the only thing that differs
 * is which of the pair you are looking at. Games are filled in the club's
 * colour and armies are outlined in it, so a row of both can be read apart at
 * a glance even where there is no room to label the two groups separately.
 */
export default function TagChip({
  label, faction, kind = "game",
}: {
  label: string;
  faction: Faction;
  kind?: "game" | "army";
}) {
  const army = kind === "army";
  return (
    <Box
      sx={{
        px: 1, py: 0.35, borderRadius: 0.75,
        fontFamily: "var(--font-mono)", fontSize: "0.72rem", fontWeight: 600,
        bgcolor: army ? "transparent" : faction.soft,
        color: army ? tokens.inkMuted : faction.deep,
        border: `1px solid ${army ? tokens.rule : "transparent"}`,
      }}
    >
      {label}
    </Box>
  );
}
