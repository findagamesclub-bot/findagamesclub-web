"use client";

import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import type { DoorRow } from "@/utils/door-list";
import { formatMoney } from "@/utils/format";
import { tokens } from "@/lib/tokens";

/**
 * Taking somebody's place back.
 *
 * The reason is required because it is the message they get. "Your place has
 * been cancelled" with nothing after it is the version that makes people ring
 * the club.
 */
export default function CancelPlaceDialog({
  row, saving, onClose, onConfirm,
}: {
  row: DoorRow | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [reason, setReason] = useState("");

  useEffect(() => { if (row) setReason(""); }, [row]);

  const paid = row ? row.paymentStatus !== "unpaid" : false;

  return (
    <Dialog open={Boolean(row)} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>Cancel {row?.fullName || "this booking"}?</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Their place goes back into the pool and they are told.
            {paid && row
              ? ` They have paid ${formatMoney(row.total, "GBP")}, so the booking is marked as `
                + "a refund due until you say it is settled."
              : ""}
          </Typography>

          <TextField label="Why" required multiline minRows={3} fullWidth autoFocus
            value={reason} onChange={(e) => setReason(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            helperText="This is the message they get. They rang up, the ticket was a duplicate, whatever it is." />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Keep the place</Button>
        <Button variant="contained" color="error" disabled={!reason.trim()}
          loading={saving} loadingPosition="start"
          aria-label={saving ? "Cancelling the place" : undefined}
          onClick={() => onConfirm(reason.trim())}>
          Cancel the place
        </Button>
      </DialogActions>
    </Dialog>
  );
}
