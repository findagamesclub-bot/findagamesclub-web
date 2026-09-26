/**
 * Where a listing's subscription stands, in words.
 *
 * The database computes `standing` on read (0111) and this is the only place
 * that turns it into a label, a tone and a sentence. Two copies of that would
 * drift, and the one that drifted would be the one the club reads.
 *
 * Nothing here decides anything: the view is the authority and this is how it
 * is said. The one judgement it makes is which of these deserves an admin's
 * attention, and that is the tab counts on the billing screen.
 */

export const STANDINGS = [
  "not_required", "awaiting_payment", "active", "in_grace",
  "lapsed", "cancelled", "payment_failed",
] as const;

export type Standing = (typeof STANDINGS)[number];

export function isStanding(value: string): value is Standing {
  return (STANDINGS as readonly string[]).includes(value);
}

/**
 * What each one is called.
 *
 * "Free listing" rather than "not required", because a club reading its own
 * billing page should be told it owes nothing, not shown a flag name.
 */
export const STANDING_LABELS: Record<Standing, string> = {
  not_required: "Free listing",
  awaiting_payment: "Awaiting payment",
  active: "Paid up",
  in_grace: "Overdue",
  lapsed: "Lapsed",
  cancelled: "Cancelled",
  payment_failed: "Payment failed",
};

export type StandingTone = "neutral" | "warn" | "good" | "bad";

export const STANDING_TONES: Record<Standing, StandingTone> = {
  not_required: "neutral",
  awaiting_payment: "warn",
  active: "good",
  in_grace: "warn",
  lapsed: "bad",
  cancelled: "neutral",
  payment_failed: "bad",
};

export function standingLabel(value: string): string {
  return isStanding(value) ? STANDING_LABELS[value] : value;
}

export function standingTone(value: string): StandingTone {
  return isStanding(value) ? STANDING_TONES[value] : "neutral";
}

/**
 * The ones an admin has to do something about.
 *
 * `in_grace` and `lapsed` are money owed; `awaiting_payment` is a listing
 * waiting to go live. A paid-up club is not work, and neither is a cancelled
 * one, which is why the badge counts these three and nothing else.
 */
export function needsAttention(value: string): boolean {
  return value === "awaiting_payment" || value === "in_grace" || value === "lapsed";
}

/**
 * The tabs on the admin billing screen, in the order somebody works.
 *
 * Overdue leads because it is money already late. Awaiting payment is next
 * because it is a club that cannot go live until somebody acts.
 */
export const BILLING_TABS: { key: Standing | "all"; label: string }[] = [
  { key: "in_grace", label: "Overdue" },
  { key: "awaiting_payment", label: "Awaiting payment" },
  { key: "lapsed", label: "Lapsed" },
  { key: "active", label: "Paid up" },
  { key: "all", label: "All" },
];

/**
 * How a club is told where it stands, on its own billing page.
 *
 * Says what happened and what to do next, which is the whole job: somebody
 * whose listing has gone should not have to work out whether the ball is with
 * them.
 */
export function ownerStanding(
  standing: string,
  detail: { paidTo?: string | null; graceEnds?: string | null; hidden?: boolean } = {},
): string {
  switch (standing) {
    case "not_required":
      return "Your listing is free. There is nothing to pay and nothing to set up.";
    case "awaiting_payment":
      return "We have not received a payment yet. Your listing goes live as soon "
        + "as we have, and the ways to pay are below.";
    case "active":
      return detail.paidTo
        ? `Paid up to ${detail.paidTo}. We will email you before it runs out.`
        : "Paid up. We will email you before it runs out.";
    case "in_grace":
      return detail.graceEnds
        ? `This is overdue. Your listing stays up until ${detail.graceEnds}, and a `
          + "payment any time before then puts you straight back."
        : "This is overdue. A payment now puts you straight back.";
    case "lapsed":
      return detail.hidden
        ? "This has lapsed and your listing is out of the directory. Your members "
          + "keep everything, and a payment puts it back the same day."
        : "This has lapsed. A payment puts you straight back.";
    case "cancelled":
      return "This subscription is closed. Get in touch if you want to list again.";
    case "payment_failed":
      return "The last payment did not go through. Get in touch and we will sort it out.";
    default:
      return "";
  }
}

/**
 * What a payment should be for, prefilled.
 *
 * The subscription's own price, never a figure typed twice. An admin correcting
 * a cheque for a different amount can still type one; this is what the box
 * opens with.
 */
export function suggestedAmount(sub: {
  price_pence?: number | null;
  plan_interval?: string | null;
}, settings: {
  monthly_price_pence: number;
  yearly_price_pence: number;
}): number {
  if (sub.price_pence && sub.price_pence > 0) return sub.price_pence;
  return sub.plan_interval === "yearly"
    ? settings.yearly_price_pence
    : settings.monthly_price_pence;
}

/** Legacy's own numbers: 30 days a month, 365 a year (`next_renewal_date`). */
export function planDays(interval: string | null | undefined): number {
  return String(interval ?? "").toLowerCase() === "yearly" ? 365 : 30;
}

export const PAYMENT_METHODS = [
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "other", label: "Something else" },
] as const;

export function methodLabel(value: string): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
}

export type ListingCostSettings = {
  enabled: boolean;
  monthly_price_pence: number;
  yearly_price_pence: number;
  currency?: string;
};

/**
 * What being in the directory costs, in one line.
 *
 * Three places say this and they have to agree: the homepage, the page that
 * sells listing a club, and the last step of the builder. Two of them said
 * "free to list" as a fixed string, so the day charging was switched on the
 * site was telling people something that was no longer true, and the first
 * they heard of a price was after five steps of typing.
 *
 * Returns null when there is nothing to say, so a caller can leave the space
 * empty rather than print a sentence about nothing.
 */
export function listingCostLine(settings: ListingCostSettings): string | null {
  if (!settings.enabled) return "Free to list.";
  if (settings.monthly_price_pence <= 0 && settings.yearly_price_pence <= 0) return null;

  const money = (pence: number) => {
    const pounds = pence / 100;
    const symbol = (settings.currency ?? "GBP") === "GBP" ? "£" : `${settings.currency} `;
    return `${symbol}${Number.isInteger(pounds) ? pounds : pounds.toFixed(2)}`;
  };

  if (settings.monthly_price_pence <= 0) {
    return `${money(settings.yearly_price_pence)} a year to list.`;
  }
  if (settings.yearly_price_pence <= 0) {
    return `${money(settings.monthly_price_pence)} a month to list.`;
  }
  return `${money(settings.monthly_price_pence)} a month to list, `
    + `or ${money(settings.yearly_price_pence)} a year.`;
}

/**
 * What happens after they press the button.
 *
 * With charging on a listing does not go into the review queue, it waits to be
 * paid for, and "we will email you either way, usually within a few days" is
 * the wrong thing to promise somebody who has to pay first.
 */
export function listingSubmitNote(settings: ListingCostSettings): string {
  return settings.enabled
    ? "We will email you how to pay. Your listing goes to us as soon as the "
      + "payment is in, and into the directory once we have read it."
    : "We will email you either way, usually within a few days.";
}
