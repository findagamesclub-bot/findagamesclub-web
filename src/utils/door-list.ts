/**
 * The list a club works from on the day.
 *
 * Separate from `attendee-filter.ts`, which is the read-only view that shipped
 * in Stage 5. This one carries what the club has written down since: who has
 * paid, who has walked in, and who rang to cancel.
 *
 * Money here is a label, not a transaction. Nothing in the app takes payment,
 * so "paid" means somebody at the door said so.
 */

export const PAYMENT_STATUSES = ["unpaid", "paid_on_the_door", "paid_in_advance"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REFUND_STATUSES = ["not_due", "due", "refunded"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const DOOR_TABS = ["all", "reserved", "paid", "checkedin", "cancelled"] as const;
export type DoorTab = (typeof DOOR_TABS)[number];

export const DOOR_SORTS = ["name", "newest", "value"] as const;
export type DoorSort = (typeof DOOR_SORTS)[number];

export type DoorRow = {
  bookingId: number;
  profileId: string | null;
  fullName: string;
  email: string;
  reference: string;
  status: string;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  checkedInAt: string | null;
  refundStatus: RefundStatus;
  cancelReason: string;
  notes: string;
  tickets: number;
  total: number;
  createdAt: string;
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  paid_on_the_door: "Paid on the door",
  paid_in_advance: "Paid in advance",
};

export const REFUND_LABELS: Record<RefundStatus, string> = {
  not_due: "Not due",
  due: "Refund due",
  refunded: "Refunded",
};

const fold = (value: string) => value.trim().toLowerCase();

const isCancelled = (row: DoorRow) => row.status === "cancelled";
const isPaid = (row: DoorRow) => row.paymentStatus !== "unpaid";

function inTab(row: DoorRow, tab: DoorTab): boolean {
  if (tab === "all") return true;
  if (tab === "cancelled") return isCancelled(row);
  // Everything else is about people who still hold a place, so a cancellation
  // drops out of all three rather than sitting in Reserved looking live.
  if (isCancelled(row)) return false;
  if (tab === "checkedin") return Boolean(row.checkedInAt);
  if (tab === "paid") return isPaid(row);
  return !isPaid(row) && !row.checkedInAt;
}

export function countDoorRows(rows: DoorRow[]): Record<DoorTab, number> {
  const counts: Record<DoorTab, number> = {
    all: 0, reserved: 0, paid: 0, checkedin: 0, cancelled: 0,
  };
  for (const tab of DOOR_TABS) counts[tab] = rows.filter((row) => inTab(row, tab)).length;
  return counts;
}

export function filterDoorRows(
  rows: DoorRow[], params: { tab: DoorTab; query?: string; sort?: DoorSort },
): DoorRow[] {
  const needle = fold(params.query ?? "");

  const matched = rows.filter((row) => {
    if (!inTab(row, params.tab)) return false;
    if (!needle) return true;
    // Name, email and reference: the three things somebody at the door has.
    return fold(row.fullName).includes(needle)
      || fold(row.email).includes(needle)
      || fold(row.reference).includes(needle);
  });

  const sort = params.sort ?? "name";
  return [...matched].sort((a, b) => {
    if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
    if (sort === "value") return b.total - a.total;
    return a.fullName.localeCompare(b.fullName) || b.createdAt.localeCompare(a.createdAt);
  });
}

/** What the club still has to collect, which is the number they ask for. */
export function owed(rows: DoorRow[]): { people: number; amount: number } {
  const live = rows.filter((row) => !isCancelled(row) && !isPaid(row));
  return {
    people: live.length,
    amount: live.reduce((sum, row) => sum + row.total, 0),
  };
}
