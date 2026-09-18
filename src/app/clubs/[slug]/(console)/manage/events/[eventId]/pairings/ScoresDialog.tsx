"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
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
import { display, mono, tokens } from "@/lib/tokens";
import type { PairingMatch } from "@/types/eventEditor";

type Row = { id: number; scoreOne: string; scoreTwo: string };

/**
 * Every score in the round, in one screen.
 *
 * Twenty tables and ten minutes is the case this is built for, and twenty
 * dialogs is what makes that ten minutes twenty. Full screen on a phone
 * because that is where somebody standing in the hall will do it.
 *
 * Scores are held as strings so a box can be emptied: a number coerced on
 * every keystroke means the 0 cannot be backspaced away, which is how a
 * mis-entered result gets taken back.
 */
export default function ScoresDialog({
  open, saving, round, matches, onClose, onSave,
}: {
  open: boolean;
  saving: boolean;
  round: number;
  matches: PairingMatch[];
  onClose: () => void;
  onSave: (rows: Row[]) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!open) return;
    setRows(matches.map((match) => ({
      id: match.id,
      scoreOne: match.scoreOne === null ? "" : String(match.scoreOne),
      scoreTwo: match.scoreTwo === null ? "" : String(match.scoreTwo),
    })));
  }, [open, matches]);

  const set = (id: number, side: "scoreOne" | "scoreTwo", value: string) =>
    setRows((current) => current.map((row) =>
      row.id === id ? { ...row, [side]: value.replace(/[^0-9]/g, "").slice(0, 4) } : row));

  const filled = rows.filter((row) => row.scoreOne !== "" || row.scoreTwo !== "").length;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>Round {round} scores</DialogTitle>

      <DialogContent>
        <Stack spacing={1.25} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Leave both boxes empty for a table nobody has finished. Clearing a score takes
            it back.
          </Typography>

          {matches.map((match) => {
            const row = rows.find((seen) => seen.id === match.id);
            const bye = !match.playerTwo.trim();

            return (
              <Box key={match.id}
                sx={{ display: "grid", gap: 1, alignItems: "center",
                      gridTemplateColumns: "auto minmax(0, 1fr) 72px 72px" }}>
                <Typography sx={{ fontFamily: mono, fontSize: "0.75rem",
                                  color: tokens.inkMuted, minWidth: 24 }}>
                  {match.tableLabel || "—"}
                </Typography>

                <Stack spacing={0} sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontFamily: display, fontSize: "0.85rem" }} noWrap>
                    {match.playerOne}
                  </Typography>
                  <Typography sx={{ fontFamily: display, fontSize: "0.85rem",
                                    color: bye ? tokens.inkMuted : undefined }} noWrap>
                    {bye ? "bye" : match.playerTwo}
                  </Typography>
                </Stack>

                <TextField size="small" value={row?.scoreOne ?? ""}
                  onChange={(e) => set(match.id, "scoreOne", e.target.value)}
                  slotProps={{ htmlInput: {
                    inputMode: "numeric", "aria-label": `${match.playerOne} score` } }} />
                <TextField size="small" value={row?.scoreTwo ?? ""} disabled={bye}
                  onChange={(e) => set(match.id, "scoreTwo", e.target.value)}
                  slotProps={{ htmlInput: {
                    inputMode: "numeric",
                    "aria-label": `${match.playerTwo || "Bye"} score` } }} />
              </Box>
            );
          })}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" loading={saving} loadingPosition="start"
          aria-label={saving ? "Saving the scores" : undefined}
          onClick={() => onSave(rows)}>
          {`Save ${filled} ${filled === 1 ? "result" : "results"}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
