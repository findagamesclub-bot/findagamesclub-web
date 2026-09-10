"use client";

import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { fold } from "@/utils/text";

/**
 * Confirmation for something that cannot be undone from inside the app.
 *
 * Typing the name is not friction for its own sake. Handing a club on is one
 * click away from a button that also cancels invitations and changes roles, and
 * the person who does it by accident cannot put it back without asking whoever
 * now owns it. A dialog you dismiss with the same reflex that opened it is not
 * a check.
 */
export default function TypedConfirmDialog({
  open, title, body, phrase, confirmLabel, busy, onConfirm, onClose,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  /** What has to be typed, usually the club's name. */
  phrase: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = fold(typed) === fold(phrase);

  const shut = () => { setTyped(""); onClose(); };

  // Shuts itself once the work is done, so the caller does not close it on the
  // same click that started the action and hide its own spinner.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (busy) setStarted(true);
    else if (started) { setStarted(false); shut(); }
    // shut is stable enough here: it only closes and clears the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, started]);

  return (
    <Dialog open={open} onClose={busy ? undefined : shut} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: "0.95rem", mb: 2 }}>{body}</DialogContentText>
        <TextField
          fullWidth
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          label="Type the club's name"
          helperText={`Type ${phrase} to confirm`}
          slotProps={{ htmlInput: { "aria-label": `Type ${phrase} to confirm` } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {/* Not reachable while the work is running: cancelling something
            already sent cannot undo it, and offering the button says it can. */}
        <Button onClick={shut} variant="text" disabled={busy}>Cancel</Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          loading={busy ?? false}
          loadingPosition="start"
          disabled={!matches}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
