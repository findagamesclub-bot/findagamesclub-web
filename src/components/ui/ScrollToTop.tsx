"use client";

import { useEffect } from "react";

/**
 * Puts a new page back at the top.
 *
 * Rendered from a loading boundary. The skeleton replaces the previous page
 * instantly, but the scroll position survives the swap, and the skeleton is
 * always shorter than a real page — so clicking a link from the bottom of a
 * long club page landed on the footer of the loading state.
 *
 * `instant` rather than smooth: this is correcting a jump, not performing one.
 */
export default function ScrollToTop() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  return null;
}
