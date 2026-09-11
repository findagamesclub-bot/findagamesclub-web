"use client";

import { startTransition, useActionState, useMemo, useState, useTransition } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SlotCard from "./SlotCard";
import BusyOverlay from "@/components/ui/BusyOverlay";
import NewSlotForm from "./NewSlotForm";
import FilterBar from "@/components/account/FilterBar";
import { coachingAction, type CoachingState } from "@/app/clubs/[slug]/(console)/coaching/actions";
import {
  countCoachingSlots, filterCoachingSlots, type SlotFilter, type SlotSort,
} from "@/utils/coaching-slot-filter";
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
  useActionToast(state);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SlotFilter>("all");
  const [sort, setSort] = useState<SlotSort>("soonest");
  const [sifting, startSift] = useTransition();

  const counts = useMemo(() => countCoachingSlots(slots), [slots]);
  const results = useMemo(
    () => filterCoachingSlots(slots, { query, filter, sort }), [slots, query, filter, sort]);

  const send = (fields: Record<string, string | number | boolean>) => {
    const data = new FormData();
    data.set("slug", slug);
    for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
    startTransition(() => submit(data));
  };

  return (
    <Stack spacing={2.5}>

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
        <>
        {/* The same bar as the orders queue and the bookings list. A club
            running a session a week has a year of them by next autumn. */}
        <FilterBar
          query={query}
          onQuery={(value) => startSift(() => setQuery(value))}
          placeholder="Search by name or description"
          tabs={[
            { value: "all" as const, label: "All", count: counts.all },
            { value: "open" as const, label: "Open", count: counts.open },
            // Only for somebody holding a place. An owner who has not booked
            // anything would get two tabs that are always empty.
            ...(counts.mine ? [
              { value: "mine" as const, label: "Yours", count: counts.mine },
              { value: "topay" as const, label: "To pay", count: counts.topay },
            ] : []),
            { value: "closed" as const, label: "Closed", count: counts.closed },
            { value: "cancelled" as const, label: "Called off", count: counts.cancelled },
          ]}
          filter={filter}
          onFilter={(value) => startSift(() => setFilter(value))}
          sorts={[
            { value: "soonest" as const, label: "Soonest first" },
            { value: "latest" as const, label: "Latest first" },
          ]}
          sort={sort}
          onSort={(value) => startSift(() => setSort(value))}
        />

        <BusyOverlay busy={busy || sifting} label="Saving">
        {results.length === 0 ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
            {query ? `No session matching "${query}".` : "Nothing in this group."}
          </Typography>
        ) : null}

        <Box sx={{ display: "grid", gap: 2,
                   gridTemplateColumns: {
                     xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))",
                   } }}>
          {results.map((slot) => (
            <Box key={slot.id}>
              <SlotCard
                slot={slot}
                slug={slug}
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
        </>
      )}
    </Stack>
  );
}
