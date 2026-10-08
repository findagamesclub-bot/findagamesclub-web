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
import { useWhenChanged } from "@/hooks/useWhenChanged";
import { sinceLabel } from "@/utils/dates";
import { tokens } from "@/lib/tokens";
import type { EventNotice } from "@/types/eventEditor";

/**
 * Correcting a notice that is already up.
 *
 * A dialog rather than the row turning into a box: the notices sit in a
 * bordered stack and growing one of them to hold a four-line textarea pushes
 * the rest down the page while somebody is typing. Rule 5.
 *
 * The date stays as it was. A club fixing a hall number at half past six has
 * not posted a new notice, and restamping it would push a correction to the
 * top of a list ordered by when things were said.
 */
export default function NoticeDialog({
  notice, saving, onClose, onSave,
}: {
  /** Null when nothing is being edited, which is what keeps this closed. */
  notice: EventNotice | null;
  saving: boolean;
  onClose: () => void;
  onSave: (message: string) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [message, setMessage] = useState("");

  // During render, not in an effect: opening this on a second notice would
  // otherwise paint the first one's words for a frame.
  useWhenChanged([notice?.id], () => setMessage(notice?.message ?? ""));

  return (
    <Dialog open={notice !== null} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>Edit this notice</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {notice
              ? `Posted ${sinceLabel(notice.createdAt)}. Everybody holding a ticket sees the change straight away, and the date stays as it was.`
              : ""}
          </Typography>

          <TextField label="Notice" fullWidth multiline minRows={3} autoFocus
            value={message} onChange={(event) => setMessage(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
            helperText="Short and specific. A change of hall, a late start, a reminder to bring a list." />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving} color="inherit">Cancel</Button>
        <Button variant="contained" loading={saving} loadingPosition="start"
          disabled={!message.trim()}
          aria-label={saving ? "Saving the notice" : undefined}
          onClick={() => onSave(message)}>
          Save notice
        </Button>
      </DialogActions>
    </Dialog>
  );
}
