"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import PlayerName from "./PlayerName";
import { armySummary } from "@/utils/army-snapshot";
import { tokens, type Faction } from "@/lib/tokens";
import type { EventPlacing } from "@/types/event";

/**
 * One placing, in full: the army, the units that did the work, and a way into
 * the list.
 *
 * Reserved for the podium once a field gets big. Fifty of these is a page
 * nobody scrolls, and the detail is what people come for at the top of a
 * table, not at fortieth.
 */
export default function PlacingCard({
  p, faction, onEdit, onOpenList,
}: {
  p: EventPlacing;
  faction: Faction;
  /** The club's own control. Absent for everybody else. */
  onEdit?: () => void;
  /** Opens the saved list. Same dialog the rest of the field uses. */
  onOpenList?: (player: string, army: NonNullable<EventPlacing["army"]>) => void;
}) {
  return (
    <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          p: 2.25,
          borderRadius: 2,
          bgcolor: p.rank === 1 ? faction.soft : tokens.paper,
          border: `1px solid ${p.rank === 1 ? faction.base : tokens.rule}`,
        }}
      >
        <Box sx={{ minWidth: 56, flexShrink: 0 }}>
          <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "2rem",
                            fontWeight: 700, lineHeight: 1,
                            color: p.rank === 1 ? faction.deep : tokens.inkMuted }}>
            {p.rank}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                            letterSpacing: "0.08em", color: tokens.inkMuted }}>
            {p.placement.replace(/^\d+\w*\s*/i, "").toUpperCase() || "PLACE"}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <PlayerName name={p.name} profileId={p.profileId}
              sx={{ fontSize: "1rem", fontWeight: 600 }} />
            {!p.isMember ? (
              <Chip size="small" label="Visitor" variant="outlined"
                sx={{ borderColor: tokens.rule, fontSize: "0.7rem" }} />
            ) : null}
            {onEdit ? (
              <Button size="small" variant="text"
                startIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />}
                onClick={onEdit}
                sx={{ ml: "auto", color: tokens.inkMuted, fontSize: "0.75rem" }}>
                Edit
              </Button>
            ) : null}
          </Stack>

          {p.army ? (
            <>
              <Typography variant="body2" color="text.secondary">
                {armySummary(p.army)}
              </Typography>

              {p.army.mvpUnits.length ? (
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.64rem",
                                    letterSpacing: "0.1em", color: tokens.inkMuted, pt: 0.4 }}>
                    MVP
                  </Typography>
                  {p.army.mvpUnits.map((u) => (
                    <Box key={u} sx={{ px: 1, py: 0.3, borderRadius: 0.75,
                                       bgcolor: faction.soft, color: faction.deep,
                                       fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                                       fontWeight: 600 }}>
                      {u}
                    </Box>
                  ))}
                </Stack>
              ) : null}

              {/* The list opens in the same dialog the rest of the field uses,
                  rather than being printed out under the card.

                  0172 kept it inline here on the reasoning that the podium is
                  where somebody wants the detail. The client asked for the
                  dialog instead, and they are right on the stronger ground:
                  one control, one place, whichever half of the table somebody
                  is reading. A forty-unit list under the winner also pushed
                  second and third off the screen, so the thing the podium
                  exists to show was the thing it buried. */}
              {p.army.list?.units.length && onOpenList ? (
                <Box sx={{ mt: 1.25 }}>
                  <Button size="small" variant="text"
                    onClick={() => onOpenList(p.name, p.army!)}
                    startIcon={<FormatListBulletedIcon sx={{ fontSize: 15 }} />}
                    sx={{ color: faction.deep, fontSize: "0.75rem", ml: -0.75 }}>
                    {p.army.list.name || "Army list"}
                    {p.army.list.totalPoints ? ` · ${p.army.list.totalPoints} pts` : ""}
                  </Button>
                </Box>
              ) : null}
            </>
          ) : null}
        </Box>
      </Stack>
  );
}
