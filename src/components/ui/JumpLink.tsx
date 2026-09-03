"use client";

import NextLink from "next/link";

/**
 * A link to somewhere further down the same page.
 *
 * A plain `href="#join"` works exactly once. Click it a second time, or click
 * it while the address already ends in `#join`, and the browser does nothing
 * at all: the fragment has not changed, so there is no navigation to perform.
 * That is what made "See your request" look broken.
 *
 * The href stays, so it still works with JavaScript off and still shows the
 * target in the status bar. The handler is what makes a repeat click move.
 */
export default function JumpLink({
  targetId, children, style,
}: {
  targetId: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <NextLink
      href={`#${targetId}`}
      style={{ textDecoration: "none", ...style }}
      onClick={(event) => {
        const target = document.getElementById(targetId);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "start",
        });
        // Left in the address bar so the jump is shareable and the back button
        // behaves, but written rather than navigated so it cannot re-trigger.
        history.replaceState(null, "", `#${targetId}`);
      }}
    >
      {children}
    </NextLink>
  );
}
