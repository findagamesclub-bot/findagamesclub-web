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
import Typography from "@mui/material/Typography";
import BlockIcon from "@mui/icons-material/Block";
import LongText from "@/components/ui/LongText";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";
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
  kind, id, name, slug, down, reason = "", askedAt = null, askedNote = "",
}: {
  kind: "club" | "event";
  id: number;
  /** What this is called, for the dialog's own question. */
  name: string;
  /** The club's slug, so the pages that draw the banner are refreshed too. */
  slug: string;
  down: boolean;
  /**
   * Why it is down, and whether the club has answered (0215).
   *
   * 0202 built the ask, stamped the row and rang every admin, and stopped one
   * layer short of a screen reading any of it: an admin could be told a club
   * had put something right and had nowhere to see what they said, which is
   * exactly what the client reported.
   */
  reason?: string;
  askedAt?: string | null;
  askedNote?: string;
}) {
  const [asking, setAsking] = useState(false);
  // Which answer the dialog is collecting. Taking it down and keeping it down
  // both need words, and one dialog asking a different question is better
  // than two that look the same and are not.
  const [keeping, setKeeping] = useState(false);
  const [, start] = useTransition();

  const [state, dispatch, pending] = useActionState<AdminState, FormData>(
    listingAction, {},
  );
  useActionToast(state);
  // On the answer landing, never on the click: closing on the press takes a
  // refusal off the screen along with the sentence somebody just typed.
  useActionSuccess(state, () => { setAsking(false); setKeeping(false); });

  const noun = kind === "club" ? "listing" : "event";
  // Bound once rather than read through the prop inside the markup: a prop is
  // not narrowed inside a closure, so `askedAt.slice` does not compile there.
  // `shortDate` answers null on anything it cannot read, which is why the
  // heading drops the date rather than printing "NULL" at somebody.
  const answeredOn = (shortDate(askedAt?.slice(0, 10)) ?? "").toUpperCase();

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
        <Stack spacing={1}>
          {/* What we said, so an admin answering an ask can see what they
              asked for without opening another screen. */}
          {reason ? (
            <Stack spacing={0.25}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                letterSpacing: "0.1em", color: tokens.inkMuted }}>
                WHY IT IS DOWN
              </Typography>
              <LongText text={reason} lines={4} />
            </Stack>
          ) : null}

          {/* And what they said back. This is the whole of the client's
              "there is nowhere I can see that admin would see this reply". */}
          {askedAt ? (
            <Stack spacing={0.25}
              sx={{ p: 1.25, borderRadius: 1, backgroundColor: tokens.brassSoft }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                letterSpacing: "0.1em", color: "#5c4310" }}>
                {answeredOn ? `THEY ANSWERED ON ${answeredOn}` : "THEY HAVE ANSWERED"}
              </Typography>
              <LongText text={askedNote || "They asked for another look at it."}
                lines={6} />
            </Stack>
          ) : null}

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
            <Button
              size="small" variant="contained"
              loading={pending && !keeping} loadingPosition="start"
              onClick={() => send("up")}
              sx={{ flexShrink: 0 }}
            >
              Put it back
            </Button>
            {/* Only where there is an ask to answer. "Keep it down" on a
                listing nobody has asked about is a button for nothing. */}
            {askedAt ? (
              <Button
                size="small" variant="text"
                disabled={pending}
                onClick={() => { setKeeping(true); setAsking(true); }}
                sx={{ flexShrink: 0, color: tokens.danger }}
              >
                Keep it down
              </Button>
            ) : null}
          </Stack>
        </Stack>
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

      <Dialog open={asking} onClose={() => { setAsking(false); setKeeping(false); }}
        maxWidth="xs" fullWidth fullScreen={false}>
        <DialogTitle>
          {keeping ? `Keep ${name} down?` : `Take ${name} down?`}
        </DialogTitle>
        {/* Dispatched from onSubmit inside a transition rather than through
            `action`, because React 19 empties an uncontrolled form once its
            action has run: a refused save would wipe the reason and then ask
            for one. */}
        <Box component="form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            send(keeping ? "keep" : "down", String(form.get("reason") ?? ""));
          }}>
          <DialogContent>
            <DialogContentText sx={{ fontSize: "0.95rem", mb: 2 }}>
              {keeping
                ? "It stays exactly where it is. What changes is that the club "
                  + "hears back: they are told you have read what they said and "
                  + "what is still wrong, and the ask comes off this card."
                : kind === "club"
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
                label={keeping ? "What is still wrong" : "Reason"}
                fullWidth multiline minRows={2} required autoFocus
                slotProps={{ htmlInput: { maxLength: 1000 } }}
                helperText="The owner reads this, word for word."
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button variant="text"
              onClick={() => { setAsking(false); setKeeping(false); }}>Cancel</Button>
            <SubmitButton
              label={keeping ? "Tell them it stays down" : `Take the ${noun} down`}
              pendingLabel={keeping ? "Telling them" : "Taking it down"}
              size="medium" color="error" pending={pending} />
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
