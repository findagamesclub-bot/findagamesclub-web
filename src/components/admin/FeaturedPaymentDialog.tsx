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
import { formatPence } from "@/utils/format";
import { shortDate } from "@/utils/dates";
import Divider from "@mui/material/Divider";
import { REFUND_STATES } from "@/utils/coaching-bookings-filter";
import type { RefundStatus } from "@/utils/refund-status";
import { tokens } from "@/lib/tokens";

const METHODS = ["Bank transfer", "Card", "PayPal", "Cash", "Other"];

export type PayableSlot = {
  id: number;
  clubName: string;
  startsOn: string;
  endsOn: string;
  pricePence: number;
  currency: string;
  paidAt: string | null;
  method: string;
  note: string;
  /** Money going back on a slot the club called off (0232). */
  refundStatus: RefundStatus;
  refundMethod: string;
  refundNote: string;
};

/**
 * What arrived for a featured slot.
 *
 * Only an admin reaches this, because featuring is a placement we sell and
 * settle off the site (0161). The club reads the answer on its own billing
 * page and cannot write it, which is the asymmetry the whole feature rests on.
 *
 * Uncontrolled where it can be: a controlled MUI `multiline` field drops the
 * character that wraps a line, which 0185 measured on the noticeboard. The
 * note is seeded by remounting on the slot's own id.
 */
export default function FeaturedPaymentDialog({
  slot, saving, onClose, onSave,
}: {
  slot: PayableSlot | null;
  saving: boolean;
  onClose: () => void;
  onSave: (fields: {
    paid: string; method: string; note: string;
    refundStatus: string; refundMethod: string; refundNote: string;
  }) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [paid, setPaid] = useState(true);
  const [method, setMethod] = useState("Bank transfer");
  // Read on save rather than held in state, so the field can stay
  // uncontrolled. See the note above about `multiline`.
  const note = useRef<HTMLTextAreaElement>(null);
  const [refund, setRefund] = useState<RefundStatus>("not_due");
  const [refundMethod, setRefundMethod] = useState("Bank transfer");
  const refundNote = useRef<HTMLTextAreaElement>(null);

  useWhenChanged([slot], () => {
    if (!slot) return;
    // An unsettled slot opens on "paid", because recording the money is what
    // somebody opened this to do. A settled one opens on what it says.
    setPaid(true);
    setMethod(slot.method || "Bank transfer");
    setRefund(slot.refundStatus);
    // However it came in is how it usually goes back, the same default the
    // event and table refund dialogs settled on.
    setRefundMethod(slot.refundMethod || slot.method || "Bank transfer");
  });

  return (
    <Dialog open={Boolean(slot)} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>{slot?.clubName || "This slot"}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {slot
              ? `${formatPence(slot.pricePence, slot.currency)} for `
                + `${shortDate(slot.startsOn)} to ${shortDate(slot.endsOn)}. `
              : ""}
            The club sees this on their own billing page.
          </Typography>

          <TextField select label="Payment" fullWidth value={paid ? "yes" : "no"}
            onChange={(e) => setPaid(e.target.value === "yes")}>
            <MenuItem value="yes">Paid</MenuItem>
            <MenuItem value="no">Not paid yet</MenuItem>
          </TextField>

          {paid ? (
            <>
              <TextField select label="How" fullWidth value={method}
                onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((one) => <MenuItem key={one} value={one}>{one}</MenuItem>)}
              </TextField>

              <TextField key={slot?.id ?? 0} label="Note" fullWidth
                multiline minRows={2} defaultValue={slot?.note ?? ""}
                inputRef={note}
                slotProps={{ htmlInput: { maxLength: 500 } }}
                helperText="An invoice number, or who paid it. The club sees this." />
            </>
          ) : (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              Clearing it takes the date, the method and the note with it, so a slot
              marked by mistake keeps nothing. The slot itself stays where it is.
            </Typography>
          )}

          {/* Money going back, the client's item 16d: a club books, pays and
              then changes its mind. Only where something was actually taken,
              because a refund on a slot nobody paid for is money leaving that
              never arrived, and the database refuses it anyway. */}
          {slot?.paidAt ? (
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
                  <TextField key={`r${slot.id}`} label="Refund note" fullWidth
                    multiline minRows={2} defaultValue={slot.refundNote}
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
            paid: paid ? "yes" : "no",
            method: paid ? method : "",
            note: paid ? (note.current?.value ?? "") : "",
            // Clearing the payment clears the refund with it: there is
            // nothing to give back on a slot the club is no longer saying it
            // took money for.
            refundStatus: paid ? refund : "not_due",
            refundMethod: refund === "refunded" ? refundMethod : "",
            refundNote: refund === "refunded" ? (refundNote.current?.value ?? "") : "",
          })}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
