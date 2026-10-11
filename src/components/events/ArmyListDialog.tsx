"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { armySummary } from "@/utils/army-snapshot";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { ResultArmy } from "@/types/event";

/**
 * What somebody brought, unit by unit.
 *
 * The client asked to reach the army list from a round result and from a
 * placing, and those are two different rows on two different parts of the
 * page. A dialog is what lets both open the same thing: an expander inside a
 * round would grow one table and push the rest of the draw down, which is the
 * grid problem rule 5 is about, and the rounds are already an accordion, so a
 * disclosure inside one is a disclosure inside a disclosure.
 *
 * Read-only. Nothing here is the club's to change: the list is a frozen copy
 * taken when it was named (0145), so a player editing the list afterwards does
 * not rewrite what they took last April.
 */
export default function ArmyListDialog({
  open, onClose, player, army, faction,
}: {
  open: boolean;
  onClose: () => void;
  /** Whose list it is. A table carries a name and often no account. */
  player: string;
  army: ResultArmy | null;
  faction: Faction;
}) {
  const small = useMediaQuery("(max-width:599px)");
  const list = army?.list ?? null;
  const summary = armySummary(army);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={small}>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography variant="h4" component="span" sx={{ fontSize: "1.15rem" }}>
          {player || "Army list"}
        </Typography>
        {summary ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 0.25 }}>
            {summary}
          </Typography>
        ) : null}
      </DialogTitle>

      <DialogContent>
        {army?.mvpUnits.length ? (
          <Stack direction="row" spacing={0.75} useFlexGap
            sx={{ flexWrap: "wrap", alignItems: "baseline", mb: 2 }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                              letterSpacing: "0.1em", color: tokens.inkMuted }}>
              MVP
            </Typography>
            {army.mvpUnits.map((unit) => (
              <Box key={unit}
                sx={{ px: 1, py: 0.3, borderRadius: 0.75, bgcolor: faction.soft,
                      color: faction.deep, fontFamily: mono, fontSize: "0.72rem",
                      fontWeight: 600 }}>
                {unit}
              </Box>
            ))}
          </Stack>
        ) : null}

        {list ? (
          <Box>
            <Stack direction="row" spacing={1}
              sx={{ alignItems: "baseline", flexWrap: "wrap", mb: 1 }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                                letterSpacing: "0.1em", color: tokens.inkMuted }}>
                {(list.name ?? "ARMY LIST").toUpperCase()}
              </Typography>
              {list.totalPoints ? (
                <Typography sx={{ fontFamily: mono, fontSize: "0.78rem",
                                  color: tokens.brass, fontWeight: 700 }}>
                  {`${list.totalPoints} pts`}
                </Typography>
              ) : null}
            </Stack>

            <Box sx={{ display: "grid", columnGap: 2,
                       gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                              sm: "repeat(2, minmax(0, 1fr))" } }}>
              {list.units.map((unit) => (
                <Stack key={unit.name} direction="row" spacing={1}
                  sx={{ justifyContent: "space-between", py: 0.4,
                        borderBottom: `1px solid ${tokens.rule}` }}>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem", minWidth: 0 }}>
                    {unit.quantity > 1 ? `${unit.quantity} × ` : ""}{unit.name}
                  </Typography>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.78rem",
                                    fontVariantNumeric: "tabular-nums",
                                    color: tokens.inkMuted, flexShrink: 0 }}>
                    {unit.points}
                  </Typography>
                </Stack>
              ))}
            </Box>
          </Box>
        ) : (
          /* Reachable when a club records a faction and the player never named
             a saved list, which is most of them. The control that opens this
             is only drawn when there IS a list, so this is the belt and not
             the braces. */
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            No army list was named against this one.
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
