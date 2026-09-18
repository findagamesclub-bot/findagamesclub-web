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
import { tokens } from "@/lib/tokens";

/**
 * Correcting who is coming.
 *
 * Only the name, the address and the note: what was bought and what it cost
 * are the booking's own facts, and a club being able to edit a total after
 * somebody agreed to it is not a thing this app allows.
 */
export default function EditBookingDialog({
  row, saving, onClose, onSave,
}: {
  row: DoorRow | null;
  saving: boolean;
  onClose: () => void;
  onSave: (fields: Record<string, string>) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!row) return;
    setFullName(row.fullName);
    setEmail(row.email);
    setNotes(row.notes);
  }, [row]);

  return (
    <Dialog open={Boolean(row)} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>Edit this booking</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Name" required fullWidth autoFocus value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 120 } }}
            helperText="Who is actually coming. A member can book for somebody else." />

          <TextField label="Email" type="email" fullWidth value={email}
            onChange={(e) => setEmail(e.target.value)}
            helperText="Where their ticket emails go." />

          <TextField label="Notes" fullWidth multiline minRows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            helperText="What they told you when they booked. Only your team sees it." />

          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            What they bought and what it cost cannot be changed here. Cancel the place and
            let them book again if the tickets are wrong.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" disabled={!fullName.trim()}
          loading={saving} loadingPosition="start"
          aria-label={saving ? "Saving the booking" : undefined}
          onClick={() => onSave({ fullName, email, notes })}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
