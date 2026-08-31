"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { addLine, removeLine, reviveBag, setQuantity, type BagLine } from "@/utils/merch-bag";
import type { MerchItem } from "@/types/clubExtras";

/**
 * The shop bag.
 *
 * Kept in the browser, keyed by club and by person, which is what legacy does
 * (merchandise.js: loadCart / getCartStorageKey). Nothing is reserved by being
 * in a bag and no money moves, so a row in the database would buy only
 * cross-device carts and cost a table, a policy and a write on every tap.
 *
 * Read through useSyncExternalStore rather than an effect: the server has no
 * localStorage, so the server snapshot is an empty bag and the real one arrives
 * without a second render pass. A second tab editing the same bag lands here
 * too, through the storage event.
 */
const listeners = new Set<() => void>();

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

function readRaw(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "[]";
  } catch {
    // A private window, or storage blocked entirely.
    return "[]";
  }
}

export function useMerchBag(clubId: number, profileId: string, items: MerchItem[]) {
  const key = `merch-bag:${clubId}:${profileId}`;

  // The raw string is the snapshot: it is stable between reads, which an
  // object rebuilt each call would not be, and React would loop.
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => "[]");

  const lines = useMemo(() => {
    try {
      return reviveBag(JSON.parse(raw), items);
    } catch {
      return [];
    }
  }, [raw, items]);

  const save = useCallback((next: BagLine[]) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage full or blocked. Nothing to do but carry on without a bag.
    }
    listeners.forEach((notify) => notify());
  }, [key]);

  return {
    lines,
    add: (itemId: number, quantity = 1) => save(addLine(lines, itemId, quantity)),
    setQuantity: (itemId: number, quantity: number) => save(setQuantity(lines, itemId, quantity)),
    remove: (itemId: number) => save(removeLine(lines, itemId)),
    clear: () => save([]),
  };
}
