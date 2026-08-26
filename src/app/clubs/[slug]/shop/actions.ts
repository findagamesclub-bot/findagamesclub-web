"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import * as extras from "@/services/clubExtras-writes.service";

export type ShopState = { error?: string; notice?: string };

/** Ordering club kit, and the club answering. */
export async function shopAction(_prev: ShopState, data: FormData): Promise<ShopState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to order club kit." };

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

  if (intent === "set-status") {
    return done(
      await extras.updateOrder(Number(data.get("orderId")), String(data.get("status") ?? "")),
      "Order updated.",
    );
  }

  if (intent === "note") {
    return done(
      await extras.noteOnOrder(
        Number(data.get("orderId")), viewer.id, String(data.get("body") ?? ""),
      ),
      "Note added.",
    );
  }

  return { error: "Something went wrong. Reload and try again." };
}
