"use client";

import { startTransition, useActionState, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
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
import { useActionToast } from "@/components/ui/Toaster";
import { tokens, type Faction } from "@/lib/tokens";
import BookingPricePanel from "./BookingPricePanel";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { nightLabel } from "@/utils/dates";
import type { BookingStanding } from "@/utils/booking-pricing";
import type { CalendarSession } from "@/types/booking";

/**
 * Book or cancel one night.
 *
 * The form is a dialog, not an inline expander: these sit in a list, and
 * growing one card pushes every night below it down the page while the member
 * is reading.
 */
export default function BookingActions({
  session, clubId, slug, standing, faction, waitlistEnabled, myBookingId,
  canCancelMine, myQueueEntryId, queueLength, lfgEnabled, hasOpenPost, roster = [],
}: {
  /** Club members who can be named as the opponent. */
  roster?: { id: string; name: string }[];
  session: CalendarSession;
  clubId: number;
  slug: string;
  /** What this member pays, and what they can pay with. Null when signed out. */
  standing: BookingStanding | null;
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
  // Set only when a real member was picked; a typed name leaves it null.
  const [opponent, setOpponent] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [dropping, setDropping] = useState(false);

  const fullScreen = useMediaQuery("(max-width:600px)");

  /**
   * Success and failure both go to the toast, like every other action on the
   * site. A green box in the night's row pushed the list around and then sat
   * there after the reader had moved on; the row itself is the durable
   * confirmation anyway — your name at a table, a filled pip, and the button
   * changed to Cancel my table.
   */
  useActionToast(state);

  // A success closes the dialog, derived rather than set in an effect: an
  // effect that calls setState is a render scheduling another render, and the
  // dialog would spring back open the moment the next action started.
  const open = opened && !state.notice;

  const dropTable = () => {
    const data = new FormData();
    data.set("intent", "cancel");
    data.set("slug", slug);
    data.set("bookingId", String(myBookingId));
    startTransition(() => submit(data));
    setDropping(false);
  };

  return (
    <Stack spacing={1.25}>
      <ConfirmDialog
        open={dropping}
        title="Cancel this table?"
        body={`Your table on ${nightLabel(session.date)} will be given up, and anybody
               on the waiting list is offered it straight away.`}
        confirmLabel="Cancel the booking"
        cancelLabel="Keep it"
        destructive
        busy={busy}
        onConfirm={dropTable}
        onClose={() => setDropping(false)}
      />
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        {myBookingId && canCancelMine ? (
          // Asked for, not fired on click. Giving up a table is not undoable:
          // the waiting list is offered it the moment the row changes. The
          // account page has asked since it was built and this did not, which
          // is the same action behaving two ways.
          <Button variant="outlined" size="small" onClick={() => setDropping(true)}
            loading={busy} loadingPosition="start" startIcon={<EventBusyIcon />}
            sx={{ color: tokens.ink, borderColor: tokens.rule,
                  "&:hover": { color: tokens.danger, borderColor: tokens.danger } }}>
            Cancel my table
          </Button>
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
                // A member, not a typed name where we have the choice. A typed
                // name is a game against nobody: it cannot count toward either
                // player's record and never appears in theirs at all.
                <Autocomplete
                  freeSolo
                  options={roster}
                  // The list floats over the field below it, so it needs an
                  // edge of its own. Without one the label underneath reads
                  // through it and the whole thing looks broken.
                  slotProps={{
                    paper: {
                      sx: {
                        mt: 0.5,
                        border: `1px solid ${tokens.rule}`,
                        boxShadow: "0 10px 30px rgba(16,27,45,0.18)",
                      },
                    },
                  }}
                  getOptionLabel={(option) =>
                    typeof option === "string" ? option : option.name}
                  onChange={(_event, value) =>
                    setOpponent(typeof value === "string" || !value ? null : value.id)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      name="opponentName"
                      label="Playing with"
                      helperText={roster.length
                        ? "Pick a member so the game counts for both of you, or type any name."
                        : "Optional. Leave it blank if you are still after an opponent."}
                      slotProps={{
                        ...params.slotProps,
                        htmlInput: {
                          ...(params.slotProps?.htmlInput ?? {}),
                          maxLength: 120,
                        },
                      }}
                    />
                  )}
                />
              ) : null}
              <input type="hidden" name="opponentProfileId" value={opponent ?? ""} />
              <TextField
                name="notes"
                label="Anything the club should know"
                helperText="Optional. Terrain you need, a late arrival, a first game."
                multiline
                minRows={2}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
              {mode === "book" && standing ? (
                <BookingPricePanel standing={standing} points={points} onPoints={setPoints} />
              ) : null}

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
