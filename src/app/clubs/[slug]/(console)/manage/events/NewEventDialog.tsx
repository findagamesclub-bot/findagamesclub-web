"use client";

import { useState } from "react";
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
import { tokens } from "@/lib/tokens";

/**
 * A new event needs two things: what it is called and when it is.
 *
 * Everything else is the editor's job. Asking for thirty fields before an
 * event exists is what made the listing feel long, and a draft with a name and
 * a date is already something a club can come back to.
 */
export default function NewEventDialog({
  open, slug, today, saving, action, onClose,
}: {
  open: boolean;
  slug: string;
  /** London's today, so the date box does not offer yesterday. */
  today: string;
  saving: boolean;
  action: (data: FormData) => void;
  onClose: () => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="sm">
      <form action={action}>
        <input type="hidden" name="slug" value={slug} />
        <DialogTitle sx={{ pb: 1 }}>New event</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              name="title" label="What is it called" required autoFocus fullWidth
              value={title} onChange={(event) => setTitle(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 160 } }}
              helperText="The name people will see in the directory. You can change it later."
            />
            <TextField
              name="startDate" label="First day" type="date" required fullWidth
              value={startDate} onChange={(event) => setStartDate(event.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today } }}
              helperText="The date is part of the event's web address, so it is worth getting right."
            />
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              It saves as a draft. Nobody outside your team sees it until you publish.
            </Typography>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained"
            loading={saving} loadingPosition="start"
            disabled={!title.trim() || !startDate}
            aria-label={saving ? "Creating the event" : undefined}>
            Create draft
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
