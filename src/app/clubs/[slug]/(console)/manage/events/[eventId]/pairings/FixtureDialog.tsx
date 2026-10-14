"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import { tokens } from "@/lib/tokens";
import type { EventTeam } from "@/types/eventTeams";

/**
 * One fixture, typed in rather than shuffled.
 *
 * 0168 left the draw as the only way to get a fixture, on the reasoning that
 * a table made on its own would belong to nothing. That is true of a table
 * and was never true of a fixture, and a club whose format the shuffle does
 * not understand was left with no way to build a round at all.
 *
 * Two pickers and nothing else. Which tables go inside it is the next
 * question and is asked on the fixture itself, where the answer belongs.
 */
export default function FixtureDialog({
  open, round, teams, saving, onClose, onSave,
}: {
  open: boolean;
  round: number;
  teams: EventTeam[];
  saving: boolean;
  onClose: () => void;
  onSave: (teamOne: number, teamTwo: number) => void;
}) {
  const [one, setOne] = useState<number | "">("");
  const [two, setTwo] = useState<number | "">("");

  // Fresh every time it opens, so pairing a second fixture does not start
  // from the teams of the first.
  useWhenChanged([open], () => {
    if (!open) return;
    setOne("");
    setTwo("");
  });

  const clash = one !== "" && one === two;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography variant="h4" component="span" sx={{ fontSize: "1.15rem" }}>
          {`Add a fixture to round ${round}`}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField select label="Team" required fullWidth
            value={one === "" ? "" : String(one)}
            onChange={(event) => setOne(Number(event.target.value))}
            helperText="The left-hand side. Its players take the left of every table.">
            {teams.map((team) => (
              <MenuItem key={team.id} value={String(team.id)}>{team.name}</MenuItem>
            ))}
          </TextField>

          <TextField select label="Against" required fullWidth
            value={two === "" ? "" : String(two)}
            onChange={(event) => setTwo(Number(event.target.value))}
            error={clash}
            helperText={clash
              ? "A team cannot play itself. Pick a different one."
              : "The right-hand side."}>
            {teams.map((team) => (
              <MenuItem key={team.id} value={String(team.id)}>{team.name}</MenuItem>
            ))}
          </TextField>

          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            The fixture is added with no tables in it. Put the player tables
            inside it afterwards, one at a time.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving} color="inherit">Cancel</Button>
        <Button variant="contained" loading={saving} loadingPosition="start"
          disabled={one === "" || two === "" || clash}
          onClick={() => { if (one !== "" && two !== "") onSave(one, two); }}>
          Add the fixture
        </Button>
      </DialogActions>
    </Dialog>
  );
}
