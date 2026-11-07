"use client";

import { useRef, useState } from "react";
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
import { useWhenChanged } from "@/hooks/useWhenChanged";
import { nightLabel } from "@/utils/dates";
import { formatMoney } from "@/utils/format";
import {
  COACHING_PAYMENT_STATES, type CoachingBookingRow,
} from "@/utils/coaching-bookings-filter";
import { tokens } from "@/lib/tokens";

/**
 * What the club took for a coaching place, and what it wants to remember.
 *
 * The client asked for the note: a club takes the money in cash on the night,
 * by transfer a week early, or half and half, and `payment_status` is one word
 * with no room for any of it. The club remembers for a fortnight and then
 * cannot answer the member who asks.
 *
 * The same dialog a table booking and an event ticket already get, minus the
 * two things coaching does not have: there is no `payment_method` column and
 * no "on the door" against "in advance", so it is a pair rather than a trio.
 *
 * The note is uncontrolled and seeded by remounting on the booking's id,
 * because a controlled MUI `multiline` field drops the character that wraps a
 * line. 0185 measured that rather than guessing at it.
 */
export default function CoachingPaymentDialog({
  row, saving, onClose, onSave,
}: {
  row: CoachingBookingRow | null;
  saving: boolean;
  onClose: () => void;
  onSave: (fields: { paid: boolean; note: string }) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [status, setStatus] = useState("paid");
  const note = useRef<HTMLTextAreaElement>(null);

  useWhenChanged([row], () => {
    if (!row) return;
    // Paid, whichever state the row is in. It is the answer nearly every time
    // this is opened — on an unpaid place because that is the thing being
    // recorded, and on a paid one because the club is here to fix the note.
    // Reset per row, or an Unpaid chosen once is waiting on the next member.
    setStatus("paid");
  });

  const paid = status === "paid";

  return (
    <Dialog open={Boolean(row)} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>{row?.name || "This place"}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {row
              ? `${row.total > 0
                  ? formatMoney(row.total, row.priced.currency ?? "GBP")
                  : "No charge"} for ${row.title} on ${nightLabel(row.date)}.`
              : ""}
          </Typography>

          <TextField select label="Payment" fullWidth value={status}
            onChange={(event) => setStatus(event.target.value)}>
            {COACHING_PAYMENT_STATES.map((one) => (
              <MenuItem key={one.value} value={one.value}>{one.label}</MenuItem>
            ))}
          </TextField>

          {paid ? (
            <TextField key={row?.id ?? 0} label="Note" fullWidth
              multiline minRows={2} defaultValue={row?.paymentNote ?? ""}
              inputRef={note}
              slotProps={{ htmlInput: { maxLength: 300 } }}
              helperText="A reference, or who took the money. The member sees this." />
          ) : (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              Setting it back to unpaid clears the date it was paid on and the note
              with it, since the note is about a payment that is no longer recorded.
              Nobody is emailed either way.
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" loading={saving} loadingPosition="start"
          aria-label={saving ? "Saving the payment" : undefined}
          onClick={() => onSave({ paid, note: paid ? (note.current?.value ?? "") : "" })}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
