/** Somebody you have marked as a rival at a club, and the record between you. */
export type Rivalry = {
  id: number;
  personId: string;
  personName: string;
  /** True when they have marked you back. */
  mutual: boolean;
  since: string;
};

export type MerchItem = {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  image: { src: string; alt: string } | null;
  price: string | null;
  stock: number;
  soldOut: boolean;
  /** Null when anyone may order. Otherwise the tier that would open it. */
  blockedReason: string | null;
};

/** What the viewer's tier does to merchandise, and what they can pay with. */
export type ShopStanding = {
  discountPercent: number;
  tierLabel: string | null;
  /** Points they hold at this club. */
  points: number;
  /** Pounds per point, or null when the club never set one. */
  pointValue: number | null;
  /** Share of a bill points may cover. Zero means points are not currency here. */
  redemptionCapPercent: number;
  /**
   * A bigger kit discount they could reach by upgrading, or null when they are
   * already on the best tier for it.
   */
  offer: { percent: number; tierLabel: string } | null;
  /** Points an order earns at this club. Zero when the club rewards nothing. */
  earnPerOrder: number;
};

export type MerchOrder = {
  id: number;
  personId: string;
  personName: string;
  status: "placed" | "paid" | "fulfilled" | "cancelled";
  notes: string;
  /** The club's own working log, oldest first. Members never see these. */
  log: { id: number; body: string; automatic: boolean; author: string; at: string }[];
  tierLabel: string | null;
  createdAt: string;
  lines: { name: string; price: string | null; quantity: number; lineTotal: number }[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  pointsSpent: number;
  pointsValue: number;
  total: number;
};

export type CoachingSlot = {
  id: number;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  price: string | null;
  coachingType: string;
  capacity: number;
  taken: number;
  spacesLeft: number;
  status: "open" | "closed" | "cancelled";
  /** The viewer's own booking on this slot, if they hold one. */
  mine: { id: number; paid: boolean } | null;
  /** Who is coming. Only the club receives these. */
  attendees: { id: number; name: string; paid: boolean }[];
};
