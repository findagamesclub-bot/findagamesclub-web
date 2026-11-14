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
import { nightLabel } from "@/utils/dates";
import { tableNumber } from "@/utils/table-number";
import Divider from "@mui/material/Divider";
import {
  TABLE_PAYMENT_LABELS, type TableBookingRow, type TablePaymentStatus,
} from "@/utils/table-bookings";
import { REFUND_STATES } from "@/utils/coaching-bookings-filter";
import type { RefundStatus } from "@/utils/refund-status";
import { tokens } from "@/lib/tokens";

const METHODS = ["Cash", "Card", "Bank transfer", "PayPal", "Other"];

/**
 * What the club took for a table.
 *
 * The same three states and the same words an event booking uses, because it
 * is the same question asked about a different thing and rule 11 says a status
 * is one tag drawn one way everywhere.
 *
 * The note is uncontrolled and seeded by remounting on the booking's id: a
 * controlled MUI `multiline` field drops the character that wraps a line,
 * which 0185 measured rather than guessed at.
 */
export default function TablePaymentDialog({
  row, saving, onClose, onSave,
}: {
  row: TableBookingRow | null;
  saving: boolean;
  onClose: () => void;
  onSave: (fields: {
    paymentStatus: string; method: string; note: string;
    refundStatus: string; refundMethod: string; refundNote: string;
  }) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [status, setStatus] = useState<TablePaymentStatus>("paid_on_the_door");
  const [method, setMethod] = useState("Cash");
  const note = useRef<HTMLTextAreaElement>(null);
  const [refund, setRefund] = useState<RefundStatus>("not_due");
  const [refundMethod, setRefundMethod] = useState("Cash");
  const refundNote = useRef<HTMLTextAreaElement>(null);

  useWhenChanged([row], () => {
    if (!row) return;
    // Paid on the door is the answer most of the time, so it is already
    // chosen. An unpaid row opening on "unpaid" needs two taps to do the
    // ordinary thing.
    setStatus(row.paymentStatus === "unpaid" ? "paid_on_the_door" : row.paymentStatus);
    setMethod(row.paymentMethod || "Cash");
    setRefund(row.refundStatus);
    // However it came in is how it usually goes back, which is the same
    // default the event refund dialog settled on in 0224.
    setRefundMethod(row.refundMethod || row.paymentMethod || "Cash");
  });

  return (
    <Dialog open={Boolean(row)} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>{row?.bookedName || "This table"}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {/* Whose half, not the table's total. 0221 split the fee between
              the people on it, so "£5 for table 1" over a £2.50 figure was
              the dialog contradicting the row that opened it. */}
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {row
              ? `${formatMoney(row.total, row.priced.currency ?? "GBP")}, `
                + `${row.opponentName ? `${row.bookedName}'s half of table` : "the whole of table"} `
                + `${tableNumber(row.tableIndex)} on ${nightLabel(row.sessionDate)}.`
              : ""}
            {row?.opponentName
              ? ` ${row.opponentName} settles their own half separately.`
              : ""}
          </Typography>

          <TextField select label="Payment" fullWidth value={status}
            onChange={(e) => setStatus(e.target.value as TablePaymentStatus)}>
            {(Object.keys(TABLE_PAYMENT_LABELS) as TablePaymentStatus[]).map((key) => (
              <MenuItem key={key} value={key}>{TABLE_PAYMENT_LABELS[key]}</MenuItem>
            ))}
          </TextField>

          {status !== "unpaid" ? (
            <>
              <TextField select label="How" fullWidth value={method}
                onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((one) => <MenuItem key={one} value={one}>{one}</MenuItem>)}
              </TextField>

              <TextField key={row?.bookingId ?? 0} label="Note" fullWidth
                multiline minRows={2} defaultValue={row?.paymentNote ?? ""}
                inputRef={note}
                slotProps={{ htmlInput: { maxLength: 500 } }}
                helperText="A reference, or who took the money. The member sees this." />
            </>
          ) : (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              Setting it back to unpaid clears the date it was paid on, so a row marked
              by mistake keeps nothing. Nobody is emailed either way.
            </Typography>
          )}

          {/* Money going back, the client's item 15. Only on a half that was
              actually paid: a refund on a half nobody settled is money
              leaving that never arrived, and the database refuses it anyway.
              A called-off table keeps this, because afterwards is exactly
              when a club gives money back. */}
          {row && row.paymentStatus !== "unpaid" ? (
            <>
              <Divider />
              <TextField select label="Money back" fullWidth value={refund}
                onChange={(e) => setRefund(e.target.value as RefundStatus)}>
                {REFUND_STATES.map((one) => (
                  <MenuItem key={one.value} value={one.value}>{one.label}</MenuItem>
                ))}
              </TextField>

              {refund === "refunded" ? (
                <>
                  <TextField select label="How it went back" fullWidth
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}>
                    {METHODS.map((one) => (
                      <MenuItem key={one} value={one}>{one}</MenuItem>
                    ))}
                  </TextField>
                  <TextField key={`r${row.bookingId}${row.side}`} label="Refund note"
                    fullWidth multiline minRows={2}
                    defaultValue={row.refundNote}
                    inputRef={refundNote}
                    slotProps={{ htmlInput: { maxLength: 300 } }}
                    helperText="Today's date goes on the record for you." />
                </>
              ) : null}
            </>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" loading={saving} loadingPosition="start"
          aria-label={saving ? "Saving the payment" : undefined}
          onClick={() => onSave({
            paymentStatus: status,
            method: status === "unpaid" ? "" : method,
            note: status === "unpaid" ? "" : (note.current?.value ?? ""),
            // Unpaid takes the refund with it: there is nothing to give back
            // on a half the club is no longer saying it took.
            refundStatus: status === "unpaid" ? "not_due" : refund,
            refundMethod: refund === "refunded" ? refundMethod : "",
            refundNote: refund === "refunded" ? (refundNote.current?.value ?? "") : "",
          })}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
