"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PaymentsIcon from "@mui/icons-material/Payments";
import { mono, tokens } from "@/lib/tokens";
import type { BillingOption } from "@/types/payment";

/**
 * What a member just paid.
 *
 * The heading names the tier, which is the fix the client asked for: a payment
 * is recorded against the tier they hold, and a dialog that does not say which
 * one reads as describing whatever the picker above happens to show.
 *
 * Every way to pay the tier offers is here, because a tier is not one price.
 * Until the listing editor could set them, these were whatever the import had
 * left behind.
 */
export default function RecordPayment({
  membershipId, slug, tierKey, tierLabel, options, busy, send,
}: {
  membershipId: number;
  slug: string;
  /** The tier they hold, not the one picked above. */
  tierKey: string | null;
  tierLabel: string;
  options: BillingOption[];
  busy: boolean;
  send: (data: FormData) => void;
}) {
  if (!options.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        {tierLabel
          ? `${tierLabel} has no fee, so there is nothing to record.`
          : "This tier has no fee, so there is nothing to record."}
      </Typography>
    );
  }

  return (
    <Box component="form" action={send}>
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="slug" value={slug} />
      <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                        letterSpacing: "0.1em", color: tokens.inkMuted, mb: 1 }}>
        {`RECORD A PAYMENT${tierLabel ? ` · ${tierLabel.toUpperCase()}` : ""}`}
      </Typography>
      <Stack spacing={1.25}>
        {/* Keyed on the tier so switching tier resets the choice: the select
            would otherwise still hold the old tier's option id and the submit
            would be refused. */}
        <TextField key={tierKey ?? "none"} select name="billingOptionId" size="small"
          label="They paid" defaultValue={options[0]!.id} fullWidth>
          {options.map((o) => (
            <MenuItem key={o.id} value={o.id}>{o.label} · {o.price}</MenuItem>
          ))}
        </TextField>
        <TextField name="note" size="small" label="Note" placeholder="Cash at the door"
          fullWidth slotProps={{ htmlInput: { maxLength: 300 } }} />
        <Button type="submit" variant="contained" loading={busy}
          loadingPosition="start" startIcon={<PaymentsIcon />}>
          Record payment
        </Button>
      </Stack>
    </Box>
  );
}
