"use client";

import { useActionState, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import Box from "@mui/material/Box";
import CloseIcon from "@mui/icons-material/Close";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import HandshakeIcon from "@mui/icons-material/Handshake";
import { bookingAction, type BookingState } from "@/app/clubs/[slug]/bookings/actions";
import { tokens, type Faction } from "@/lib/tokens";
import { nightLabel } from "@/utils/dates";
import type { CalendarSession } from "@/types/booking";

/**
 * Book or cancel one night.
 *
 * The form is a dialog, not an inline expander: these sit in a list, and
 * growing one card pushes every night below it down the page while the member
 * is reading.
 */
export default function BookingActions({
  session, clubId, slug, price, faction, waitlistEnabled, myBookingId, canCancelMine,
  myQueueEntryId, queueLength, lfgEnabled, hasOpenPost,
}: {
  session: CalendarSession;
  clubId: number;
  slug: string;
  price: string | null;
  faction: Faction;
  waitlistEnabled: boolean;
  myBookingId: number | null;
  canCancelMine: boolean;
  myQueueEntryId: number | null;
  queueLength: number;
  lfgEnabled: boolean;
  hasOpenPost: boolean;
}) {
  // The dialog books or queues depending on how it was opened; the fields are
  // the same either way, so it is one form rather than two near-identical ones.
  const [mode, setMode] = useState<"book" | "waitlist" | "lfg-post">("book");
  const [state, submit, busy] = useActionState<BookingState, FormData>(bookingAction, {});
  const [opened, setOpened] = useState(false);

  const fullScreen = useMediaQuery("(max-width:600px)");

  /**
   * A success notice is a confirmation of something you just did, so it is
   * transient. Left to persist it lingers on one night and not another,
   * depending on whether the page happened to reload in between — which is
   * exactly what it looked like: two identical bookings, one with a green box
   * and one without.
   *
   * The row itself is the durable confirmation: your name at a table, a filled
   * pip, and the button changed to Cancel my table.
   */
  const [dismissed, setDismissed] = useState<BookingState | null>(null);
  const notice = state.notice && dismissed !== state ? state.notice : null;

  // A success both closes the dialog and shows the notice, so both are derived
  // from the same fact. Copying either into state inside the effect would be a
  // render scheduling another render.
  const open = opened && !notice;

  useEffect(() => {
    if (!notice) return;
    // Also clears `opened`, or the dialog would spring back open the moment
    // the notice expired.
    const timer = setTimeout(() => { setDismissed(state); setOpened(false); }, 6000);
    return () => clearTimeout(timer);
  }, [notice, state]);

  return (
    <Stack spacing={1.25}>
      {notice ? <Alert severity="success" sx={{ fontSize: "0.85rem" }}>{notice}</Alert> : null}
      {state.error && !open ? (
        <Alert severity="error" sx={{ fontSize: "0.85rem" }}>{state.error}</Alert>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        {myBookingId && canCancelMine ? (
          <form action={submit}>
            <input type="hidden" name="intent" value="cancel" />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="bookingId" value={myBookingId} />
            <Button type="submit" variant="outlined" size="small"
              loading={busy} loadingPosition="start" startIcon={<EventBusyIcon />}
              sx={{ color: tokens.ink, borderColor: tokens.rule,
                    "&:hover": { color: tokens.danger, borderColor: tokens.danger } }}>
              Cancel my table
            </Button>
          </form>
        ) : myBookingId ? (
          <Typography variant="body2" color="text.secondary">
            Tonight&rsquo;s tables cannot be cancelled. Speak to the club.
          </Typography>
        ) : myQueueEntryId ? (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem",
                              color: tokens.brass, fontWeight: 600 }}>
              ON THE WAITING LIST
            </Typography>
            <form action={submit}>
              <input type="hidden" name="intent" value="leave-waitlist" />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="entryId" value={myQueueEntryId} />
              {/* Outlined, not text: a bare label reads as a caption, and
                  leaving a queue is a real action with a real consequence. */}
              <Button type="submit" variant="outlined" size="small" loading={busy}
                loadingPosition="start" startIcon={<CloseIcon />}
                sx={{ color: tokens.ink, borderColor: tokens.rule,
                      "&:hover": { color: tokens.danger, borderColor: tokens.danger } }}>
                Leave the list
              </Button>
            </form>
          </Stack>
        ) : session.blockedBy === "full" && waitlistEnabled ? (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="outlined" size="small" startIcon={<HourglassTopIcon />}
              onClick={() => { setMode("waitlist"); setOpened(true); }}
              sx={{ color: tokens.ink, borderColor: tokens.rule,
                    "&:hover": { borderColor: faction.base, color: faction.deep } }}>
              Join the waiting list
            </Button>
            {queueLength ? (
              <Typography variant="body2" color="text.secondary">
                {queueLength} {queueLength === 1 ? "person is" : "people are"} waiting.
              </Typography>
            ) : null}
          </Stack>
        ) : session.blockedReason ? (
          <Typography variant="body2" color="text.secondary"
            sx={{ maxWidth: 380, textAlign: { md: "right" } }}>
            {session.blockedReason}
          </Typography>
        ) : (
          <Button variant="contained" size="small" startIcon={<TableRestaurantIcon />}
            onClick={() => { setMode("book"); setOpened(true); }}>
            Book a table
          </Button>
        )}

        {/* Offered beside booking, not instead of it: a member who wants an
            opponent still needs a table, and the post is how they find one. */}
        {lfgEnabled && !myBookingId && !hasOpenPost && !session.isFull && !session.blockedReason ? (
          <Button variant="text" size="small" startIcon={<HandshakeIcon />}
            onClick={() => { setMode("lfg-post"); setOpened(true); }}
            sx={{ color: tokens.inkMuted }}>
            Find an opponent
          </Button>
        ) : null}
      </Stack>

      <Dialog open={open} onClose={() => setOpened(false)} fullWidth maxWidth="sm" fullScreen={fullScreen}>
        <DialogTitle sx={{ pb: 1.5 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>
                {mode === "book" ? "Book a table"
                  : mode === "waitlist" ? "Join the waiting list"
                  : "Find an opponent"}
              </Typography>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem",
                                color: tokens.inkMuted, letterSpacing: "0.04em" }}>
                {nightLabel(session.date).toUpperCase()} · {session.time}
                {price ? ` · ${price}` : ""}
              </Typography>
            </Box>
            <IconButton onClick={() => setOpened(false)} aria-label="Close" sx={{ flexShrink: 0 }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          <Box component="form" action={submit}>
            <input type="hidden" name="intent" value={mode} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="clubSessionId" value={session.clubSessionId} />
            <input type="hidden" name="sessionDate" value={session.date} />
            <input type="hidden" name="clubId" value={clubId} />
            <Stack spacing={2}>
              {/* Inside the dialog, because a failure leaves the dialog open and
                  an alert on the row behind it would be invisible. */}
              {state.error ? (
                <Alert severity="error" sx={{ fontSize: "0.85rem" }}>{state.error}</Alert>
              ) : null}
              {mode === "waitlist" ? (
                <Typography variant="body2" color="text.secondary">
                  Every table is taken. If somebody cancels, the longest wait gets the table
                  automatically and we will email you.
                </Typography>
              ) : mode === "lfg-post" ? (
                <Typography variant="body2" color="text.secondary">
                  No opponent yet? Say what you want to play and the rest of the club will
                  see it on this night. When someone says yes, we book a table with both
                  of your names on it.
                </Typography>
              ) : null}
              <TextField
                name="gameTitle"
                label="What are you playing"
                placeholder="Warhammer 40,000"
                required
                fullWidth
                autoFocus
                slotProps={{ htmlInput: { maxLength: 120 } }}
              />
              {mode === "book" ? (
                <TextField
                  name="opponentName"
                  label="Playing with"
                  helperText="Optional. Leave it blank if you are still after an opponent."
                  fullWidth
                  slotProps={{ htmlInput: { maxLength: 120 } }}
                />
              ) : null}
              <TextField
                name="notes"
                label="Anything the club should know"
                helperText="Optional. Terrain you need, a late arrival, a first game."
                multiline
                minRows={2}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
              <Button type="submit" variant="contained" size="large" fullWidth
                loading={busy} loadingPosition="start"
                startIcon={mode === "book" ? <TableRestaurantIcon />
                  : mode === "waitlist" ? <HourglassTopIcon /> : <HandshakeIcon />}
                sx={{ bgcolor: faction.base, color: "#FFFFFF",
                      "&:hover": { bgcolor: faction.deep } }}>
                {mode === "book" ? "Book this table"
                  : mode === "waitlist" ? "Join the list" : "Post it"}
              </Button>
            </Stack>
          </Box>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
