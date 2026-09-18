"use client";

import {
  startTransition, useActionState, useEffect, useMemo, useRef, useState, useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/account/FilterBar";
import Pager from "@/components/ui/Pager";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { usePagedList } from "@/hooks/usePagedList";
import { PER_PAGE } from "@/utils/paging";
import { useActionToast } from "@/components/ui/Toaster";
import NewEventDialog from "./NewEventDialog";
import EventRow from "./EventRow";
import CancelEventDialog from "./CancelEventDialog";
import {
  createEventAction, deleteEventAction, setEventStatusAction, type EventListState,
} from "./actions";
import {
  countManageEvents, filterManageEvents,
  type ManageEvent, type ManageEventSort, type ManageEventTab,
} from "@/utils/event-manage-filter";
import { mono, tokens } from "@/lib/tokens";
import type { Faction } from "@/lib/tokens";

/**
 * The club's own list of events.
 *
 * Four tabs rather than legacy's two, because drafts and cancellations are
 * ours: legacy has no draft state, so saving a title put an event in the
 * directory, and a cancelled event simply sat in the past list.
 */
export default function EventsList({
  slug, events, today, faction,
}: {
  slug: string;
  events: ManageEvent[];
  today: string;
  faction: Faction;
}) {
  const router = useRouter();
  const [made, create, creating] = useActionState<EventListState, FormData>(
    createEventAction, {});
  const [gone, remove, removing] = useActionState<EventListState, FormData>(
    deleteEventAction, {});
  const [moved, setStatus, moving] = useActionState<EventListState, FormData>(
    setEventStatusAction, {});
  useActionToast(made);
  useActionToast(gone);
  useActionToast(moved);

  const [tab, setTab] = useState<ManageEventTab>("upcoming");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ManageEventSort>("date");
  const [sifting, startSift] = useTransition();
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState<ManageEvent | null>(null);
  const [deleting, setDeleting] = useState<ManageEvent | null>(null);

  const counts = useMemo(() => countManageEvents(events, today), [events, today]);
  const results = useMemo(
    () => filterManageEvents(events, { tab, query, sort, today }),
    [events, tab, query, sort, today]);

  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PER_PAGE.rows, top);

  // Straight into the editor, because a draft with only a name is not
  // something anybody wants to look at on a list.
  //
  // In an effect and not during render: pushing a route while rendering sets
  // state on the Router mid-render, which React warns about and which shipped
  // once already on the notification bell.
  const opened = useRef<number | null>(null);
  useEffect(() => {
    if (!made.id || opened.current === made.id) return;
    opened.current = made.id;
    setAdding(false);
    router.push(`/clubs/${slug}/manage/events/${made.id}`);
  }, [made.id, router, slug]);

  const send = (
    action: (data: FormData) => void, fields: Record<string, string>,
  ) => {
    const data = new FormData();
    data.set("slug", slug);
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    startTransition(() => action(data));
  };

  const busy = removing || moving;

  return (
    <Stack spacing={2.5} ref={top}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: tokens.inkMuted }}>
          {`${counts.upcoming} COMING UP · ${counts.drafts} ${counts.drafts === 1 ? "DRAFT" : "DRAFTS"}`}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}
          onClick={() => setAdding(true)} sx={{ alignSelf: { xs: "stretch", sm: "auto" } }}>
          New event
        </Button>
      </Stack>

      <FilterBar
        query={query}
        onQuery={(value) => startSift(() => setQuery(value))}
        placeholder="Search by name or venue"
        tabs={[
          { value: "upcoming" as const, label: "Coming up", count: counts.upcoming },
          { value: "drafts" as const, label: "Drafts", count: counts.drafts },
          { value: "past" as const, label: "Past", count: counts.past },
          { value: "cancelled" as const, label: "Called off", count: counts.cancelled },
        ]}
        filter={tab}
        onFilter={(value) => startSift(() => setTab(value))}
        sorts={[
          { value: "date" as const, label: "By date" },
          { value: "tickets" as const, label: "Busiest first" },
          { value: "title" as const, label: "By name" },
        ]}
        sort={sort}
        onSort={(value) => startSift(() => setSort(value))}
      />

      <BusyOverlay busy={busy || sifting} variant="dim" label="Saving">
        <Stack spacing={1}>
          {results.length === 0 ? (
            events.length === 0 ? (
              <EmptyState
                title="No events yet"
                description="A tournament, an open day, a trip out. Start one as a draft and publish it when the details are settled."
              />
            ) : (
              <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
                {query ? `Nothing matching "${query}".` : "Nothing in this group."}
              </Typography>
            )
          ) : null}

          {paged.shown.map((event) => (
            <EventRow key={event.id} slug={slug} event={event} busy={busy}
              onPublish={() => send(setStatus,
                { eventId: String(event.id), status: "published" })}
              onUnpublish={() => send(setStatus,
                { eventId: String(event.id), status: "draft" })}
              onCancel={() => setCancelling(event)}
              onDelete={() => setDeleting(event)}
            />
          ))}
        </Stack>
      </BusyOverlay>

      <Pager page={paged.page} total={paged.total} noun="events"
        size={PER_PAGE.rows} onChange={paged.goTo} />

      <NewEventDialog open={adding} slug={slug} today={today} saving={creating}
        action={create} onClose={() => setAdding(false)} />

      <CancelEventDialog
        event={cancelling} saving={moving}
        onClose={() => setCancelling(null)}
        onConfirm={(reason) => {
          if (!cancelling) return;
          send(setStatus,
            { eventId: String(cancelling.id), status: "cancelled", reason });
          setCancelling(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.title ?? "this event"}?`}
        body="It goes for good, along with its tickets, notices and draw. An event somebody holds a ticket for cannot be deleted: cancel it instead."
        confirmLabel="Delete event" destructive
        onConfirm={() => {
          if (!deleting) return;
          send(remove, { eventId: String(deleting.id), legacyId: deleting.legacyId });
          setDeleting(null);
        }}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  );
}
