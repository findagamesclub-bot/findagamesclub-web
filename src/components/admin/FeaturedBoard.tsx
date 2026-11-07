"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import BusyOverlay from "@/components/ui/BusyOverlay";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import UrlFilterBar from "@/components/ui/UrlFilterBar";
import FeaturedBookForm from "@/components/admin/FeaturedBookForm";
import FeaturedPaymentDialog, { type PayableSlot }
  from "@/components/admin/FeaturedPaymentDialog";
import FeaturedSlotCard from "@/components/admin/FeaturedSlotCard";
import type { FeaturedList, FeaturedSlot } from "@/services/featured.service";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { featuredAction, type FeaturedState } from "@/app/admin/featured/actions";
import {
  FEATURED_DEFAULTS, FEATURED_SORTS, FEATURED_TABS, FEATURED_WHEN,
  clubChoices, monthChoices, type FeaturedFilters,
} from "@/utils/featured-filters";

/**
 * Who leads the homepage, and when.
 *
 * Dated slots rather than a flag, because a slot that ends on its own is a slot
 * nobody has to remember to take down, and a slot with a price is a row the
 * treasurer can add up. The old `spotlight` flag still fills whatever is left,
 * so the front page is never empty before anybody has bought anything.
 *
 * Filtered, counted and paged in SQL (0226). The client asked for it because
 * "when lots of featured bookings are added, it will be hard to navigate", and
 * this screen drew every slot the site had ever sold as a card.
 */
export default function FeaturedBoard({
  list, filters, clubs, today, defaultPricePence, defaultDays, showing,
  prefillClubId = null, requestId = null,
}: {
  list: FeaturedList;
  filters: FeaturedFilters;
  clubs: { id: number; name: string; city: string }[];
  today: string;
  defaultPricePence: number;
  defaultDays: number;
  /** Which tab the address asked for. Booking a slot is a form; the slots are
   *  a list; stacking them put a form of five fields above the thing the page
   *  is usually opened to look at. */
  showing: "slots" | "book";
  prefillClubId?: number | null;
  requestId?: number | null;
}) {
  const [state, act, working] =
    useActionState<FeaturedState, FormData>(featuredAction, {});
  useActionToast(state);

  // A booking made on this tab lands on the other one, so without this you
  // press Book the slot, get a toast, and the page you are looking at does not
  // change. Only from the booking tab: a removal happens on the slots tab and
  // the list under it is already right.
  const router = useRouter();
  useActionSuccess(state, () => {
    if (showing === "book") router.push("/admin/featured");
  });

  const [, start] = useTransition();
  const [sifting, setSifting] = useState(false);
  const [ending, setEnding] = useState<FeaturedSlot | null>(null);
  const [paying, setPaying] = useState<PayableSlot | null>(null);

  // Closed on the answer landing, not on the click: closing on the click takes
  // a refusal off the screen along with whatever was typed into it.
  useActionSuccess(state, () => setPaying(null));

  // What the pager and the filter bar both have to carry, so page two of
  // "Didcot, unpaid" is page two of the same list rather than page two of
  // everything wearing its link.
  const held = {
    q: filters.query || undefined,
    state: list.state || undefined,
    when: list.when || undefined,
    month: filters.month || undefined,
    club: filters.club || undefined,
    sort: list.sort === "newest" ? undefined : list.sort,
  };

  return (
    <Stack spacing={2.5}>
      {showing === "book" ? (
        <FeaturedBookForm
          prefillClubId={prefillClubId}
          requestId={requestId}
          clubs={clubs} today={today}
          defaultPricePence={defaultPricePence} defaultDays={defaultDays}
          act={act} working={working} />
      ) : null}

      {/* No panel around the slots: the tab above already says "Slots", and a
          heading that repeats the tab you just pressed is a heading doing
          nothing. The booking form keeps its frame, because a form benefits
          from one and the other admin lists render bare. */}
      {showing === "slots" ? (
      <>
        {/* The money is the tab row and the calendar is a picker beside it,
            because they are two axes: a slot can be running today AND unpaid,
            which is the one row on this screen somebody has to act on. Tabs
            imply one choice at a time, so folding them together would mean
            picking either word hid it. */}
        <UrlFilterBar
          query={filters.query}
          placeholder="Search by club, town or note"
          tab={list.state}
          tabs={FEATURED_TABS.map((tab) => ({
            value: tab.key, label: tab.label,
            count: list.counts[tab.key || "all"] ?? 0,
          }))}
          sort={list.sort}
          sorts={FEATURED_SORTS}
          pickers={[
            { label: "When", param: "when", value: list.when, options: FEATURED_WHEN },
            // Only where there is more than one to tell apart. A picker
            // offering the single month that exists is a control that cannot
            // narrow anything, which is the rule the roster filters follow.
            ...(list.facets.months.length > 1 ? [{
              label: "Month", param: "month", value: filters.month,
              options: monthChoices(list.facets, filters.month),
            }] : []),
            ...(list.facets.clubs.length > 1 ? [{
              label: "Club", param: "club", value: filters.club,
              options: clubChoices(list.facets, filters.club),
            }] : []),
          ]}
          defaults={FEATURED_DEFAULTS}
          onBusy={setSifting}
        />

        <BusyOverlay busy={sifting} variant="dim" label="Filtering slots">
          <Stack spacing={2}>
            {list.failed ? (
              <EmptyState
                title="The slots would not load"
                description="Nothing was read, so this is not an empty list. Check the database is reachable and that the latest migrations have been run, then try again."
              />
            ) : list.rows.length === 0 ? (
              list.counts.all === 0 && !filters.query && !list.when
                && !filters.month && !filters.club ? (
                <EmptyState
                  title="Nobody has bought a slot"
                  description="Until somebody does, the homepage leads with the clubs marked spotlight and never calls them featured."
                />
              ) : (
                <EmptyState
                  title="No slot matches that"
                  description="Try another month or club, or clear the filters to see every slot that has been sold."
                />
              )
            ) : (
              <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                         gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                                sm: "repeat(2, minmax(0, 1fr))",
                                                lg: "repeat(3, minmax(0, 1fr))" } }}>
                {list.rows.map((slot) => (
                  <FeaturedSlotCard key={slot.id} slot={slot} today={today}
                    onRemove={() => setEnding(slot)}
                    onPay={slot.pricePence > 0 ? () => setPaying({
                      id: slot.id, clubName: slot.clubName,
                      startsOn: slot.startsOn, endsOn: slot.endsOn,
                      pricePence: slot.pricePence, currency: slot.currency,
                      paidAt: slot.paidAt, method: slot.paymentMethod,
                      note: slot.paymentNote,
                    }) : null} />
                ))}
              </Box>
            )}

            <Pager page={list.page} total={list.total} size={list.perPage}
              noun="slots" href={{ path: "/admin/featured", params: held }} />
          </Stack>
        </BusyOverlay>
      </>
      ) : null}

      <FeaturedPaymentDialog
        slot={paying}
        saving={working}
        onClose={() => setPaying(null)}
        onSave={(fields) => {
          const data = new FormData();
          data.set("intent", "payment");
          data.set("slot", String(paying?.id ?? 0));
          data.set("paid", fields.paid);
          data.set("method", fields.method);
          data.set("note", fields.note);
          start(() => act(data));
        }}
      />

      <ConfirmDialog
        open={ending !== null}
        title={`Remove ${ending?.clubName ?? "this slot"}?`}
        body="The slot goes for good. If it is running now the club drops off the homepage straight away; the payment stays on the record."
        confirmLabel="Remove it"
        destructive
        busy={working}
        onConfirm={() => {
          const data = new FormData();
          data.set("intent", "remove");
          data.set("slot", String(ending?.id ?? 0));
          start(() => act(data));
        }}
        onClose={() => setEnding(null)}
      />
    </Stack>
  );
}
