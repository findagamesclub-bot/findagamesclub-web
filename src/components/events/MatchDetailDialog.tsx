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
import ArmyDetail, { setupLine } from "./ArmyDetail";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { ResultArmy } from "@/types/event";

export type MatchDetail = {
  label: string;
  playerOne: string;
  playerTwo: string;
  scoreOne: string;
  scoreTwo: string;
  armyOne: ResultArmy | null;
  armyTwo: ResultArmy | null;
  setup: { mission: string; deployment: string; terrain: string } | null;
};

/**
 * One game, both sides of it.
 *
 * The client asked to "click an event round game and see then those details
 * of that match", and a match is two armies and one setup rather than one
 * army. `ArmyListDialog` answers the other question, a single placing, and
 * both put the same `ArmyDetail` inside so they cannot disagree about a list.
 *
 * Read-only. The lists are frozen copies taken when they were named (0145),
 * so a player editing a list afterwards does not rewrite what they took in
 * April, and the mission is whatever the club typed against the game.
 */
export default function MatchDetailDialog({
  match, onClose, faction,
}: {
  /** Null keeps this shut. */
  match: MatchDetail | null;
  onClose: () => void;
  faction: Faction;
}) {
  const small = useMediaQuery("(max-width:599px)");
  const setup = setupLine(match?.setup);

  return (
    <Dialog open={match !== null} onClose={onClose}
      fullWidth maxWidth="md" fullScreen={small}>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography variant="h4" component="span" sx={{ fontSize: "1.15rem" }}>
          {match?.label || "The game"}
        </Typography>
        {setup ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 0.25 }}>
            {setup}
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 0.25 }}>
            The club did not record how this one was set up.
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {/* Two columns on anything wider than a phone, because the question a
            reader has is what one side took against the other. */}
        <Box sx={{ display: "grid", gap: 3, alignItems: "start",
                   gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                          md: "repeat(2, minmax(0, 1fr))" } }}>
          <ArmyDetail player={match?.playerOne ?? ""} army={match?.armyOne ?? null}
            faction={faction} scoreLine={match?.scoreOne} />
          {match?.playerTwo?.trim() ? (
            <ArmyDetail player={match.playerTwo} army={match.armyTwo}
              faction={faction} scoreLine={match.scoreTwo} />
          ) : (
            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 700 }}>No opponent</Typography>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                A bye. Nobody was drawn against this player.
              </Typography>
            </Stack>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">Close</Button>
      </DialogActions>
    </Dialog>
  );
}

/** The quiet line under a round result, where the club recorded a setup. */
export function SetupNote({ setup }: {
  setup: { mission: string; deployment: string; terrain: string } | null | undefined;
}) {
  const line = setupLine(setup);
  if (!line) return null;
  return (
    <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", letterSpacing: "0.08em",
                      color: tokens.inkMuted }}>
      {line.toUpperCase()}
    </Typography>
  );
}
