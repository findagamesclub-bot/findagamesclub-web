"use client";

import { useRef, useState } from "react";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { PAYMENT_WAYS } from "@/utils/money-events";
import { tokens } from "@/lib/tokens";

/**
 * How the money went back on an order, and why.
 *
 * The client's item 18: a club marking an order refunded could write why in
 * the note box underneath, which is the club's own working log and has been
 * since 0020. The member never saw a word of it. This takes the two questions
 * that belong to the refund itself, which the member does read.
 *
 * The same pair, in the same order and the same words, as the table booking
 * and coaching dialogs. A club that has learned one of them has learned all
 * three.
 *
 * It also reopens on a refund already recorded (0238). A status select fires
 * no change when the status it is given is the one already set, so a club
 * that had marked an order refunded had no way back to this at all, and the
 * only writable box left was the club's own log.
 */
export default function OrderRefundDialog({
  open, orderId, refundDue, editing = false,
  method: was = "", note: wasNote = "", saving, onClose, onSave,
}: {
  open: boolean;
  /** Which order the fields belong to, so reopening on another resets them. */
  orderId: number;
  /** "Refund due" is money still owed, so it asks why and not how. */
  refundDue: boolean;
  /** Changing a refund the member can already read, rather than making one. */
  editing?: boolean;
  method?: string;
  note?: string;
  saving: boolean;
  onClose: () => void;
  onSave: (method: string, note: string) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [method, setMethod] = useState<string>("Cash");
  const note = useRef<HTMLTextAreaElement>(null);

  // During render, not in an effect: an effect runs after paint, so opening
  // on a second order shows the first order's method for a frame.
  useWhenChanged([open, orderId, was], () => setMethod(was || "Cash"));

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        {editing ? "Edit the refund"
          : refundDue ? "Mark a refund as owed" : "Record a refund"}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {editing
              ? "This replaces what the member reads on their own order. The "
                + "change is logged, so the old wording is not lost."
              : refundDue
                ? "This says the money is owed back and has not gone yet. The "
                  + "member sees it, and what you write here."
                : "Today's date goes on the record for you. The member sees this "
                  + "on their own order, so write it for them."}
          </Typography>

          {/* Only once the money has actually gone. "How it went back" on a
              refund that has not happened is a question with no answer. */}
          {!refundDue ? (
            <TextField select label="How it went back" fullWidth value={method}
              onChange={(event) => setMethod(event.target.value)}>
              {PAYMENT_WAYS.map((one) => (
                <MenuItem key={one} value={one}>{one}</MenuItem>
              ))}
            </TextField>
          ) : null}

          {/* Uncontrolled, because a controlled MUI multiline drops the
              character that wraps a line. 0185 measured that rather than
              guessing at it. */}
          <TextField label="Refund note" fullWidth multiline minRows={2}
            inputRef={note} defaultValue={wasNote}
            slotProps={{ htmlInput: { maxLength: 300 } }}
            placeholder="Refunded in person on games night"
            helperText="The member reads this on their order." />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" loading={saving} loadingPosition="start"
          aria-label={saving ? "Saving the refund" : undefined}
          onClick={() => onSave(
            refundDue ? "" : method, note.current?.value ?? "")}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
