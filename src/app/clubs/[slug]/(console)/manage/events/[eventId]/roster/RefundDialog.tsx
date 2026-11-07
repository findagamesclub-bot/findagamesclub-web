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
import { formatMoney } from "@/utils/format";
import { PAYMENT_LABELS, type DoorRow } from "@/utils/door-list";
import { tokens } from "@/lib/tokens";

const METHODS = ["Cash", "Card", "Bank transfer", "PayPal", "Other"];

/**
 * The club gives the money back, and writes down how.
 *
 * The client, item 21e: "we should also allow the owner to mark the booking as
 * refunded, so it is clear for records when a payment was made, and when a
 * refund was then given and how."
 *
 * The status on its own has been here since 0092 and answers one of those
 * three. The payment beside it has carried a method and a note the whole time,
 * so this is the same dialog asking the same two questions about the money
 * going the other way — which is also why the methods are the same list, and
 * not a second vocabulary for one idea.
 *
 * The date is not asked for. 0224 stamps it, the way `paid_at` has been
 * stamped since 0092: when the money went back is a fact about the row, not
 * something a form should be able to name.
 *
 * The note is uncontrolled and seeded by remounting on the booking's id,
 * because a controlled MUI `multiline` field drops the character that wraps a
 * line. 0185 measured that rather than guessing at it.
 */
export default function RefundDialog({
  row, saving, onClose, onSave,
}: {
  row: DoorRow | null;
  saving: boolean;
  onClose: () => void;
  onSave: (fields: { refundMethod: string; refundNote: string }) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [method, setMethod] = useState("Cash");
  const note = useRef<HTMLTextAreaElement>(null);

  useWhenChanged([row], () => {
    if (!row) return;
    // However it came in is how it most often goes back, so that is what is
    // already chosen. A club that took a transfer refunds a transfer.
    setMethod(METHODS.find((one) => one === row.paymentMethod) ?? "Cash");
  });

  return (
    <Dialog open={Boolean(row)} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>{row?.fullName || "This booking"}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {/* What was taken, so the club is not working from memory about the
              figure they are giving back. */}
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {row
              ? `${formatMoney(row.total, "GBP")} was taken`
                + `${row.paymentMethod ? ` by ${row.paymentMethod.toLowerCase()}` : ""}`
                + `${row.paymentStatus !== "unpaid"
                    ? ` (${PAYMENT_LABELS[row.paymentStatus].toLowerCase()})` : ""}. `
              : ""}
            Today&apos;s date goes on the record for you.
          </Typography>

          <TextField select label="How it went back" fullWidth value={method}
            onChange={(event) => setMethod(event.target.value)}>
            {METHODS.map((one) => <MenuItem key={one} value={one}>{one}</MenuItem>)}
          </TextField>

          <TextField key={row?.bookingId ?? 0} label="Note" fullWidth
            multiline minRows={2} inputRef={note}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            helperText="A reference, or who sent it. The member sees this on their ticket." />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" loading={saving} loadingPosition="start"
          aria-label={saving ? "Saving the refund" : undefined}
          onClick={() => onSave({
            refundMethod: method, refundNote: note.current?.value ?? "",
          })}>
          Mark as refunded
        </Button>
      </DialogActions>
    </Dialog>
  );
}
