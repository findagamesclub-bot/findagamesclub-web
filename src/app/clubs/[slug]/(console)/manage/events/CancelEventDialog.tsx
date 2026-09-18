"use client";

import { useEffect, useState } from "react";
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
import type { ManageEvent } from "@/utils/event-manage-filter";

/**
 * Calling an event off.
 *
 * A reason is required because it is the whole message: everybody holding a
 * ticket gets it, on the bell and by email, and "this event has been
 * cancelled" with nothing after it is the version that makes people ring up.
 */
export default function CancelEventDialog({
  event, saving, onClose, onConfirm,
}: {
  event: ManageEvent | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [reason, setReason] = useState("");

  // Cleared between events, so a reason typed for one does not turn up on the
  // next one somebody opens.
  useEffect(() => { if (event) setReason(""); }, [event]);

  const holders = event?.bookings ?? 0;

  return (
    <Dialog open={Boolean(event)} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>Call off {event?.title}?</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {holders
              ? `${holders} ${holders === 1 ? "person holds" : "people hold"} a place. `
                + "They are told straight away, and their bookings are cancelled with it."
              : "Nobody holds a place yet. The event stays on the site marked as called off, "
                + "so anybody who had it in their diary can see what happened."}
          </Typography>

          <TextField
            label="Why is it off" required multiline minRows={3} fullWidth autoFocus
            value={reason} onChange={(e) => setReason(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            helperText="This is the message they get. A venue falling through, not enough entries, whatever it is."
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Keep it on</Button>
        <Button variant="contained" color="error" disabled={!reason.trim()}
          loading={saving} loadingPosition="start"
          aria-label={saving ? "Calling the event off" : undefined}
          onClick={() => onConfirm(reason.trim())}>
          Call it off
        </Button>
      </DialogActions>
    </Dialog>
  );
}
