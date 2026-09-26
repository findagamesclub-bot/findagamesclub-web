"use client";

import { useActionState, useState, useTransition } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
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
import { recordPaymentAction, type BillingState } from "@/app/admin/billing/actions";
import { PAYMENT_METHODS } from "@/utils/listing-billing";
import { tokens } from "@/lib/tokens";

/**
 * Write down a cheque that arrived.
 *
 * The whole of offline billing is this box. It opens with the amount the
 * subscription is for, because the common case is somebody paying exactly what
 * was asked and retyping it is a chance to fat-finger a figure that lands in a
 * ledger nobody can edit afterwards.
 *
 * Money in pounds here and pence in the database. The form takes what a person
 * would write on a cheque stub.
 */
export default function RecordPaymentDialog({
  subscription, clubName, suggestedPence, today,
}: {
  subscription: number;
  clubName: string;
  /** What the subscription is for, prefilled. */
  suggestedPence: number;
  /** London's today, from the server, so the default is not the browser's idea. */
  today: string;
}) {
  const [state, act, working] =
    useActionState<BillingState, FormData>(recordPaymentAction, {});
  useActionToast(state);

  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <>
      <Button variant="contained" onClick={() => setOpen(true)}
        sx={{ alignSelf: "flex-start" }}>
        Record a payment
      </Button>

      <Dialog open={open} onClose={working ? undefined : () => setOpen(false)}
        fullWidth maxWidth="sm" fullScreen={fullScreen}>
        <Box component="form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            data.set("subscription", String(subscription));
            start(() => act(data));
            setOpen(false);
          }}>
          <DialogTitle>{`Record a payment for ${clubName}`}</DialogTitle>

          <DialogContent>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                This extends the listing from whichever is later, the date it runs
                out or the date they paid. They are emailed a receipt.
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField name="amount" label="Amount" required fullWidth
                  defaultValue={(suggestedPence / 100).toFixed(2)}
                  helperText="In pounds. Change it if they paid something else." />
                <TextField name="paidAt" label="Paid on" type="date" required fullWidth
                  defaultValue={today}
                  slotProps={{ inputLabel: { shrink: true } }}
                  helperText="The date on the cheque or the transfer." />
              </Stack>

              <TextField name="method" label="How" select required fullWidth
                defaultValue="cheque"
                helperText="What it arrived as.">
                {PAYMENT_METHODS.map((m) => (
                  <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                ))}
              </TextField>

              <TextField name="reference" label="Reference" fullWidth
                helperText="A cheque number or a bank reference, so it can be found again." />

              <TextField name="note" label="Note" fullWidth multiline minRows={2}
                helperText="Anything worth remembering about this one." />
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setOpen(false)} color="inherit" disabled={working}>
              Cancel
            </Button>
            <SubmitButton label="Record it" pendingLabel="Recording the payment"
              variant="contained" pending={working} />
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
