"use client";

import { useState } from "react";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import SubmitButton from "@/components/ui/SubmitButton";
import { display, tokens } from "@/lib/tokens";

/**
 * The same dispositions, on every detachment in one faction.
 *
 * The client, on 22b: "a detachment can be given multiple dispositions which
 * is correct. However, when adding a score and result for a game, you can only
 * see 1 disposition to select." The picker already offers every one a
 * detachment holds. What it was offering is one, because every one of the 346
 * detachments in the imported catalogue carries exactly one, and the only way
 * to change that was this faction's dialogs opened one at a time.
 *
 * Additive, and the copy leads with that. Taking a disposition away from
 * twenty-four detachments at once is a different act from offering them one
 * more, and it should not wear the same button: removing one is still the
 * detachment's own dialog.
 *
 * The box is seeded with what the edition already names, so the usual case,
 * "give them the five a rulebook names", is one press rather than a list
 * somebody retypes thirty times.
 *
 * One dialog, two scopes (0193). The catalogue page opens it over the whole
 * edition and a faction page opens it over that faction; only the sentence at
 * the top differs, and a second copy of this would have drifted the first time
 * either was touched.
 */
export default function FactionDispositionsDialog({
  open, where, detachments, known, busy, onSave, onClose,
}: {
  open: boolean;
  /**
   * What this reaches, as it reads after "in": a faction's own name, or the
   * edition's. It is a phrase rather than a flag because the sentence is the
   * only thing that changes between the two scopes.
   */
  where: string;
  /** How many detachments it reaches, before any search narrowed them. */
  detachments: number;
  /** Every disposition this edition already names, for the seed. */
  known: string[];
  busy: boolean;
  onSave: (dispositions: string) => void;
  onClose: () => void;
}) {
  const small = useMediaQuery("(max-width:599px)");
  // Not the box's value. An uncontrolled `multiline` is the only kind that
  // keeps every keystroke, so this only tracks whether there is anything in it
  // at all, which is what the button needs.
  const [filled, setFilled] = useState(false);
  const [seed, setSeed] = useState("");

  useWhenChanged([open], () => {
    if (!open) return;
    setSeed(known.join("\n"));
    setFilled(known.length > 0);
  });

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose}
      fullWidth maxWidth="sm" fullScreen={small}>
      <DialogTitle sx={{ fontSize: "1.1rem" }}>
        Dispositions for every detachment
      </DialogTitle>
      <DialogContent>
        <Stack component="form" spacing={2.5} sx={{ pt: 1 }}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            onSave(String(form.get("dispositions") ?? ""));
          }}>
          <Typography sx={{ fontSize: "0.95rem" }}>
            These go on all{" "}
            <Typography component="span"
              sx={{ fontFamily: display, fontWeight: 700 }}>
              {detachments}
            </Typography>{" "}
            {detachments === 1 ? "detachment" : "detachments"} in {where}.
            Nothing is taken away, so a detachment keeps whatever it already
            names and running this twice changes nothing.
          </Typography>

          <TextField key={open ? "open" : "shut"} name="dispositions"
            label="Dispositions" defaultValue={seed} multiline minRows={4}
            autoFocus
            slotProps={{ htmlInput: { maxLength: 500 } }}
            onChange={(event) => setFilled(event.target.value.trim().length > 0)}
            helperText="One per line." />

          <Typography sx={{ fontSize: "0.9rem", color: tokens.inkMuted }}>
            {known.length
              ? "Filled in with the ones this edition already uses. Add to them or type your own."
              : "This edition names none yet, so whatever you type here is the first set."}{" "}
            To take one off a single detachment, open that detachment instead.
          </Typography>

          <Stack direction="row" spacing={1.5}
            sx={{ justifyContent: "flex-end", pb: 1 }}>
            <Button variant="text" onClick={onClose} disabled={busy}>Cancel</Button>
            <SubmitButton label="Add them to all" pendingLabel="Adding them"
              variant="contained" blocked={!filled} pending={busy} />
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
