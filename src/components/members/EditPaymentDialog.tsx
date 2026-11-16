"use client";

import { useState } from "react";
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
import { useWhenChanged } from "@/hooks/useWhenChanged";
import { mono, tokens } from "@/lib/tokens";
import { shortDate } from "@/utils/dates";
import { REFUND_LABELS, REFUND_STATUSES } from "@/utils/refund-status";
import type { BillingOption, MembershipPayment } from "@/types/payment";

/**
 * Putting a recorded payment right.
 *
 * Nothing here takes money, so a payment row is a club writing down what
 * arrived at the door. 0012 made that insert-only and the only way back was
 * the SQL console; this is the way back.
 *
 * The money is only offered on the NEWEST payment, because every one stacks
 * onto the end of the one before it: correcting an older term would leave
 * every period after it quietly wrong. The note is correctable on any of them,
 * and the screen says which case it is rather than leaving it to be found.
 *
 * The refund (0233, the client's item 17) is a second section rather than a
 * third state of the first. A correction says the club wrote the row down
 * wrong; a refund says the row is right and the money came back afterwards.
 * The ledger keeps them apart and so does this, including on an older payment
 * whose amount is locked — the money going back has nothing to do with the
 * arithmetic that locked it.
 */
export default function EditPaymentDialog({
  payment, slug, options, isNewest, busy, send, onClose,
}: {
  /** Null closes it. Held by the caller so the fields seed from one row. */
  payment: MembershipPayment | null;
  slug: string;
  options: BillingOption[];
  /** Whether this is the most recent payment on the membership. */
  isNewest: boolean;
  busy: boolean;
  send: (data: FormData) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const open = payment !== null;
  // The picker drives what else is on screen, so it needs state. Seeded per
  // row rather than once: the dialog is reused for every payment in the list.
  const [refund, setRefund] = useState(payment?.refundStatus ?? "not_due");
  // During render, not in an effect: an effect runs after paint, so opening
  // the dialog on a second payment would show the first one's refund state
  // for a frame. `useWhenChanged` is the house answer to that.
  useWhenChanged([payment], () => {
    if (payment) setRefund(payment.refundStatus);
  });
  // Held while the dialog plays its exit transition, so the heading does not
  // flicker to an empty row on the way out.
  const shown = payment;
  const canChangeMoney = isNewest && options.length > 0;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <DialogTitle sx={{ fontFamily: "var(--font-display)" }}>
        Put this payment right
      </DialogTitle>

      <DialogContent dividers>
        {shown ? (
          <Stack component="form" id="edit-payment" action={send} spacing={1.5}>
            <input type="hidden" name="paymentId" value={shown.id} />
            <input type="hidden" name="slug" value={slug} />

            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                              letterSpacing: "0.1em", color: tokens.inkMuted }}>
              {`RECORDED ${(shortDate(shown.recordedAt) ?? "").toUpperCase()}`}
            </Typography>

            {canChangeMoney ? (
              <TextField select name="billingOptionId" size="small" label="They paid"
                defaultValue={
                  options.find((o) => o.label === shown.billingOptionLabel)?.id
                  ?? options[0]?.id
                }
                fullWidth
                helperText="Changing this works the period out again from the same start date.">
                {options.map((o) => (
                  <MenuItem key={o.id} value={o.id}>{o.label} · {o.price}</MenuItem>
                ))}
              </TextField>
            ) : (
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                {options.length
                  ? `${shown.billingOptionLabel} · ${shown.price}. Only the newest payment's `
                    + "amount can be changed, because the ones after it were worked out from "
                    + "this one."
                  : `${shown.billingOptionLabel} · ${shown.price}. This tier has no fee to change.`}
              </Typography>
            )}

            {/* Uncontrolled with a key, so a multiline box cannot drop the
                keystroke that wraps a line and the fields re-seed per row. */}
            <TextField key={shown.id} name="note" size="small" label="Note" multiline
              minRows={2} defaultValue={shown.note ?? ""} fullWidth
              placeholder="Cash at the door"
              slotProps={{ htmlInput: { maxLength: 300 } }}
              helperText="What the club wants to remember about it." />

            <Box sx={{ pt: 1, mt: 0.5, borderTop: `1px solid ${tokens.rule}` }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                letterSpacing: "0.08em", color: tokens.inkMuted, mb: 1.25 }}>
                MONEY GOING BACK
              </Typography>

              <Stack spacing={1.5}>
                <TextField select name="refundStatus" size="small" label="Refund"
                  value={refund} onChange={(e) => setRefund(e.target.value as typeof refund)}
                  fullWidth
                  helperText="Marking it refunded stamps today's date on the row.">
                  {REFUND_STATUSES.map((one) => (
                    <MenuItem key={one} value={one}>{REFUND_LABELS[one]}</MenuItem>
                  ))}
                </TextField>

                {/* Only once there is a refund to describe. An empty "how" and
                    "why" under "No refund due" is two fields asking about
                    something that did not happen. */}
                {refund !== "not_due" ? (
                  <>
                    <TextField key={`m${shown.id}`} name="refundMethod" size="small"
                      label="How it went back" fullWidth
                      defaultValue={shown.refundMethod}
                      placeholder="Bank transfer"
                      slotProps={{ htmlInput: { maxLength: 120 } }} />
                    <TextField key={`n${shown.id}`} name="refundNote" size="small"
                      label="Refund note" multiline minRows={2} fullWidth
                      defaultValue={shown.refundNote}
                      placeholder="Left the club in March, refunded the rest of the year."
                      slotProps={{ htmlInput: { maxLength: 300 } }}
                      helperText="What the club wants to remember about the refund." />
                  </>
                ) : null}

                {shown.refundedAt ? (
                  <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                    letterSpacing: "0.08em", color: tokens.danger }}>
                    {`REFUNDED ${(shortDate(shown.refundedAt) ?? "").toUpperCase()}`}
                  </Typography>
                ) : null}
              </Stack>
            </Box>

            <Typography variant="caption"
              sx={{ color: tokens.inkMuted, fontFamily: "var(--font-display)" }}>
              Everything here is marked on the row, and the member sees the same history.
            </Typography>
          </Stack>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="submit" form="edit-payment" variant="contained"
          loading={busy} loadingPosition="start">
          Save the correction
        </Button>
      </DialogActions>
    </Dialog>
  );
}
