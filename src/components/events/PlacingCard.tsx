"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { tokens, type Faction } from "@/lib/tokens";
import type { EventPlacing } from "@/types/event";

/**
 * One placing, in full: the army, the units that did the work, the list.
 *
 * Reserved for the podium once a field gets big. Fifty of these is a page
 * nobody scrolls, and the detail is what people come for at the top of a
 * table, not at fortieth.
 */
export default function PlacingCard({
  p, faction, onEdit,
}: {
  p: EventPlacing;
  faction: Faction;
  /** The club's own control. Absent for everybody else. */
  onEdit?: () => void;
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
            <Typography variant="subtitle1">{p.name}</Typography>
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
                {[p.army.factionLabel, p.army.detachment].filter(Boolean).join(" · ")}
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

              {/* The full list, when the player had one saved. Two columns of
                  unit and points, the way an army list is actually written. */}
              {p.army.list?.units.length ? (
                <Box sx={{ mt: 1.5, pt: 1.25, borderTop: `1px solid ${tokens.rule}` }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mb: 0.75 }}>
                    <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.64rem",
                                      letterSpacing: "0.1em", color: tokens.inkMuted }}>
                      {(p.army.list.name ?? "ARMY LIST").toUpperCase()}
                    </Typography>
                    {p.army.list.totalPoints ? (
                      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                                        color: tokens.brass, fontWeight: 600 }}>
                        {p.army.list.totalPoints} pts
                      </Typography>
                    ) : null}
                  </Stack>
                  <Box sx={{ display: "grid",
                             gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0,1fr))" },
                             columnGap: 2 }}>
                    {p.army.list.units.map((u) => (
                      <Stack key={u.name} direction="row" spacing={1}
                        sx={{ justifyContent: "space-between", py: 0.3 }}>
                        <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                          {u.quantity > 1 ? `${u.quantity} × ` : ""}{u.name}
                        </Typography>
                        <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem",
                                          color: tokens.inkMuted, flexShrink: 0 }}>
                          {u.points}
                        </Typography>
                      </Stack>
                    ))}
                  </Box>
                </Box>
              ) : null}
            </>
          ) : null}
        </Box>
      </Stack>
  );
}
