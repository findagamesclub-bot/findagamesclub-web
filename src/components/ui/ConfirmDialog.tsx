"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

/**
 * Ask before doing something that is hard to take back.
 *
 * The body says what will actually happen rather than "are you sure" — somebody
 * cancelling a coaching slot needs to know the people booked on it stay on the
 * record, and a confirmation that does not say so is just a speed bump.
 */
export default function ConfirmDialog({
  open, title, body, confirmLabel, cancelLabel = "Keep it",
  destructive = false, busy = false, onConfirm, onClose,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: "0.95rem" }}>{body}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {/* Keeping things as they are is the safe default, so it takes the
            quiet treatment and the destructive choice has to be reached for. */}
        <Button onClick={onClose} variant="text">{cancelLabel}</Button>
        <Button
          onClick={() => { onConfirm(); onClose(); }}
          variant="contained"
          color={destructive ? "error" : "primary"}
          loading={busy}
          loadingPosition="start"
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
