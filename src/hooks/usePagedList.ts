"use client";

import { useState, type RefObject } from "react";
import { clampPage, pageOf, PAGE_SIZE } from "@/utils/paging";

/**
 * Paging for a list that is already filtered in the browser.
 *
 * The page resets whenever the filtered list changes, because page 4 of a list
 * that now has one page shows nothing at all, and an empty screen after typing
 * in a search box reads as "no matches" rather than "wrong page".
 *
 * Adjusted during render rather than in an effect: an effect would paint the
 * empty page first and correct it on the next frame, which is the flicker the
 * reset exists to prevent.
 */
export function usePagedList<T>(
  items: T[],
  size = PAGE_SIZE,
  /** The element the list starts at, so paging lands on row one. */
  top?: RefObject<HTMLElement | null>,
) {
  const [page, setPage] = useState(1);
  const [seen, setSeen] = useState(items);

  if (seen !== items) {
    setSeen(items);
    setPage(1);
  }

  const safe = clampPage(page, items.length, size);

  return {
    page: safe,
    total: items.length,
    shown: pageOf(items, safe, size),
    goTo(next: number) {
      setPage(next);
      // Paging from the bottom of page 2 would otherwise leave you at the
      // bottom of page 3, looking at the last rows of what you asked for.
      top?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  };
}
