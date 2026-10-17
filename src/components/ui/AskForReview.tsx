"use client";

import { useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { askReviewAction, type AskState }
  from "@/app/clubs/[slug]/suspension-actions";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

/**
 * The club's way back from a suspension.
 *
 * The banner above it says what happened and why; this is the only thing on
 * the page that does something about it. The client's words were that "it is
 * not clear for a club owner how they resolve the issue", and they were right:
 * the sentence ended at "only a site admin can put it back".
 *
 * Folded away until it is pressed. The reason is what somebody opened this to
 * read, and a text box under it competes with that; one quiet button does not.
 *
 * Once sent it stops being a form and becomes a record, because the next
 * question is "did that go anywhere" and a second identical button is not an
 * answer to it. Asking again is still possible, which is deliberate: a week of
 * silence is exactly when somebody needs to.
 */
export default function AskForReview({
  kind, id, slug, askedAt, askedNote,
}: {
  kind: "club" | "event";
  id: number;
  /** Only for revalidating the pages that draw the banner. */
  slug: string;
  askedAt: string | null;
  askedNote: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, submit, busy] = useActionState<AskState, FormData>(askReviewAction, {});
  useActionToast(state);

  // Folded away when the answer lands, never on the click: a refusal has to
  // keep what was typed into it. The record above takes its place, so leaving
  // the box open under a line saying it was sent reads as a second ask
  // waiting to be made. Sixth screen to need this.
  useActionSuccess(state, () => setOpen(false));

  const when = askedAt ? shortDate(askedAt.slice(0, 10)) : null;
  const noun = kind === "club" ? "listing" : "event";

  return (
    <Stack spacing={1}>
      {askedAt ? (
        <Box>
          <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                            letterSpacing: "0.08em", color: tokens.inkMuted }}>
            {`YOU ASKED FOR ANOTHER LOOK${when ? ` ON ${when.toUpperCase()}` : ""}`}
          </Typography>
          {askedNote ? (
            <Typography variant="body2" sx={{ mt: 0.25 }}>{askedNote}</Typography>
          ) : null}
        </Box>
      ) : null}

      {open ? (
        <Box component="form" action={submit}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={String(id)} />
          <input type="hidden" name="slug" value={slug} />
          <Stack spacing={1.25} sx={{ maxWidth: 520 }}>
            {/* Uncontrolled, like every other multiline field here: a
                controlled MUI textarea drops the keystroke that wraps a line
                (0185), and there is nothing to seed this from anyway. */}
            <TextField name="note" label="What you changed" fullWidth
              multiline minRows={2} size="small"
              slotProps={{ htmlInput: { maxLength: 1000 } }}
              helperText="Optional, and the admins read it next to their own reason." />
            <Stack direction="row" spacing={1}>
              <SubmitButton label="Send it" pendingLabel="Sending" size="small" />
              <Button type="button" size="small" variant="text" disabled={busy}
                onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Box>
      ) : (
        <Box>
          <Button variant="outlined" size="small" onClick={() => setOpen(true)}
            sx={{ minHeight: 40 }}>
            {askedAt ? "Ask again" : `Tell the admins the ${noun} is settled`}
          </Button>
        </Box>
      )}
    </Stack>
  );
}
