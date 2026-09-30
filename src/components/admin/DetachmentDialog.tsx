"use client";

import { useState } from "react";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
import SubmitButton from "@/components/ui/SubmitButton";
import type { DetachmentRow } from "@/services/armyCatalogue.service";

const slugify = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * One detachment and the dispositions it offers.
 *
 * A dialog, per rule 5: editing inside a grid stretches the whole row.
 *
 * One disposition per line rather than a chip picker, because the five in the
 * catalogue are the five a rulebook names and a club adding a sixth should not
 * have to ask an admin to add it to a list first. Blank lines drop out.
 */
export default function DetachmentDialog({
  open, detachment, busy, onSave, onClose,
}: {
  open: boolean;
  detachment: DetachmentRow | null;
  busy: boolean;
  onSave: (fields: Record<string, string>) => void;
  onClose: () => void;
}) {
  const small = useMediaQuery("(max-width:599px)");
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [dispositions, setDispositions] = useState("");
  // Its own copy while it is open. MUI keeps a dialog mounted through its exit
  // transition, so reading the prop straight through flips the heading from
  // "Edit" to "New" for half a second on the way out.
  const [shown, setShown] = useState<DetachmentRow | null>(null);

  useWhenChanged([open, detachment], () => {
    if (!open) return;
    setShown(detachment);
    setLabel(detachment?.label ?? "");
    setSlug(detachment?.slug ?? "");
    setDispositions((detachment?.dispositions ?? []).join("\n"));
  });

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose}
      fullWidth maxWidth="xs" fullScreen={small}>
      <DialogTitle sx={{ fontSize: "1.1rem" }}>
        {shown ? "Edit detachment" : "New detachment"}
      </DialogTitle>
      <DialogContent>
        <Stack component="form" spacing={2.5} sx={{ pt: 1 }}
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              slug: slug.trim() || slugify(label),
              label: label.trim(),
              dispositions,
              position: String(shown?.position ?? 0),
            });
          }}>
          <TextField label="Name" value={label} required autoFocus
            onChange={(event) => setLabel(event.target.value.slice(0, 120))} />
          <TextField label="Dispositions" value={dispositions} multiline minRows={3}
            onChange={(event) => setDispositions(event.target.value.slice(0, 500))}
            helperText="One per line. Only these are offered when somebody picks this detachment." />

          <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end", pb: 1 }}>
            <Button variant="text" onClick={onClose} disabled={busy}>Cancel</Button>
            <SubmitButton label={shown ? "Save changes" : "Add it"}
              pendingLabel="Saving the detachment" variant="contained"
              blocked={!label.trim()} pending={busy} />
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
