import { amountOf } from "./cart-pricing";
import { clampPercent } from "./shop-pricing";
import type { MerchItem, ShopStanding } from "@/types/clubExtras";

/** One line in the bag. Quantity only; everything else is priced from the item. */
/**
 * One line in the bag.
 *
 * Keyed on the item *and* the size: two sizes of the same shirt are two lines,
 * and adding a medium must not bump the small already in there. `variantId` is
 * null for an item that has no sizes, which is every item that existed before
 * they were added.
 */
export type BagLine = { itemId: number; variantId: number | null; quantity: number };

/** Two lines are the same line when they name the same item and the same size. */
const sameLine = (line: BagLine, itemId: number, variantId: number | null) =>
  line.itemId === itemId && (line.variantId ?? null) === (variantId ?? null);

export type PricedLine = {
  itemId: number;
  /** The size, and null for an item that does not come in sizes. */
  variantId: number | null;
  /** Empty for an item that does not come in sizes. */
  variantLabel: string;
  name: string;
  quantity: number;
  /** What one costs before the tier discount. */
  unitAmount: number;
  unitDiscount: number;
  lineTotal: number;
  /**
   * The club wrote something that is not a price ("TBC", "Ask at the desk").
   * It still goes in the bag, but as a thing to be quoted, not as £0.
   */
  quoted: boolean;
  stock: number;
  /** Set when the item went out of stock or out of reach while it sat in the bag. */
  problem: string | null;
};

export type BagTotal = {
  lines: PricedLine[];
  count: number;
  subtotal: number;
  tierDiscount: number;
  /** Most points this bag can absorb, given the balance, the cap and the value. */
  maxPoints: number;
  pointsOff: number;
  total: number;
  /** True when nothing in the bag can actually be ordered. */
  blocked: boolean;
  /** How many lines the club still has to put a price on. */
  quotedCount: number;
};

export const MAX_PER_LINE = 20;

/**
 * Money, to the penny.
 *
 * £6.60 times three is 19.799999999999997 in binary floating point. Left alone
 * that reaches the totals and eventually a comparison against what SQL stored,
 * which rounds every amount to two places.
 */
const pennies = (n: number) => Math.round(n * 100) / 100;

/**
 * What the bag costs.
 *
 * Mirrors place_merchandise_cart_order line for line: the discount is worked
 * out per unit and rounded to pennies before it is multiplied by the quantity,
 * which is what legacy does (club_store.py:12140). Discounting the line total
 * instead gives a different answer on odd quantities, and then the bag and the
 * bill disagree by a penny.
 */
export function priceBag(params: {
  lines: BagLine[];
  items: MerchItem[];
  standing: ShopStanding;
  points: number;
}): BagTotal {
  const catalogue = new Map(params.items.map((item) => [item.id, item]));
  const percent = clampPercent(params.standing.discountPercent);

  const lines: PricedLine[] = params.lines.flatMap((line) => {
    const item = catalogue.get(line.itemId);
    if (!item) return [];

    const quantity = Math.max(1, Math.min(MAX_PER_LINE, line.quantity));
    const unitAmount = amountOf(item.price);
    const quoted = needsQuote(item.price);
    const unitDiscount = Math.round(unitAmount * percent) / 100;

    // What is left is the size's, not the item's: a shirt with forty larges
    // and no smalls has plenty in stock and none of what this line is for.
    const variant = item.variants.find((v) => v.id === line.variantId) ?? null;
    const stock = variant && variant.label ? variant.stock : item.stock;
    const soldOut = variant && variant.label ? variant.soldOut : item.soldOut;
    const named = variant?.label ? ` (${variant.label})` : "";

    return [{
      itemId: item.id,
      variantId: line.variantId,
      variantLabel: variant?.label ?? "",
      name: item.name,
      quantity,
      unitAmount,
      unitDiscount,
      lineTotal: pennies(Math.max(unitAmount - unitDiscount, 0) * quantity),
      quoted,
      stock,
      problem: soldOut
        ? `Sold out since you added it${named}`
        : item.blockedReason
          ? item.blockedReason
          : quantity > stock
            ? `Only ${stock} left${named}`
            : null,
    }];
  });

  const subtotal = pennies(lines.reduce((n, l) => n + l.unitAmount * l.quantity, 0));
  const tierDiscount = pennies(lines.reduce((n, l) => n + l.unitDiscount * l.quantity, 0));
  const afterTier = pennies(lines.reduce((n, l) => n + l.lineTotal, 0));

  const { pointValue, redemptionCapPercent } = params.standing;
  const canRedeem = Boolean(pointValue) && redemptionCapPercent > 0 && params.standing.points > 0;
  const ceiling = Math.round(afterTier * clampPercent(redemptionCapPercent)) / 100;
  const maxPoints = canRedeem
    ? Math.max(0, Math.min(params.standing.points, Math.floor(ceiling / (pointValue || 1))))
    : 0;

  const points = Math.max(0, Math.min(maxPoints, Math.floor(params.points)));
  const pointsOff = Math.round(points * (pointValue ?? 0) * 100) / 100;

  return {
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal,
    tierDiscount,
    maxPoints,
    pointsOff,
    total: pennies(Math.max(afterTier - pointsOff, 0)),
    quotedCount: lines.filter((line) => line.quoted).length,
    blocked: lines.length > 0 && lines.every((l) => l.problem),
  };
}

/**
 * What is left of this line, and whether the club has run out of room.
 *
 * The plus button goes dead at whichever comes first, the stock or the twenty
 * a person may take in one go. A button that stops working without saying why
 * reads as a broken page, so the line says which of the two it hit.
 */
export function stockNote(quantity: number, stock: number): {
  text: string; warn: boolean;
} {
  if (quantity >= stock) return { text: `${stock} left`, warn: true };
  if (quantity >= MAX_PER_LINE) {
    return { text: `${MAX_PER_LINE} at a time`, warn: true };
  }
  return { text: `${stock} left`, warn: false };
}

/** Add, or bump the quantity if that size is already in there. */
export function addLine(
  lines: BagLine[], itemId: number, quantity = 1, variantId: number | null = null,
): BagLine[] {
  const held = lines.find((l) => sameLine(l, itemId, variantId));
  if (!held) return [...lines, { itemId, variantId, quantity: clampQuantity(quantity) }];
  return lines.map((l) =>
    sameLine(l, itemId, variantId)
      ? { ...l, quantity: clampQuantity(l.quantity + quantity) } : l);
}

export function setQuantity(
  lines: BagLine[], itemId: number, quantity: number, variantId: number | null = null,
): BagLine[] {
  if (quantity < 1) return lines.filter((l) => !sameLine(l, itemId, variantId));
  return lines.map((l) =>
    sameLine(l, itemId, variantId) ? { ...l, quantity: clampQuantity(quantity) } : l);
}

export function removeLine(
  lines: BagLine[], itemId: number, variantId: number | null = null,
): BagLine[] {
  return lines.filter((l) => !sameLine(l, itemId, variantId));
}

/**
 * Whatever came back from storage, reduced to lines that still exist.
 *
 * A bag can sit in a browser for weeks. The club can delete an item, sell out,
 * or move it behind a tier in the meantime.
 */
export function reviveBag(raw: unknown, items: MerchItem[]): BagLine[] {
  if (!Array.isArray(raw)) return [];
  const live = new Set(items.map((item) => item.id));

  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { itemId, quantity, variantId } =
      entry as { itemId?: unknown; quantity?: unknown; variantId?: unknown };
    const id = Number(itemId);
    if (!live.has(id)) return [];

    // A size the club has since retired drops back to no size, which the
    // checkout accepts only when the item has exactly one left. Otherwise it
    // asks for a size again rather than quietly picking one.
    const sizes = items.find((item) => item.id === id)?.variants ?? [];
    const wanted = Number(variantId);
    const size = sizes.some((v) => v.id === wanted) ? wanted : null;

    return [{ itemId: id, variantId: size, quantity: clampQuantity(Number(quantity)) }];
  });
}

/**
 * Whether the club has actually named a price.
 *
 * A price of zero is a price: "£0" and "Free" both mean it costs nothing.
 * "TBC" and "Ask at the desk" mean the club has not said, which is a different
 * thing and must not be shown to a member as £0.
 */
const FREE_WORDS = ["free", "no charge", "gratis", "included"];

export function needsQuote(price: string | null): boolean {
  const clean = (price ?? "").trim().toLowerCase();
  if (!clean) return true;
  if (/[0-9]/.test(clean)) return false;
  return !FREE_WORDS.some((word) => clean.includes(word));
}

function clampQuantity(value: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_PER_LINE, n));
}
