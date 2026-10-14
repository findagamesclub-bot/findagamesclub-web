"use client";

import { useMemo, useState } from "react";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ScrollBox from "@/components/ui/ScrollBox";
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

  useWhenChanged([open], () => { if (open) setRaw(""); });

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

          {/* The list of four shapes named them and showed none of them, and
              the client asked for a line they could copy. A worked example is
              what a format description is for: read it once and you know
              whether your spreadsheet will paste. Set in mono, because the
              thing being demonstrated is a layout of columns. */}
          <Stack spacing={1}
            sx={{ p: 1.75, borderRadius: 1.5, backgroundColor: tokens.surface,
                  border: `1px solid ${tokens.rule}` }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                              letterSpacing: "0.1em", color: tokens.inkMuted }}>
              FOUR SHAPES, ALL UNDERSTOOD
            </Typography>
            <Box component="pre" sx={{ m: 0, fontFamily: mono, fontSize: "0.78rem",
                                       lineHeight: 1.7, color: tokens.ink,
                                       whiteSpace: "pre-wrap" }}>
{`1   Ann Shah      Ben Lowe     a table number and two names
Ann Shah          Ben Lowe     two names, tables numbered from 1
Ann Shah vs Ben Lowe           typed by hand
1, Ann Shah, Ben Lowe          straight out of a CSV`}
            </Box>
            <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
              The gaps above are tabs, which is what a spreadsheet pastes. One
              name on a line is a bye.
            </Typography>
          </Stack>

          {parsed.length ? (
            <Stack spacing={1}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                                letterSpacing: "0.1em", color: tokens.inkMuted }}>
                {pasteSummary(parsed).toUpperCase()}
              </Typography>

              <ScrollBox cap={280} label={`${parsed.length} tables read from the paste`}
                sx={{ borderRadius: 1.5, border: `1px solid ${tokens.rule}` }}>
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
              </ScrollBox>
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
