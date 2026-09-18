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
import SubmitButton from "@/components/ui/SubmitButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useActionToast } from "@/components/ui/Toaster";
import { reviewAction, type ReviewState } from "@/app/admin/submissions/[id]/actions";
import { tokens } from "@/lib/tokens";

/**
 * Approve it, send it back, or decline it.
 *
 * The two that need words open a dialog rather than an inline expander, which
 * is rule 5 of the checklist and matters here: the reason box needs the width
 * of a row, and squeezing it beside three buttons is exactly the mistake that
 * got caught in Stage 2.
 *
 * Approve needs no words, so it does not ask for any. It does ask, though. It
 * is the only irreversible thing on the screen and it was the only one with no
 * friction at all: one press published a club, emailed the owner and handed
 * over the console, and it sat directly under a panel somebody had just been
 * reading. The dialog says what happens rather than "are you sure".
 */
export default function ReviewActions({
  id, clubName, ready, missing,
}: {
  id: number;
  clubName: string;
  /** All eight checks pass. */
  ready: boolean;
  missing: number;
}) {
  const [state, submit, pending] = useActionState<ReviewState, FormData>(reviewAction, {});
  useActionToast(state);

  const [asking, setAsking] = useState<"changes" | "decline" | null>(null);
  const [words, setWords] = useState("");
  const [publishing, setPublishing] = useState(false);

  // Dispatched from a click rather than through a form's `action`, so it needs
  // a transition of its own.
  const [, startPublish] = useTransition();

  /**
   * A cap on what can be written, not only on what is shown.
   *
   * A thousand words pasted into a note ran the review screen for several
   * thousand pixels and pushed Approve off the bottom of it. Containing that
   * where it renders is the fix for text already written; this is the fix for
   * writing it, and it is the kinder one: a note somebody has to read and act
   * on is a paragraph, not an essay.
   */
  const LIMIT = 600;
  const left = LIMIT - words.length;

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const close = () => { setAsking(null); setWords(""); };

  return (
    <Stack spacing={1.5}>
      <Button variant="contained" fullWidth disabled={!ready}
        onClick={() => setPublishing(true)}>
        Approve and publish
      </Button>

      <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
        {ready
          ? `${clubName} goes into the directory straight away and the console becomes theirs.`
          : `${missing} ${missing === 1 ? "check is" : "checks are"} still failing. Send it back rather than approving it.`}
      </Typography>

      <Button variant="outlined" fullWidth onClick={() => setAsking("changes")}>
        Send it back with a note
      </Button>

      <Button variant="text" fullWidth onClick={() => setAsking("decline")}
        sx={{ color: tokens.danger }}>
        Decline it
      </Button>

      <ConfirmDialog
        open={publishing}
        title={`Publish ${clubName}?`}
        body={`${clubName} goes into the directory straight away with a page of its own, `
          + "the owner is emailed, and the console becomes theirs. There is no undo."}
        confirmLabel="Approve and publish"
        cancelLabel="Not yet"
        busy={publishing ? pending : undefined}
        onConfirm={() => {
          const data = new FormData();
          data.set("id", String(id));
          data.set("intent", "approve");
          startPublish(() => submit(data));
        }}
        onClose={() => setPublishing(false)}
      />

      <Dialog open={asking !== null} onClose={close} fullWidth maxWidth="sm"
        fullScreen={fullScreen}>
        <Box component="form" action={submit}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="intent" value={asking ?? ""} />

          <DialogTitle>
            {asking === "decline" ? "Decline this listing?" : "What needs changing?"}
          </DialogTitle>

          <DialogContent>
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                {asking === "decline"
                  ? "This ends it. They are emailed your reason and cannot send this one again, so say enough that they know whether to try a different way."
                  : "They get this in an email and see it at the top of their listing when they open it back up. Everything they typed is kept."}
              </Typography>

              {/* Full width on its own row. A reason box squeezed into a button
                  column was narrower than its own label once already. */}
              <TextField
                name={asking === "decline" ? "reason" : "note"}
                label={asking === "decline" ? "Reason" : "What to change"}
                value={words}
                onChange={(e) => setWords(e.target.value)}
                required
                multiline
                minRows={4}
                fullWidth
                slotProps={{ htmlInput: { maxLength: LIMIT } }}
                helperText={left <= 120
                  ? `${left} character${left === 1 ? "" : "s"} left.`
                  : asking === "decline"
                    ? "Written to them exactly as you type it."
                    : "Be specific. \"Add a postcode and one photo\" beats \"needs more detail\"."}
              />
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={close} color="inherit" disabled={pending}>Cancel</Button>
            <SubmitButton
              label={asking === "decline" ? "Decline it" : "Send it back"}
              pendingLabel={asking === "decline" ? "Declining the listing" : "Sending it back"}
              variant="contained"
              blocked={!words.trim()}
              sx={asking === "decline"
                ? { backgroundColor: tokens.danger, color: "#fff",
                    "&:hover": { backgroundColor: "#8E1E18" } }
                : undefined}
            />
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
