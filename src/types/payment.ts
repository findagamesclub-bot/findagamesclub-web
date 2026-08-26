/** One way to pay for a tier — monthly, yearly or a single up-front fee. */
export type BillingOption = {
  id: string;
  label: string;
  price: string;
  /** "month" | "year" | "one-off". Anything else is not payable. */
  cadence: string;
};

export type MembershipPayment = {
  id: number;
  /** Which tier this money was for. Standing is scoped by it. */
  tierKey: string | null;
  tierLabel: string;
  billingOptionLabel: string;
  price: string;
  priceDuration: string;
  periodStart: string | null;
  periodEnd: string | null;
  note: string | null;
  recordedAt: string;
};

/** Where a member's subscription stands right now. */
export type PaymentStanding = {
  /** Null when they have never paid, or the tier is free. */
  paidThrough: string | null;
  /** True once paidThrough is in the past. */
  overdue: boolean;
  /** A one-off fee that has already been settled cannot be charged again. */
  settledOneOff: boolean;
};
