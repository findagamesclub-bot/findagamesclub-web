"use client";

import { useEffect, useState } from "react";
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
import { PAYMENT_LABELS, type DoorRow, type PaymentStatus } from "@/utils/door-list";
import { formatMoney } from "@/utils/format";
import { tokens } from "@/lib/tokens";

const METHODS = ["Cash", "Card", "Bank transfer", "PayPal", "Other"];

/**
 * What the club has written down about the money.
 *
 * Nothing here takes payment, so this is a record of what happened in the
 * room. Marking somebody as paid emails them a receipt, because being told
 * beats finding out.
 */
export default function PaymentDialog({
  row, saving, onClose, onSave,
}: {
  row: DoorRow | null;
  saving: boolean;
  onClose: () => void;
  onSave: (fields: Record<string, string>) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));

  const [status, setStatus] = useState<PaymentStatus>("paid_on_the_door");
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!row) return;
    // Paid on the door is the answer most of the time, so it is the one
    // already selected. An unpaid row opening on "unpaid" would need two taps
    // to do the ordinary thing.
    setStatus(row.paymentStatus === "unpaid" ? "paid_on_the_door" : row.paymentStatus);
    setMethod(row.paymentMethod || "Cash");
    setNote("");
  }, [row]);

  return (
    <Dialog open={Boolean(row)} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>{row?.fullName || "This booking"}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {row ? `${formatMoney(row.total, "GBP")} for ${row.tickets} `
              + `${row.tickets === 1 ? "ticket" : "tickets"}.` : ""}
            {" "}They get an email saying what you recorded.
          </Typography>

          <TextField select label="Payment" fullWidth value={status}
            onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
            {(Object.keys(PAYMENT_LABELS) as PaymentStatus[]).map((key) => (
              <MenuItem key={key} value={key}>{PAYMENT_LABELS[key]}</MenuItem>
            ))}
          </TextField>

          {status !== "unpaid" ? (
            <>
              <TextField select label="How" fullWidth value={method}
                onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((one) => <MenuItem key={one} value={one}>{one}</MenuItem>)}
              </TextField>

              <TextField label="Note" fullWidth multiline minRows={2}
                value={note} onChange={(e) => setNote(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 500 } }}
                helperText="Only your team sees this. A reference, or who took the money." />
            </>
          ) : (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              Setting it back to unpaid clears the date it was paid on. No email is sent.
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" loading={saving} loadingPosition="start"
          aria-label={saving ? "Saving the payment" : undefined}
          onClick={() => onSave({
            paymentStatus: status,
            method: status === "unpaid" ? "" : method,
            note: status === "unpaid" ? "" : note,
          })}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
