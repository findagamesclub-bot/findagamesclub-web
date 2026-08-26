"use client";

import { startTransition, useActionState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SlotCard from "./SlotCard";
import BusyOverlay from "@/components/ui/BusyOverlay";
import NewSlotForm from "./NewSlotForm";
import { coachingAction, type CoachingState } from "@/app/clubs/[slug]/coaching/actions";
import { tokens, type Faction } from "@/lib/tokens";
import type { CoachingSlot } from "@/types/clubExtras";

/** The calendar, and whatever the viewer is allowed to do to it. */
export default function CoachingCalendar({
  slots, slug, clubId, faction, canManage, isMember,
}: {
  slots: CoachingSlot[];
  slug: string;
  clubId: number;
  faction: Faction;
  canManage: boolean;
  isMember: boolean;
}) {
  const [state, submit, busy] = useActionState<CoachingState, FormData>(coachingAction, {});

  const send = (fields: Record<string, string | number | boolean>) => {
    const data = new FormData();
    data.set("slug", slug);
    for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
    startTransition(() => submit(data));
  };

  return (
    <Stack spacing={2.5}>
      {state.error ? <Alert severity="error">{state.error}</Alert> : null}
      {state.notice ? <Alert severity="success">{state.notice}</Alert> : null}

      {canManage ? (
        <NewSlotForm slug={slug} clubId={clubId} faction={faction} onSubmit={submit} busy={busy} />
      ) : null}

      {slots.length === 0 ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          {canManage
            ? "No slots yet. Add one above and it appears here for your members."
            : "No coaching is scheduled at the moment. Check back, or ask the club."}
        </Typography>
      ) : (
        <BusyOverlay busy={busy} label="Saving">
        <Box sx={{ display: "grid", gap: 2,
                   gridTemplateColumns: {
                     xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)",
                   } }}>
          {slots.map((slot) => (
            <Box key={slot.id}>
              <SlotCard
                slot={slot}
                faction={faction}
                busy={busy}
                canManage={canManage}
                onBook={(slotId) => (isMember ? send({ intent: "book", slotId }) : undefined)}
                onCancel={(bookingId) => send({ intent: "cancel", bookingId })}
                onPaid={(bookingId, paid) => send({ intent: "mark-paid", bookingId, paid })}
                onStatus={(slotId, status) => send({ intent: "set-slot-status", slotId, status })}
              />
            </Box>
          ))}
        </Box>
        </BusyOverlay>
      )}
    </Stack>
  );
}
