"use client";

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
import { mono, tokens } from "@/lib/tokens";
import { shortDate } from "@/utils/dates";
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

            <Typography variant="caption"
              sx={{ color: tokens.inkMuted, fontFamily: "var(--font-display)" }}>
              The correction is marked on the row, and the member sees the same history.
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
