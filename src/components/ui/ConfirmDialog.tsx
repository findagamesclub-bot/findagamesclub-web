"use client";

import { useEffect, useState } from "react";
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
  destructive = false, busy, onConfirm, onClose,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * Whether the work this dialog started is still running.
   *
   * Left undefined by a caller with nothing to wait for, and that is the
   * difference the dialog acts on: told about progress, it stays open until
   * the work finishes, so the spinner is actually seen. It used to close on
   * the same click that started the action, which meant `busy` could never
   * render and every confirmation looked like nothing had happened.
   */
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const reportsProgress = busy !== undefined;
  const [started, setStarted] = useState(false);

  // Shuts itself once the work is done, so the caller does not have to thread
  // the same condition through a second time.
  useEffect(() => {
    if (busy) setStarted(true);
    else if (started) { setStarted(false); onClose(); }
  }, [busy, started, onClose]);
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: "0.95rem" }}>{body}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {/* Keeping things as they are is the safe default, so it takes the
            quiet treatment and the destructive choice has to be reached for. */}
        {/* Not reachable while the work is running: cancelling something that
            has already been sent cannot undo it, and offering the button says
            it can. */}
        <Button onClick={onClose} variant="text" disabled={busy}>{cancelLabel}</Button>
        <Button
          onClick={() => {
            onConfirm();
            if (!reportsProgress) onClose();
          }}
          variant="contained"
          color={destructive ? "error" : "primary"}
          loading={busy ?? false}
          loadingPosition="start"
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
