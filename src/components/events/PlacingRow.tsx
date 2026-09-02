"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { EventPlacing } from "@/types/event";

/**
 * One placing on a line, for the rest of the field.
 *
 * A hundred podium cards is a page nobody reads. This keeps what a reader
 * scanning a results table actually wants — the place, the name, the army —
 * and drops the unit-by-unit list, which is podium detail.
 */
export default function PlacingRow({
  p, faction, striped, mine, onEdit,
}: {
  p: EventPlacing;
  faction: Faction;
  striped: boolean;
  /** The reader's own row, so they can stop scanning once they find it. */
  mine: boolean;
  onEdit?: () => void;
}) {
  const army = [p.army?.factionLabel, p.army?.detachment].filter(Boolean).join(" · ");

  return (
    <Box
      sx={{ display: "grid", gap: 1.5, px: 2, py: 1.25, alignItems: "baseline",
            gridTemplateColumns: { xs: "44px minmax(0, 1fr)",
                                   sm: "56px minmax(0, 1fr) minmax(0, 1fr) auto" },
            borderTop: `1px solid ${tokens.rule}`,
            backgroundColor: mine ? faction.soft : striped ? tokens.surface : tokens.paper }}
    >
      <Typography sx={{ fontFamily: mono, fontVariantNumeric: "tabular-nums",
                        fontSize: "0.86rem", fontWeight: 700,
                        color: mine ? faction.deep : tokens.inkMuted }}>
        {p.rank}
      </Typography>

      <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: mine ? 700 : 500 }} noWrap>
          {p.name}
        </Typography>
        {!p.isMember ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", letterSpacing: "0.08em",
                            color: tokens.inkMuted, flexShrink: 0 }}>
            VISITOR
          </Typography>
        ) : null}
      </Stack>

      <Typography variant="body2" color="text.secondary"
        sx={{ minWidth: 0, fontSize: "0.85rem", display: { xs: "none", sm: "block" } }} noWrap>
        {army || "—"}
      </Typography>

      {onEdit ? (
        <Button size="small" variant="text" onClick={onEdit}
          startIcon={<EditOutlinedIcon sx={{ fontSize: 15 }} />}
          sx={{ color: tokens.inkMuted, fontSize: "0.72rem", flexShrink: 0 }}>
          Edit
        </Button>
      ) : null}
    </Box>
  );
}
