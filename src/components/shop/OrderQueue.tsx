"use client";

import { startTransition, useActionState, useMemo, useRef, useState, useTransition } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import FilterBar from "@/components/account/FilterBar";
import {
  countClubOrders, filterClubOrders,
  type ClubOrderFilter, type ClubOrderSort,
} from "@/utils/club-order-filter";
import { shopAction, type ShopState } from "@/app/clubs/[slug]/(console)/shop/actions";
import { type MoneyAudience, type MoneyEvent } from "@/utils/money-events";
import OrderCard from "./OrderCard";
import OrderRefundDialog from "./OrderRefundDialog";
import { tokens, type Faction } from "@/lib/tokens";
import type { MerchOrder } from "@/types/clubExtras";
import { PER_PAGE } from "@/utils/paging";

/** What the refund dialog is working on, open or sliding shut. */
type RefundTarget = {
  id: number;
  status: string;
  method: string;
  note: string;
  /** Changing a refund already recorded, rather than recording one. */
  editing: boolean;
};

/**
 * The refund as it stands, read off the log rather than off a column.
 *
 * `MerchOrder` does not carry `refund_method` and `refund_note`, and the last
 * refund line holds both. Reading the log also means an edit opens on what
 * the member is currently reading, which is the thing being corrected.
 */
function lastRefund(log: MoneyEvent[]): MoneyEvent | null {
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i].kind === "refund") return log[i];
  }
  return null;
}

/**
 * The orders waiting on the club.
 *
 * Status is a select rather than four buttons: there are four states and only
 * one is ever right, so a row of buttons would be three wrong answers sitting
 * next to the correct one.
 */
export default function OrderQueue({
  orders, slug, faction,
}: {
  orders: MerchOrder[];
  slug: string;
  faction: Faction;
}) {
  const [state, submit, busy] = useActionState<ShopState, FormData>(shopAction, {});
  useActionToast(state);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ClubOrderFilter>("all");
  const [sort, setSort] = useState<ClubOrderSort>("recent");
  const [reordering, startReorder] = useTransition();

  const counts = useMemo(() => countClubOrders(orders), [orders]);
  const results = useMemo(
    () => filterClubOrders(orders, { query, filter, sort }), [orders, query, filter, sort]);
  // The dialog's target, held separately from whether it is open. MUI keeps
  // a dialog mounted through its exit transition, so clearing the values on
  // close empties the fields in front of somebody while it slides away.
  const [refunding, setRefunding] = useState<RefundTarget | null>(null);
  const [shownRefund, setShownRefund] = useState<RefundTarget | null>(null);
  const [audiences, setAudiences] = useState<Record<number, MoneyAudience>>({});
  const top = useRef<HTMLDivElement>(null);
  // Twelve, not the usual page: each order carries its own note log and status
  // control, so a page of them is far taller than a page of cards.
  const paged = usePagedList(results, PER_PAGE.cards, top);

  const openRefund = (target: RefundTarget) => {
    setShownRefund(target);
    setRefunding(target);
  };

  const setStatus = (orderId: number, status: string) => {
    // A refund is two more questions, and the member reads the answers. The
    // status on its own used to be the whole of it, so a club typed why into
    // the note box beside it — which is this club's working log and nobody
    // else's to read. That is the client's item 18.
    if (status === "refunded" || status === "refund_due") {
      // Empty on a status move: what the club writes is about the step they
      // are taking now. Editing an existing refund fills the fields instead.
      openRefund({ id: orderId, status, method: "", note: "", editing: false });
      return;
    }
    const data = new FormData();
    data.set("intent", "set-status");
    data.set("slug", slug);
    data.set("orderId", String(orderId));
    data.set("status", status);
    startTransition(() => submit(data));
  };

  const saveRefund = (method: string, note: string) => {
    if (!refunding) return;
    const data = new FormData();
    data.set("intent", "set-refund");
    data.set("slug", slug);
    data.set("orderId", String(refunding.id));
    data.set("status", refunding.status);
    data.set("refundMethod", method);
    data.set("refundNote", note);
    startTransition(() => submit(data));
    setRefunding(null);
  };

  const addNote = (orderId: number) => {
    const body = (drafts[orderId] ?? "").trim();
    if (!body) return;

    const data = new FormData();
    data.set("intent", "note");
    data.set("slug", slug);
    data.set("orderId", String(orderId));
    data.set("body", body);
    data.set("audience", audiences[orderId] ?? "club");
    startTransition(() => submit(data));
    setDrafts((d) => ({ ...d, [orderId]: "" }));
    // The choice does not stick. A club that told one member about a refund
    // should not silently publish the next note it types about a supplier.
    setAudiences((a) => ({ ...a, [orderId]: "club" }));
  };

  if (!orders.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        No orders yet. They appear here the moment a member places one.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {/* The same FilterBar as everywhere else. A club with forty orders was
          scrolling to find the one somebody is standing in front of them
          asking about. */}
      <FilterBar
        query={query}
        onQuery={(value) => startReorder(() => setQuery(value))}
        placeholder="Search by member, item or note"
        tabs={[
          { value: "all" as const, label: "All", count: counts.all },
          { value: "placed" as const, label: "Placed", count: counts.placed },
          { value: "paid" as const, label: "Paid", count: counts.paid },
          { value: "fulfilled" as const, label: "Collected", count: counts.fulfilled },
          { value: "cancelled" as const, label: "Cancelled", count: counts.cancelled },
          { value: "refund_due" as const, label: "Refund due", count: counts.refund_due },
          { value: "refunded" as const, label: "Refunded", count: counts.refunded },
        ]}
        filter={filter}
        onFilter={(value) => startReorder(() => setFilter(value))}
        sorts={[
          { value: "recent" as const, label: "Newest first" },
          { value: "value" as const, label: "Highest value" },
          { value: "name" as const, label: "Member name" },
        ]}
        sort={sort}
        onSort={(value) => startReorder(() => setSort(value))}
      />

      {!results.length ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Nothing matches. Clear the search or pick a different tab.
        </Typography>
      ) : null}

      <BusyOverlay busy={busy || reordering} label="Saving">
      <Stack ref={top} spacing={2}>
      {paged.shown.map((order) => (
        <OrderCard key={order.id}
          order={order}
          faction={faction}
          busy={busy}
          draft={drafts[order.id] ?? ""}
          audience={audiences[order.id] ?? "club"}
          onDraft={(value) => setDrafts((d) => ({ ...d, [order.id]: value }))}
          onAudience={(value) => setAudiences((a) => ({ ...a, [order.id]: value }))}
          onStatus={(status) => setStatus(order.id, status)}
          onEditRefund={() => {
            const was = lastRefund(order.log);
            openRefund({
              id: order.id, status: order.status,
              method: was?.method ?? "", note: was?.note ?? "", editing: true,
            });
          }}
          onAddNote={() => addNote(order.id)} />
      ))}
      </Stack>

      <Pager page={paged.page} total={paged.total} noun="orders" size={12}
        onChange={paged.goTo} />
      </BusyOverlay>

      <OrderRefundDialog
        open={refunding !== null}
        orderId={shownRefund?.id ?? 0}
        refundDue={shownRefund?.status === "refund_due"}
        editing={shownRefund?.editing ?? false}
        method={shownRefund?.method ?? ""}
        note={shownRefund?.note ?? ""}
        saving={busy}
        onClose={() => setRefunding(null)}
        onSave={saveRefund} />
    </Stack>
  );
}
