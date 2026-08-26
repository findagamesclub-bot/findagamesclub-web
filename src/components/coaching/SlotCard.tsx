"use client";

import { useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Counter from "@/components/ui/Counter";
import { nightLabel } from "@/utils/dates";
import { tokens, type Faction } from "@/lib/tokens";
import type { CoachingSlot } from "@/types/clubExtras";

/**
 * One coaching slot, as a card in the calendar grid.
 *
 * Same shape as a kit card and an owner's club card: a coloured head, a body,
 * and one action along the foot. The counter carries the format rather than
 * the date — the date is already the head, and what a member chooses between
 * is a one-to-one and a group session.
 */
export default function SlotCard({
  slot, faction, busy, canManage, onBook, onCancel, onPaid, onStatus,
}: {
  slot: CoachingSlot;
  faction: Faction;
  busy: boolean;
  canManage: boolean;
  onBook: (slotId: number) => void;
  onCancel: (bookingId: number) => void;
  onPaid: (bookingId: number, paid: boolean) => void;
  onStatus: (slotId: number, status: string) => void;
}) {
  // Two different destructive acts: the club calling off a session for
  // everybody, and one member giving up their own place.
  const [confirming, setConfirming] = useState<"slot" | "mine" | null>(null);

  const full = slot.spacesLeft <= 0;
  const closed = slot.status !== "open";
  const group = slot.coachingType !== "one-to-one";

  return (
    <Stack
      sx={{
        height: "100%",
        border: `1px solid ${slot.mine ? faction.base : tokens.rule}`,
        borderRadius: 1.5,
        overflow: "hidden",
        backgroundColor: tokens.paper,
        opacity: closed ? 0.7 : 1,
      }}
    >
      <Stack direction="row" spacing={1.75}
        sx={{ px: 2, py: 1.5, alignItems: "center",
              backgroundColor: slot.mine ? faction.soft : tokens.surface,
              borderBottom: `1px solid ${tokens.rule}` }}>
        <Counter faction={faction} tone={slot.mine ? "solid" : "soft"}
          primary={group ? String(slot.capacity) : "1:1"}
          secondary={group ? "seats" : undefined} />

        <Stack spacing={0} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                            letterSpacing: "0.1em", color: faction.deep, fontWeight: 700 }}>
            {(nightLabel(slot.date) ?? "").toUpperCase()}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                            color: tokens.inkMuted }}>
            {slot.startTime}{slot.endTime ? `–${slot.endTime}` : ""}
          </Typography>
        </Stack>
      </Stack>

      <Stack spacing={0.75} sx={{ px: 2, pt: 1.75, pb: 1.5, flex: 1 }}>
        <Typography variant="h3" sx={{ fontSize: "1.05rem", lineHeight: 1.3 }}>
          {slot.title}
        </Typography>

        {slot.description ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {slot.description}
          </Typography>
        ) : null}

        <Stack direction="row" spacing={1.5} useFlexGap
          sx={{ flexWrap: "wrap", alignItems: "baseline", pt: 0.5 }}>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700 }}>
            {slot.price ?? "Free"}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                            letterSpacing: "0.08em",
                            color: full ? tokens.danger : tokens.inkMuted,
                            fontWeight: full ? 700 : 400 }}>
            {closed ? slot.status.toUpperCase()
              : full ? "FULL"
              : `${slot.spacesLeft} OF ${slot.capacity} LEFT`}
          </Typography>
        </Stack>

        {canManage && slot.attendees.length ? (
          <Stack spacing={0.5} sx={{ pt: 1.25, mt: 0.5, borderTop: `1px solid ${tokens.rule}` }}>
            {slot.attendees.map((a) => (
              <Stack key={a.id} direction="row" spacing={1.5}
                sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="body2" noWrap>{a.name}</Typography>
                <Button size="small" variant="text" disabled={busy}
                  onClick={() => onPaid(a.id, !a.paid)}
                  sx={{ fontSize: "0.72rem", textTransform: "none", flexShrink: 0,
                        color: a.paid ? tokens.positive : tokens.inkMuted }}>
                  {a.paid ? "Paid" : "Mark paid"}
                </Button>
              </Stack>
            ))}
          </Stack>
        ) : null}
      </Stack>

      <Box sx={{ px: 2, pb: 2, mt: "auto" }}>
        {/* The club runs the session — it does not queue for it. An owner gets
            the controls for the slot instead of a Book button. */}
        {canManage ? (
          <Stack direction="row" spacing={1}>
            {slot.status === "cancelled" ? (
              // Cancelling only sets a status, so putting it back is the same
              // control in reverse. The confirm dialog promises exactly this.
              <Button fullWidth variant="outlined" disabled={busy}
                onClick={() => onStatus(slot.id, "open")}
                sx={{ borderColor: tokens.rule, color: tokens.ink,
                      "&:hover": { borderColor: faction.base, color: faction.deep } }}>
                Put it back on
              </Button>
            ) : (
              <>
                <Button fullWidth variant="outlined" disabled={busy}
                  onClick={() => onStatus(slot.id, slot.status === "open" ? "closed" : "open")}
                  sx={{ borderColor: tokens.rule, color: tokens.ink,
                        "&:hover": { borderColor: faction.base, color: faction.deep } }}>
                  {slot.status === "open" ? "Close bookings" : "Reopen"}
                </Button>
                <Button variant="text" disabled={busy}
                  onClick={() => setConfirming("slot")}
                  sx={{ flexShrink: 0, color: tokens.inkMuted, textTransform: "none",
                        "&:hover": { color: tokens.danger, background: "none" } }}>
                  Cancel
                </Button>
              </>
            )}
          </Stack>
        ) : slot.mine ? (
          <Button fullWidth variant="outlined" disabled={busy}
            onClick={() => setConfirming("mine")}
            sx={{ borderColor: tokens.rule, color: tokens.inkMuted,
                  "&:hover": { borderColor: tokens.danger, color: tokens.danger } }}>
            Cancel my place
          </Button>
        ) : (
          <Button fullWidth variant="contained" disabled={busy || full || closed}
            onClick={() => onBook(slot.id)}
            sx={{ backgroundColor: faction.base,
                  "&:hover": { backgroundColor: faction.deep } }}>
            {closed ? "Closed" : full ? "Full" : "Book"}
          </Button>
        )}
      </Box>

      <ConfirmDialog
        open={confirming === "slot"}
        title="Cancel this session?"
        body={
          slot.attendees.length
            ? `${slot.title} is called off, and the ${slot.attendees.length === 1
                ? "one person" : `${slot.attendees.length} people`} booked on it stay on the record so you can tell them. Nothing is deleted, and you can reopen it later.`
            : `${slot.title} is called off. Nothing is deleted, and you can reopen it later.`
        }
        confirmLabel="Cancel the session"
        cancelLabel="Leave it running"
        destructive
        busy={busy}
        onConfirm={() => onStatus(slot.id, "cancelled")}
        onClose={() => setConfirming(null)}
      />

      <ConfirmDialog
        open={confirming === "mine"}
        title="Give up your place?"
        body={`Your place on ${slot.title} goes back into the pool. You can book it again if it is still open.`}
        confirmLabel="Give it up"
        destructive
        busy={busy}
        onConfirm={() => slot.mine && onCancel(slot.mine.id)}
        onClose={() => setConfirming(null)}
      />
    </Stack>
  );
}
