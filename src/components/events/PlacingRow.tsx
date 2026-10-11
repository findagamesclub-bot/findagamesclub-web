"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import { armySummary } from "@/utils/army-snapshot";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { EventPlacing, ResultArmy } from "@/types/event";

/**
 * One placing on a line, for the rest of the field.
 *
 * A hundred podium cards is a page nobody reads. This keeps what a reader
 * scanning a results table actually wants, the place, the name and the army,
 * and drops the unit-by-unit list, which is podium detail. The list is a
 * press away rather than gone: the client asked to reach it from a placing as
 * well as from a round result, and a fortieth-place list is worth exactly one
 * dialog and not forty cards.
 */
export default function PlacingRow({
  p, faction, striped, mine, onEdit, onOpenList,
}: {
  p: EventPlacing;
  faction: Faction;
  striped: boolean;
  /** The reader's own row, so they can stop scanning once they find it. */
  mine: boolean;
  onEdit?: () => void;
  onOpenList?: (player: string, army: ResultArmy) => void;
}) {
  // The client asked for all three: "Army faction, list and disposition shown
  // against an event placing".
  const army = armySummary(p.army);
  const hasList = Boolean(p.army?.list && onOpenList);

  return (
    <Box
      sx={{ display: "grid", columnGap: 1.5, rowGap: 0.25, px: 2, py: 1.25,
            alignItems: "baseline",
            gridTemplateColumns: { xs: "44px minmax(0, 1fr) auto",
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

      {/* The army used to be hidden below sm outright, so a phone showed a
          results table with the one thing a wargamer reads it for missing. It
          drops under the name instead, which is where it sits on a table of
          the draw. */}
      <Typography variant="body2" color="text.secondary"
        sx={{ minWidth: 0, fontSize: { xs: "0.75rem", sm: "0.85rem" },
              gridColumn: { xs: "2 / 3", sm: "auto" },
              gridRow: { xs: 2, sm: "auto" } }}
        >
        {army || "—"}
      </Typography>

      <Stack direction="row" spacing={0.5}
        sx={{ justifySelf: "end", alignItems: "baseline", flexShrink: 0,
              gridColumn: { xs: "3 / 4", sm: "auto" },
              gridRow: { xs: "1 / 3", sm: "auto" } }}>
        {hasList ? (
          <Button size="small" variant="text"
            onClick={() => onOpenList!(p.name, p.army!)}
            startIcon={<FormatListBulletedIcon sx={{ fontSize: 15 }} />}
            sx={{ color: faction.deep, fontSize: "0.72rem", minWidth: 0, px: 0.75 }}>
            List
          </Button>
        ) : null}
        {onEdit ? (
          <Button size="small" variant="text" onClick={onEdit}
            startIcon={<EditOutlinedIcon sx={{ fontSize: 15 }} />}
            sx={{ color: tokens.inkMuted, fontSize: "0.72rem", minWidth: 0, px: 0.75 }}>
            Edit
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}
