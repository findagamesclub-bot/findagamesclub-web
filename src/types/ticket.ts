/** A ticket type as the buyer sees it, including whether they may buy it. */
export type BuyableTicket = {
  id: number;
  label: string;
  price: string | null;
  unitAmount: number;
  /** Null when the club did not cap it. */
  remaining: number | null;
  /** Reserved on this type. The club sees it; a buyer has no use for it. */
  sold: number;
  soldOut: boolean;
  audienceLabel: string | null;
  /** Null when anyone may buy. Otherwise why they cannot. */
  blockedReason: string | null;
  inCart: number;
};

export type CartLine = {
  ticketTypeId: number;
  label: string;
  price: string | null;
  unitAmount: number;
  quantity: number;
  lineTotal: number;
};

export type EventCart = {
  lines: CartLine[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  currency: string;
  tierLabel: string | null;
};

export type EventBooking = {
  id: number;
  reference: string;
  eventId: number;
  eventTitle: string;
  eventDate: string | null;
  clubSlug: string;
  clubName: string;
  legacyId: string;
  fullName: string;
  email: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  currency: string;
  createdAt: string;
  lines: CartLine[];
};
