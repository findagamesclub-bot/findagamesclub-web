"use client";

import { useEffect, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { tokens } from "@/lib/tokens";
import type { PairingMatch } from "@/types/eventEditor";
import type { Player } from "@/utils/pairings-draw";

/**
 * One table, by hand.
 *
 * Both name boxes offer the roster and take free text, because somebody who
 * turned up and paid at the door is on the table long before anybody has typed
 * them into a booking. Picking from the roster links the match to that account.
 */
export default function MatchDialog({
  open, match, roster, round, position, nextTable, onClose, onSave,
}: {
  open: boolean;
  /** Null for a new table. */
  match: PairingMatch | null;
  roster: Player[];
  round: number;
  position: number;
  nextTable: string;
  onClose: () => void;
  onSave: (fields: Record<string, string>) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));

  const [table, setTable] = useState("");
  const [one, setOne] = useState("");
  const [two, setTwo] = useState("");

  useEffect(() => {
    if (!open) return;
    setTable(match?.tableLabel || nextTable);
    setOne(match?.playerOne ?? "");
    setTwo(match?.playerTwo ?? "");
  }, [open, match, nextTable]);

  const idOf = (name: string) =>
    roster.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase())
      ?.profileId ?? "";

  const clash = Boolean(one.trim()) && one.trim().toLowerCase() === two.trim().toLowerCase();

  const names = roster.map((player) => player.name);

  const picker = (
    label: string, value: string, set: (next: string) => void, help: string,
  ) => (
    <Autocomplete
      freeSolo options={names} value={value}
      onInputChange={(_event, next) => set(next)}
      renderInput={(params) => (
        <TextField {...params} label={label} fullWidth helperText={help} />
      )}
    />
  );

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        {match ? `Table ${match.tableLabel || ""}`.trim() : `Add a table to round ${round}`}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Table" fullWidth value={table}
            onChange={(e) => setTable(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 20 } }}
            helperText="A number, or whatever the hall calls it." />

          {picker("Player", one, setOne, "Type a name, or pick somebody who has booked.")}
          {picker("Against", two, setTwo, "Leave this empty for a bye.")}

          {clash ? (
            <Typography variant="body2" sx={{ color: tokens.danger }}>
              That is the same player twice.
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!one.trim() || clash}
          onClick={() => onSave({
            matchId: match ? String(match.id) : "",
            tableLabel: table,
            playerOne: one,
            playerOneId: idOf(one),
            playerTwo: two,
            playerTwoId: two.trim() ? idOf(two) : "",
            position: String(position),
          })}>
          {match ? "Save table" : "Add table"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
