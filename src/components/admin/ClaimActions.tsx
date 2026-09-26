"use client";

import { useActionState, useState, useTransition } from "react";
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
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { claimReviewAction, type ClaimReviewState } from "@/app/admin/claims/actions";
import { tokens } from "@/lib/tokens";

/**
 * Hand the club over, or turn it down.
 *
 * Handing it over is irreversible and changes who controls a live club, so it
 * asks first and says what happens. Turning it down needs words, because the
 * claimant is told exactly what is typed here.
 */
export default function ClaimActions({
  id, clubName, claimantName,
}: {
  id: number;
  clubName: string;
  claimantName: string;
}) {
  const [state, act, working] =
    useActionState<ClaimReviewState, FormData>(claimReviewAction, {});
  useActionToast(state);

  const [, start] = useTransition();
  const [handing, setHanding] = useState(false);
  const [turning, setTurning] = useState(false);
  const [words, setWords] = useState("");

  const LIMIT = 600;
  const left = LIMIT - words.length;

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Stack spacing={1.5}>
      <Button variant="contained" fullWidth onClick={() => setHanding(true)}>
        Hand the club over
      </Button>

      <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
        {`${claimantName} becomes the owner and gets the console. Any other claim on `
          + "this club is closed at the same time."}
      </Typography>

      <Button variant="text" fullWidth onClick={() => setTurning(true)}
        sx={{ color: tokens.danger }}>
        Turn it down
      </Button>

      <ConfirmDialog
        open={handing}
        title={`Hand ${clubName} over?`}
        body={`${claimantName} becomes the owner: the console, the members, the events and the money all become theirs. Every other open claim on this club is turned down at the same time, and everybody is emailed. There is no undo.`}
        confirmLabel="Hand it over"
        cancelLabel="Not yet"
        busy={handing ? working : undefined}
        onConfirm={() => {
          const data = new FormData();
          data.set("id", String(id));
          data.set("intent", "approve");
          start(() => act(data));
        }}
        onClose={() => setHanding(false)}
      />

      <Dialog open={turning} onClose={working ? undefined : () => setTurning(false)}
        fullWidth maxWidth="sm" fullScreen={fullScreen}>
        <Box component="form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData();
            data.set("id", String(id));
            data.set("intent", "decline");
            data.set("note", words);
            start(() => act(data));
            setTurning(false);
          }}>
          <DialogTitle>Turn this claim down?</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                They are emailed your reason exactly as you type it. The club stays
                as it is and open to claims, so somebody else can still ask.
              </Typography>
              {/* Full width on its own row: a reason box squeezed into a button
                  column was narrower than its own label once already. */}
              <TextField
                label="Why"
                value={words}
                onChange={(e) => setWords(e.target.value)}
                required multiline minRows={4} fullWidth
                slotProps={{ htmlInput: { maxLength: LIMIT } }}
                helperText={left <= 120
                  ? `${left} character${left === 1 ? "" : "s"} left.`
                  : "Say enough that they know whether to send more, or to stop."}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setTurning(false)} color="inherit" disabled={working}>
              Cancel
            </Button>
            <SubmitButton label="Turn it down" pendingLabel="Turning it down"
              variant="contained" blocked={!words.trim()} pending={working}
              sx={{ backgroundColor: tokens.danger, color: "#fff",
                    "&:hover": { backgroundColor: "#8E1E18" } }} />
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
