"use client";

import { useActionState, useState, useTransition } from "react";
import Box from "@mui/material/Box";
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
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { correctPaymentAction, type BillingState } from "@/app/admin/billing/actions";
import { PAYMENT_METHODS } from "@/utils/listing-billing";
import { REFUND_LABELS, REFUND_STATUSES } from "@/utils/refund-status";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import { mono, tokens } from "@/lib/tokens";

export type EditablePayment = {
  id: number;
  amountPence: number;
  method: string;
  paidAt: string;
  reference: string;
  note: string;
  refundStatus: string;
  refundMethod: string;
  refundNote: string;
};

/**
 * Putting a listing payment right, and saying whether money went back.
 *
 * The same two sections, in the same order, as the club's own renewal dialog.
 * An admin and a club owner are doing the same job on different ledgers, and a
 * screen each would be two things to learn for no reason.
 *
 * The amount here is unlocked where a renewal's is not: a renewal stacks its
 * period onto the one before it, so changing an older figure leaves everything
 * after it wrong. A listing payment carries its own period, written when it
 * was recorded, so correcting a figure corrects one row.
 */
export default function EditPaymentDialog({
  payment, subscription, clubName, onClose,
}: {
  /** Null closes it. Held by the caller so the fields seed from one row. */
  payment: EditablePayment | null;
  subscription: number;
  clubName: string;
  onClose: () => void;
}) {
  const [state, act, working] =
    useActionState<BillingState, FormData>(correctPaymentAction, {});
  useActionToast(state);

  const [, start] = useTransition();
  const [refund, setRefund] = useState(payment?.refundStatus ?? "not_due");
  // During render, not in an effect: an effect runs after paint, so opening
  // the dialog on a second payment would show the first one's refund state
  // for a frame. `useWhenChanged` is the house answer to that.
  useWhenChanged([payment], () => {
    if (payment) setRefund(payment.refundStatus);
  });

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const shown = payment;

  return (
    <Dialog open={payment !== null} onClose={working ? undefined : onClose}
      fullWidth maxWidth="sm" fullScreen={fullScreen}>
      {shown ? (
        <Box component="form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            data.set("payment", String(shown.id));
            data.set("subscription", String(subscription));
            start(() => act(data));
            onClose();
          }}>
          <DialogTitle>{`Put this payment right · ${clubName}`}</DialogTitle>

          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                The correction is marked on the row and the club sees the same
                history. Nothing is deleted, here or anywhere else on the ledger.
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField key={`a${shown.id}`} name="amount" label="Amount" required
                  fullWidth defaultValue={(shown.amountPence / 100).toFixed(2)}
                  helperText="In pounds." />
                <TextField key={`d${shown.id}`} name="paidAt" label="Paid on" type="date"
                  required fullWidth defaultValue={shown.paidAt.slice(0, 10)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  helperText="The date on the cheque or the transfer." />
              </Stack>

              <TextField key={`m${shown.id}`} name="method" label="How" select required
                fullWidth defaultValue={shown.method || "other"}
                helperText="What it arrived as.">
                {PAYMENT_METHODS.map((m) => (
                  <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                ))}
              </TextField>

              <TextField key={`r${shown.id}`} name="reference" label="Reference" fullWidth
                defaultValue={shown.reference}
                helperText="A cheque number or a bank reference." />

              <TextField key={`n${shown.id}`} name="note" label="Note" fullWidth multiline
                minRows={2} defaultValue={shown.note}
                helperText="Anything worth remembering about this one." />

              <Box sx={{ pt: 1.5, borderTop: `1px solid ${tokens.rule}` }}>
                <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                  letterSpacing: "0.08em", color: tokens.inkMuted, mb: 1.5 }}>
                  MONEY GOING BACK
                </Typography>

                <Stack spacing={2}>
                  <TextField name="refundStatus" label="Refund" select fullWidth
                    value={refund} onChange={(e) => setRefund(e.target.value)}
                    helperText="Marking it refunded stamps today's date on the row.">
                    {REFUND_STATUSES.map((one) => (
                      <MenuItem key={one} value={one}>{REFUND_LABELS[one]}</MenuItem>
                    ))}
                  </TextField>

                  {refund !== "not_due" ? (
                    <>
                      <TextField key={`rm${shown.id}`} name="refundMethod" fullWidth
                        label="How it went back" defaultValue={shown.refundMethod}
                        placeholder="Bank transfer"
                        slotProps={{ htmlInput: { maxLength: 120 } }} />
                      <TextField key={`rn${shown.id}`} name="refundNote" fullWidth
                        label="Refund note" multiline minRows={2}
                        defaultValue={shown.refundNote}
                        placeholder="Club closed in March, refunded the rest of the year."
                        slotProps={{ htmlInput: { maxLength: 300 } }} />
                    </>
                  ) : null}
                </Stack>
              </Box>
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={onClose} color="inherit" disabled={working}>Cancel</Button>
            <SubmitButton label="Save the correction" pendingLabel="Saving the correction"
              variant="contained" pending={working} />
          </DialogActions>
        </Box>
      ) : null}
    </Dialog>
  );
}
