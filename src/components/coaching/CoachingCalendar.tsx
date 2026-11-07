"use client";

import { startTransition, useActionState, useMemo, useRef, useState, useTransition } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SlotCard from "./SlotCard";
import BusyOverlay from "@/components/ui/BusyOverlay";
import SlotForm from "./SlotForm";
import FilterBar from "@/components/account/FilterBar";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import { PER_PAGE } from "@/utils/paging";
import { coachingAction, type CoachingState } from "@/app/clubs/[slug]/(console)/coaching/actions";
import {
  countCoachingSlots, filterCoachingSlots, type SlotFilter, type SlotSort,
} from "@/utils/coaching-slot-filter";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { CoachingSlot, CoachingStanding } from "@/types/clubExtras";

/** The calendar, and whatever the viewer is allowed to do to it. */
export default function CoachingCalendar({
  slots, slug, clubId, faction, canManage, isMember, today = "",
  standing = null, startOn = "all",
}: {
  slots: CoachingSlot[];
  slug: string;
  clubId: number;
  faction: Faction;
  canManage: boolean;
  isMember: boolean;
  /**
   * Today as a London day, so the list can tell a session that has happened
   * from one that is still to come. The server knows the day; the browser's
   * own clock is the wrong one to ask about a club night.
   */
  today?: string;
  /** One read for the page; each card quotes itself from it. */
  standing?: CoachingStanding | null;
  /**
   * The tab the page opens on. Both screens open on Active, which is the same
   * call the events console makes with Coming up: a club a year in has far
   * more sessions behind it than ahead, and the ones anybody can still do
   * something about are the ones to lead with. `all` is the default for
   * anything that passes no day, where nothing can be past.
   */
  startOn?: SlotFilter;
}) {
  const [state, submit, busy] = useActionState<CoachingState, FormData>(coachingAction, {});
  useActionToast(state);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SlotFilter>(startOn);
  const [sort, setSort] = useState<SlotSort>("soonest");
  const [sifting, startSift] = useTransition();
  /** Which session is open for changing. One dialog, not one per card. */
  const [editing, setEditing] = useState<number | null>(null);

  const counts = useMemo(() => countCoachingSlots(slots, today), [slots, today]);
  const results = useMemo(
    () => filterCoachingSlots(slots, { query, filter, sort, today }),
    [slots, query, filter, sort, today]);

  // Both screens carry every session a club has ever run now, so this is a
  // list that grows for ever: a club coaching weekly has fifty a year and
  // nothing here was bounding the grid. Same pager and same page size as the
  // orders queue and the bookings list, because these are the same cards.
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PER_PAGE.cards, top);

  const send = (fields: Record<string, string | number | boolean>) => {
    const data = new FormData();
    data.set("slug", slug);
    for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
    startTransition(() => submit(data));
  };

  return (
    <Stack spacing={2.5} ref={top}>

      {canManage ? (
        <SlotForm slug={slug} clubId={clubId} faction={faction} onSubmit={submit} busy={busy} />
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
            // What anybody can still book. It replaced an Open tab that read
            // the status and not the date, so a club with a year behind it
            // opened Open and found seven sessions, six of them over.
            { value: "active" as const, label: "Active", count: counts.active },
            // Only for somebody holding a place. An owner who has not booked
            // anything would get two tabs that are always empty.
            //
            // "Yours" was read as the club's own sessions, which is what a
            // club secretary would reasonably take it for on their own
            // console. The tab says whose place it is now, because the only
            // thing it has ever filtered on is a booking in your name.
            ...(counts.mine ? [
              { value: "mine" as const, label: "Booked by you", count: counts.mine },
              { value: "topay" as const, label: "To pay", count: counts.topay },
            ] : []),
            { value: "closed" as const, label: "Closed", count: counts.closed },
            { value: "cancelled" as const, label: "Called off", count: counts.cancelled },
            // Only where there are any. A page that passes no day has none,
            // which is what keeps this tab off a screen that cannot say what
            // today is.
            ...(counts.past ? [
              { value: "past" as const, label: "Past", count: counts.past },
            ] : []),
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

        {/* Both screens carry the whole history now, so the line that used to
            say the club was seeing more than its members no longer would be
            true. What is still worth saying is that the list goes back, since
            a club opening on Active sees one session and has seven. */}
        {counts.past ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted }}>
            {`${counts.past} past ${counts.past === 1 ? "session is" : "sessions are"} `
              + "here to look back at, on Past."}
          </Typography>
        ) : null}

        <BusyOverlay busy={busy || sifting} label="Saving">
        {results.length === 0 ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
            {query ? `No session matching "${query}".`
              : filter === "active"
                // "Put one up above" is a form only the club can see, so a
                // member landing here was told to do something they cannot.
                ? canManage
                  ? "Nothing is open for booking. Put one up above, or look at All."
                  : "Nothing is open for booking right now. Past has what this club has run."
                : "Nothing in this group."}
          </Typography>
        ) : null}

        <Box sx={{ display: "grid", gap: 2,
                   gridTemplateColumns: {
                     xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))",
                   } }}>
          {paged.shown.map((slot) => (
            <Box key={slot.id}>
              <SlotCard
                slot={slot}
                slug={slug}
                faction={faction}
                today={today}
                busy={busy}
                canManage={canManage}
                standing={isMember ? standing : null}
                onEdit={canManage ? () => setEditing(slot.id) : undefined}
                onBook={(slotId, points) =>
                  (isMember ? send({ intent: "book", slotId, points }) : undefined)}
                onCancel={(bookingId) => send({ intent: "cancel", bookingId })}
                onPaid={(bookingId, paid) => send({ intent: "mark-paid", bookingId, paid })}
                onStatus={(slotId, status) => send({ intent: "set-slot-status", slotId, status })}
              />
            </Box>
          ))}
        </Box>

        <Pager page={paged.page} total={paged.total} noun="sessions"
          size={PER_PAGE.cards} onChange={paged.goTo} />
        </BusyOverlay>
        </>
      )}

      {/* One dialog for whichever session is being changed, rather than one
          mounted per card. Keyed on the slot so opening a second one starts
          from its own values instead of the first one's. */}
      {editing !== null && slots.find((one) => one.id === editing) ? (
        <SlotForm
          key={editing}
          slug={slug} clubId={clubId} faction={faction} busy={busy}
          slot={slots.find((one) => one.id === editing)!}
          open
          onClose={() => setEditing(null)}
          onSubmit={submit}
        />
      ) : null}
    </Stack>
  );
}
