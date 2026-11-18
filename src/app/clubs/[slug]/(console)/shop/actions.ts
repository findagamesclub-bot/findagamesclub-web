"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import * as extras from "@/services/clubExtras-writes.service";

export type ShopState = { error?: string; notice?: string };

/** Ordering merchandise, and the club answering. */
export async function shopAction(_prev: ShopState, data: FormData): Promise<ShopState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to order merchandise." };

  const slug = String(data.get("slug") ?? "");
  const intent = String(data.get("intent") ?? "");
  if (!slug) return { error: "Something went wrong. Reload and try again." };

  const done = (r: { ok: true } | { ok: false; error: string }, notice: string) => {
    revalidatePath(`/clubs/${slug}/shop`);
    return r.ok ? { notice } : { error: r.error };
  };

  if (intent === "order") {
    return done(
      await extras.orderMerch({
        itemId: Number(data.get("itemId")),
        quantity: Number(data.get("quantity") ?? 1),
        notes: String(data.get("notes") ?? ""),
        redeemPoints: Number(data.get("redeemPoints") ?? 0),
      }),
      "Order placed. The club will be in touch about payment.",
    );
  }

  if (intent === "order-bag") {
    // Lines arrive as JSON rather than parallel fields: a bag is a list, and
    // two getAll() arrays that have to line up by index is a bug waiting for
    // the day one of them is empty.
    let lines: { itemId: number; variantId: number | null; quantity: number }[] = [];
    try {
      const raw: unknown = JSON.parse(String(data.get("lines") ?? "[]"));
      if (Array.isArray(raw)) {
        lines = raw.map((l) => {
          const line = l as { itemId?: unknown; variantId?: unknown; quantity?: unknown };
          const variant = Number(line.variantId);
          return {
            itemId: Number(line.itemId),
            // Null for an item with no sizes. The database resolves that to the
            // item's only variant, and refuses it when there is more than one.
            variantId: Number.isFinite(variant) && variant > 0 ? variant : null,
            quantity: Number(line.quantity),
          };
        });
      }
    } catch {
      return { error: "Something went wrong with your bag. Reload and try again." };
    }

    const result = await extras.orderBag({
      lines,
      notes: String(data.get("notes") ?? ""),
      redeemPoints: Number(data.get("redeemPoints") ?? 0),
    });
    revalidatePath(`/clubs/${slug}/shop`);
    revalidatePath("/account/orders");
    return result.ok
      ? { notice: `Order placed. The club will be in touch about payment.` }
      : { error: result.error };
  }

  if (intent === "set-status") {
    return done(
      await extras.updateOrder(Number(data.get("orderId")), String(data.get("status") ?? "")),
      "Order updated.",
    );
  }

  if (intent === "set-refund") {
    return done(
      await extras.setOrderRefund({
        orderId: Number(data.get("orderId")),
        status: String(data.get("status") ?? ""),
        method: String(data.get("refundMethod") ?? ""),
        note: String(data.get("refundNote") ?? ""),
      }),
      "Refund recorded.",
    );
  }

  if (intent === "note") {
    return done(
      await extras.noteOnOrder(
        Number(data.get("orderId")), String(data.get("body") ?? ""),
        String(data.get("audience") ?? "club"),
      ),
      // The toast says where it went, because that is the thing the club
      // was wrong about: "Note added" is true of both and tells them nothing.
      String(data.get("audience") ?? "club") === "member"
        ? "Note added. The member can read it."
        : "Note added for your team.",
    );
  }

  return { error: "Something went wrong. Reload and try again." };
}
