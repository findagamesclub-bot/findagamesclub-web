"use client";

import { startTransition, useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { bookingAction, type BookingState } from "@/app/clubs/[slug]/bookings/actions";
import { nightLabel } from "@/utils/dates";
import { tokens } from "@/lib/tokens";
import type { Booking } from "@/types/booking";

/**
 * Correcting what is written on a booking.
 *
 * A dialog rather than editing in place: the row it sits in is one line of a
 * table list, and three fields opened inside it would push every table below
 * it down the page. The same shape as Manage member and the result editor, so
 * a club owner is not learning a third way to change something.
 */
export default function EditBookingDialog({
  booking, slug, variant = "text",
}: {
  booking: Booking;
  slug: string;
  /** A row of a list wants a quiet control; a card of its own wants a button. */
  variant?: "text" | "outlined";
}) {
  const [open, setOpen] = useState(false);
  const fullScreen = useMediaQuery("(max-width:600px)");
  const [state, submit, busy] = useActionState<BookingState, FormData>(bookingAction, {});
  useActionToast(state);

  // The state the dialog was opened against. useActionState hands back a NEW
  // object per submission, so comparing identity says "something happened
  // since this was opened" without an effect, and without the string compare
  // that would miss a second edit carrying the same notice.
  const [openedWith, setOpenedWith] = useState<BookingState>(state);

  // Closed once a submission has succeeded. An error keeps it open, because
  // the message belongs beside the field that caused it.
  const showing = open && !(state !== openedWith && state.notice);

  const save = (data: FormData) => {
    data.set("intent", "edit");
    data.set("slug", slug);
    data.set("bookingId", String(booking.id));
    startTransition(() => submit(data));
  };

  return (
    <>
      <Button
        size="small"
        variant={variant}
        startIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />}
        onClick={() => { setOpenedWith(state); setOpen(true); }}
        sx={{ flexShrink: 0, fontSize: "0.75rem",
              ...(variant === "text" ? { color: tokens.inkMuted } : {}) }}
      >
        Edit
      </Button>

      <Dialog open={showing} onClose={() => setOpen(false)} fullWidth maxWidth="sm"
        fullScreen={fullScreen}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>Edit this booking</Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                            letterSpacing: "0.06em", color: tokens.inkMuted, mt: 0.5 }}>
            {`${nightLabel(booking.date).toUpperCase()} · TABLE ${booking.tableIndex + 1}`}
          </Typography>
        </DialogTitle>

        <form action={save}>
          <DialogContent dividers>
            <Stack spacing={2.5}>
              {state.error ? <Alert severity="error">{state.error}</Alert> : null}

              <TextField
                name="gameTitle" label="Game" required fullWidth
                defaultValue={booking.gameTitle}
                slotProps={{ htmlInput: { maxLength: 120 } }}
              />

              <TextField
                name="opponentName" label="Opponent" fullWidth
                defaultValue={booking.opponent?.name ?? ""}
                disabled={booking.opponentLinked}
                slotProps={{ htmlInput: { maxLength: 120 } }}
                helperText={booking.opponentLinked
                  ? "This opponent is a club member, so their name comes from their profile."
                  : "Leave empty if the table is still open to anybody."}
              />

              <TextField
                name="notes" label="Notes" fullWidth multiline minRows={3}
                defaultValue={booking.notes}
                slotProps={{ htmlInput: { maxLength: 500 } }}
                helperText="Anything the club or the other player should know."
              />
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <SubmitButton label="Save changes" pendingLabel="Saving the booking"
              size="medium" />
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
