"use client";

import { startTransition, useActionState, useState } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import TuneIcon from "@mui/icons-material/Tune";
import EditBookingDialog from "./EditBookingDialog";
import { bookingAction, type BookingState } from "@/app/clubs/[slug]/bookings/actions";
import { tokens } from "@/lib/tokens";
import { nightLabel } from "@/utils/dates";
import type { Booking, CalendarSession } from "@/types/booking";
import type { QueueEntry } from "@/services/waitlist.service";

/**
 * The club's view of one night: every table, every person waiting, and the two
 * things only the club can do.
 *
 * In a dialog because it does not scale inline. A hall with forty tables would
 * put forty names and forty cancel buttons on the row, on every night, and the
 * list a member reads to find a free table would become an admin console.
 */
export default function ManageNight({
  session, queue, slug, people = [],
}: {
  session: CalendarSession;
  queue: QueueEntry[];
  slug: string;
  /** The club's approved members, so a table can be moved between them. */
  people?: { id: string; name: string }[];
}) {
  const [opened, setOpen] = useState(false);
  const fullScreen = useMediaQuery("(max-width:600px)");
  const [state, submit, busy] = useActionState<BookingState, FormData>(bookingAction, {});
  useActionToast(state);
  const [dropping, setDropping] = useState<Booking | null>(null);

  const dropTable = () => {
    if (!dropping) return;
    const data = new FormData();
    data.set("intent", "cancel");
    data.set("slug", slug);
    data.set("bookingId", String(dropping.id));
    startTransition(() => submit(data));
    setDropping(null);
  };

  // Each action re-renders the page underneath, so the dialog stays open and
  // shows the updated list rather than closing after every single cancel. It
  // closes itself only once there is nothing left in it to manage — derived,
  // not set from an effect, which would be a render scheduling a render.
  const open = opened && !(state.notice && !session.bookings.length && !queue.length);

  const seatsFree = session.tablesLeft;

  return (
    <>
      <Button size="small" variant="text" startIcon={<TuneIcon />} onClick={() => setOpen(true)}
        sx={{ color: tokens.inkMuted, fontSize: "0.78rem" }}>
        Manage night
      </Button>

      <ConfirmDialog
        open={Boolean(dropping)}
        title="Cancel this member's table?"
        body={dropping
          ? `${dropping.booker.name}'s table on ${nightLabel(session.date)} will be given up. `
            + "They are told straight away, and anybody on the waiting list is offered it."
          : ""}
        confirmLabel="Cancel their booking"
        cancelLabel="Leave it"
        destructive
        busy={busy}
        onConfirm={dropTable}
        onClose={() => setDropping(null)}
      />

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md" fullScreen={fullScreen}>
        <DialogTitle sx={{ pb: 1.5 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h4" component="span" sx={{ fontSize: "1.15rem" }}>Manage this night</Typography>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem",
                                color: tokens.inkMuted, letterSpacing: "0.04em" }}>
                {nightLabel(session.date).toUpperCase()} · {session.bookings.length} of {session.capacity} taken
              </Typography>
            </Box>
            <IconButton onClick={() => setOpen(false)} aria-label="Close" sx={{ flexShrink: 0 }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={3}>

            <Box>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                                letterSpacing: "0.1em", color: tokens.inkMuted, mb: 1 }}>
                TABLES
              </Typography>
              {session.bookings.length ? (
                <Stack>
                  {session.bookings.map((b) => (
                    <Stack key={b.id} direction="row" spacing={1.5}
                      sx={{ py: 1.25, borderTop: `1px solid ${tokens.rule}`, alignItems: "center" }}>
                      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                                        color: tokens.inkMuted, minWidth: 22 }}>
                        {String(b.tableIndex + 1).padStart(2, "0")}
                      </Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {b.booker.isViewer ? "You" : b.booker.name}
                          {b.opponent ? ` v ${b.opponent.isViewer ? "You" : b.opponent.name}` : ""}
                          {!b.opponent && b.acceptor
                            ? ` v ${b.acceptor.isViewer ? "You" : b.acceptor.name}` : ""}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.82rem" }}>
                          {b.gameTitle}
                        </Typography>
                      </Box>
                      <EditBookingDialog booking={b} slug={slug} people={people} />

                      {/* Asked for, not fired on click. Taking somebody else's
                          table away is worse than giving up your own: they are
                          not in the room, and the waiting list is offered it
                          straight away. */}
                      <Button size="small" variant="text" disabled={busy}
                        onClick={() => setDropping(b)}
                        startIcon={<EventBusyIcon />}
                        sx={{ color: tokens.inkMuted, fontSize: "0.75rem", flexShrink: 0,
                              "&:hover": { color: tokens.danger } }}>
                        Cancel
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">Nobody has booked yet.</Typography>
              )}
            </Box>

            <Box>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                                letterSpacing: "0.1em", color: tokens.inkMuted, mb: 1 }}>
                WAITING {queue.length ? `· ${seatsFree} ${seatsFree === 1 ? "table" : "tables"} free` : ""}
              </Typography>
              {queue.length ? (
                <Stack>
                  {queue.map((q) => (
                    <Stack key={q.id} direction="row" spacing={1.5}
                      sx={{ py: 1.25, borderTop: `1px solid ${tokens.rule}`, alignItems: "center" }}>
                      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                                        color: tokens.inkMuted, minWidth: 22 }}>
                        {q.position}
                      </Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {q.isMine ? "You" : q.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.82rem" }}>
                          {q.gameTitle}{q.skipped ? ` · ${q.skipped}` : ""}
                        </Typography>
                      </Box>
                      {/* Only when a table is actually free: the club cannot put
                          an eleventh person on ten tables either. */}
                      {seatsFree > 0 ? (
                        <form action={submit}>
                          <input type="hidden" name="intent" value="promote" />
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="entryId" value={q.id} />
                          <Button type="submit" size="small" variant="outlined" disabled={busy}
                            startIcon={<HowToRegIcon />}
                            sx={{ flexShrink: 0, color: tokens.ink, borderColor: tokens.rule,
                                  "&:hover": { borderColor: tokens.positive, color: tokens.positive } }}>
                            Give a table
                          </Button>
                        </form>
                      ) : null}
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">Nobody is waiting.</Typography>
              )}
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
