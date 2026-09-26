"use client";

import { useActionState, useState, useTransition } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import OutlinedFlagIcon from "@mui/icons-material/OutlinedFlag";
import FlagIcon from "@mui/icons-material/Flag";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { reportAction, type ReportState } from "@/app/report/actions";
import type { ModerationTarget } from "@/utils/moderation-targets";
import { tokens } from "@/lib/tokens";

/**
 * "This breaks the rules."
 *
 * A dialog rather than a one-press button, because a report with no reason is
 * a report an admin cannot act on, and because pressing Report by accident
 * should not put somebody in a queue.
 *
 * Quiet on purpose: text, small, muted. It sits beside somebody's words and
 * should not compete with them.
 */
export default function ReportButton({
  type, id, what, label = "Report", reported = false,
}: {
  type: ModerationTarget;
  id: number;
  /** What is being reported, for the dialog's own sentence. */
  what: string;
  label?: string;
  /** This reader already has an open report on it. */
  reported?: boolean;
}) {
  const small = useMediaQuery("(max-width:599px)");
  const [state, act, busy] = useActionState<ReportState, FormData>(reportAction, {});
  useActionToast(state);

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [, start] = useTransition();

  // Closes itself once the report has landed, and latches the button into its
  // reported state. In an effect, never during render: `useActionState` hands
  // back its initial value on every server render, so comparing states during
  // render never settles.
  //
  // The latch is what makes the button change on the press. `reported` is
  // server-rendered, and reporting deliberately revalidates nothing, because
  // it changes nothing anybody else can see: the words stay exactly where they
  // were, which is the whole point of a queue. So the one thing on the page
  // that does change is this button, and it knows. The server agrees on the
  // next render either way.
  useActionSuccess(state, () => {
    setOpen(false);
    setReason("");
    setSent(true);
  });

  // A refusal never gets here, so a report that failed still offers the press.
  // A second report of the same thing does: the database answers it as a
  // no-op and the service says so, which is still "you have reported this".
  const already = reported || sent;

  // Outlined until you have raised it, filled once you have. On the labelled
  // button the words carry it ("Report" becomes "Reported"); on the icon-only
  // one beside a board reply there are no words, and it drew the same outline
  // either way, so a member who had just reported something had no way of
  // knowing it had landed.
  const Flag = already ? FlagIcon : OutlinedFlagIcon;

  return (
    <>
      {/* Already reported is a state, not a second chance. Pressing again used
          to open the dialog, take a reason and only then say "you already did",
          which is the site knowing something the reader could not. The button
          says it before the press instead, and stays where it was so the row
          does not reflow when a report lands. */}
      {already ? (
        <Button variant="text" size="small" disabled
          startIcon={label ? <Flag /> : undefined}
          title={`You reported this ${what}. An admin is looking at it.`}
          aria-label={`You reported this ${what}. An admin is looking at it.`}
          sx={{ fontSize: "0.78rem",
                // Disabled, so MUI's own muting would take it below the
                // contrast floor. The colour is set back explicitly.
                "&.Mui-disabled": { color: tokens.inkMuted },
                ...(label ? {} : { minWidth: 0, px: 0.75 }) }}>
          {label ? "Reported" : <Flag sx={{ fontSize: 15 }} />}
        </Button>
      ) : (
        /* An empty label means icon only, which needs a name of its own or a
           screen reader reads a button with nothing in it. */
        <Button variant="text" size="small"
          startIcon={label ? <Flag /> : undefined}
          aria-label={label ? undefined : `Report this ${what}`}
          onClick={() => setOpen(true)}
          sx={{ color: tokens.inkMuted, fontSize: "0.78rem",
                ...(label ? {} : { minWidth: 0, px: 0.75 }) }}>
          {label || <Flag sx={{ fontSize: 15 }} />}
        </Button>
      )}

      <Dialog open={open} onClose={busy ? undefined : () => setOpen(false)}
        fullWidth maxWidth="xs" fullScreen={small}>
        <DialogTitle sx={{ fontSize: "1.1rem" }}>Report this {what}</DialogTitle>
        <DialogContent>
          <Stack component="form" spacing={2.5} sx={{ pt: 1 }}
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData();
              data.set("type", type);
              data.set("id", String(id));
              data.set("reason", reason);
              // Dispatched inside a transition, or the pending flag never
              // flips and the button sits there looking dead.
              start(() => act(data));
            }}>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              An admin reads it and decides. Nothing disappears in the meantime,
              and the person who wrote it is not told who reported it.
            </Typography>

            <TextField label="What is wrong with it" value={reason} multiline minRows={3}
              autoFocus required
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              helperText="A line is enough. It goes to an admin, not to the club." />

            <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end", pb: 1 }}>
              <Button variant="text" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <SubmitButton label="Report it" pendingLabel="Reporting"
                variant="contained" blocked={!reason.trim()} pending={busy} />
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
