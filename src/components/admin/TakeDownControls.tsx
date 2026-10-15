"use client";

import { useActionState, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import BlockIcon from "@mui/icons-material/Block";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { listingAction, type AdminState } from "@/app/admin/actions";

/**
 * Take a listing out of the directory, or put it back (0188).
 *
 * One control for a club and for an event, because it is one decision: an
 * admin says why, the listing goes, and only an admin brings it back. Two
 * components would be two sets of words for the same act, and the client has
 * asked three times for a thing that looks the same everywhere.
 *
 * It sits in the card's footer rather than being the card itself, so the card
 * still opens what it is about. The reason is the item, so the dialog refuses
 * without one rather than taking a listing down with nothing to tell the owner.
 */
export default function TakeDownControls({
  kind, id, name, slug, down,
}: {
  kind: "club" | "event";
  id: number;
  /** What this is called, for the dialog's own question. */
  name: string;
  /** The club's slug, so the pages that draw the banner are refreshed too. */
  slug: string;
  down: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [, start] = useTransition();

  const [state, dispatch, pending] = useActionState<AdminState, FormData>(
    listingAction, {},
  );
  useActionToast(state);
  // On the answer landing, never on the click: closing on the press takes a
  // refusal off the screen along with the sentence somebody just typed.
  useActionSuccess(state, () => setAsking(false));

  const noun = kind === "club" ? "listing" : "event";

  const send = (intent: string, reason?: string) => {
    const data = new FormData();
    data.set("kind", kind);
    data.set("id", String(id));
    data.set("slug", slug);
    data.set("intent", intent);
    if (reason !== undefined) data.set("reason", reason);
    start(() => dispatch(data));
  };

  return (
    <>
      {down ? (
        <Button
          size="small" variant="contained"
          loading={pending} loadingPosition="start"
          onClick={() => send("up")}
          sx={{ alignSelf: "flex-start", flexShrink: 0 }}
        >
          Put it back
        </Button>
      ) : (
        <Button
          size="small" variant="outlined" color="error"
          startIcon={<BlockIcon sx={{ fontSize: 17 }} />}
          disabled={pending}
          onClick={() => setAsking(true)}
          sx={{ alignSelf: "flex-start", flexShrink: 0 }}
        >
          Take it down
        </Button>
      )}

      <Dialog open={asking} onClose={() => setAsking(false)} maxWidth="xs" fullWidth
        fullScreen={false}>
        <DialogTitle>{`Take ${name} down?`}</DialogTitle>
        {/* Dispatched from onSubmit inside a transition rather than through
            `action`, because React 19 empties an uncontrolled form once its
            action has run: a refused save would wipe the reason and then ask
            for one. */}
        <Box component="form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            send("down", String(form.get("reason") ?? ""));
          }}>
          <DialogContent>
            <DialogContentText sx={{ fontSize: "0.95rem", mb: 2 }}>
              {kind === "club"
                ? "The club goes from the directory, the map and search. Nobody "
                  + "can join it, book a table or take a ticket. Its own team can "
                  + "still open the club and the console, so they can put right "
                  + "whatever this is about, and only an admin can put it back."
                : "The event goes from the events list and nobody can book a new "
                  + "place. Everybody who has already booked keeps theirs. The "
                  + "club can still edit the event, and only an admin can put the "
                  + "listing back."}
            </DialogContentText>
            <Stack spacing={1.5}>
              {/* A field that needs room takes the whole row, and it is
                  uncontrolled: a controlled MUI multiline drops the keystroke
                  that wraps a line. */}
              <TextField
                name="reason"
                label="Reason"
                fullWidth multiline minRows={2} required autoFocus
                slotProps={{ htmlInput: { maxLength: 1000 } }}
                helperText="The owner reads this, word for word."
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button variant="text" onClick={() => setAsking(false)}>Cancel</Button>
            <SubmitButton label={`Take the ${noun} down`} pendingLabel="Taking it down"
              size="medium" color="error" pending={pending} />
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
