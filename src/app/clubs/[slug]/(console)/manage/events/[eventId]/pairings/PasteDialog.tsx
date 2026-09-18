"use client";

import { useEffect, useMemo, useState } from "react";
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
import { parsePastedPairings, pasteSummary } from "@/utils/pairings-paste";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * A draw out of a spreadsheet.
 *
 * The preview is the whole point: it says what was understood before anything
 * is saved, so a paste that lost a column is caught in the dialog rather than
 * on the tables.
 */
export default function PasteDialog({
  open, saving, round, onClose, onSave,
}: {
  open: boolean;
  saving: boolean;
  round: number;
  onClose: () => void;
  onSave: (raw: string) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [raw, setRaw] = useState("");

  useEffect(() => { if (open) setRaw(""); }, [open]);

  const parsed = useMemo(() => parsePastedPairings(raw), [raw]);
  const usable = parsed.filter((match) => !match.problem).length;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>Paste round {round}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Paste the draw here" fullWidth multiline minRows={6} autoFocus
            value={raw} onChange={(e) => setRaw(e.target.value)}
            slotProps={{ htmlInput: { style: { fontFamily: mono, fontSize: "0.85rem" } } }}
            helperText="Straight out of a spreadsheet, or typed. A table number is optional, and one name on a line is a bye."
          />

          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Four shapes are understood: a table number and two names, two names,
            &quot;Ann vs Ben&quot;, or a row out of a CSV.
          </Typography>

          {parsed.length ? (
            <Stack spacing={1}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                                letterSpacing: "0.1em", color: tokens.inkMuted }}>
                {pasteSummary(parsed).toUpperCase()}
              </Typography>

              <Box sx={{ maxHeight: 280, overflowY: "auto", borderRadius: 1.5,
                         border: `1px solid ${tokens.rule}` }}>
                {parsed.map((match, index) => (
                  <Box key={index}
                    sx={{ display: "grid", gap: 1, alignItems: "center", px: 1.5, py: 1,
                          gridTemplateColumns: "auto minmax(0, 1fr)",
                          borderBottom: index === parsed.length - 1
                            ? "none" : `1px solid ${tokens.rule}`,
                          backgroundColor: match.problem ? tokens.brassSoft : "transparent" }}>
                    <Typography sx={{ fontFamily: mono, fontSize: "0.75rem",
                                      color: tokens.inkMuted, minWidth: 24 }}>
                      {match.table}
                    </Typography>
                    <Stack spacing={0.2} sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontFamily: display, fontSize: "0.9rem" }} noWrap>
                        {match.playerOne || "—"}
                        {match.playerTwo ? ` v ${match.playerTwo}` : " (bye)"}
                      </Typography>
                      {match.problem ? (
                        <Typography variant="caption" sx={{ color: tokens.ink }}>
                          {match.problem} This line will be left out.
                        </Typography>
                      ) : null}
                    </Stack>
                  </Box>
                ))}
              </Box>
            </Stack>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" disabled={!usable}
          loading={saving} loadingPosition="start"
          aria-label={saving ? "Saving the draw" : undefined}
          onClick={() => onSave(raw)}>
          {usable ? `Save ${usable} ${usable === 1 ? "table" : "tables"}` : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
