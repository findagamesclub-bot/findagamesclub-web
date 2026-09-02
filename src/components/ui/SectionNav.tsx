"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { tokens, mono } from "@/lib/tokens";

type Entry = { id: string; label: string };

/** The bar's own height, held before it has anything to show. */
const BAR_HEIGHT = 54;

/**
 * Shortcuts to the sections of a long page.
 *
 * The club page runs to fifteen sections, and a reader after the pricing had
 * to scroll past the photos, the map and the activity feed to reach it. Legacy
 * grew the same bar for the same reason (clubs-v2 lab-section-nav).
 *
 * Built from the DOM rather than from a list passed in. Most of these sections
 * are conditional — a club with no shop, no coaching and no competitions
 * renders half of them — and a hand-kept list would advertise anchors that go
 * nowhere the first time somebody added a condition. Reading what actually
 * rendered cannot drift.
 */
export default function SectionNav() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    let observer: IntersectionObserver | undefined;

    // Measured after paint rather than in the effect body: the sections have to
    // be on the page before they can be read, and a callback is where state
    // belongs when it is coming from outside React.
    const frame = requestAnimationFrame(() => {
      const nodes = [...document.querySelectorAll<HTMLElement>("section[data-section-label]")];
      const found = nodes
        .map((el) => ({ id: el.id, label: el.dataset.sectionLabel ?? "" }))
        .filter((e) => e.id && e.label);

      setEntries(found);
      setMeasured(true);
      if (found.length < 3) return;

      // Which section the reader is in, so the bar says where they are rather
      // than only where they could go.
      const seen = new Map<string, boolean>();
      observer = new IntersectionObserver(
        (records) => {
          for (const r of records) seen.set(r.target.id, r.isIntersecting);
          const first = found.find((e) => seen.get(e.id));
          if (first) setActive(first.id);
        },
        // A band across the upper middle: a section counts as "the one you are
        // reading" while its heading is in the top third, not when it first
        // clips the bottom of the screen.
        { rootMargin: "-140px 0px -60% 0px" },
      );
      for (const el of nodes) observer.observe(el);
    });

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  // Two shortcuts are not a shortcut. The space is held either way until the
  // sections have been counted, so the bar arriving after hydration does not
  // shove the whole page down by its own height.
  if (entries.length < 3) {
    return <Box aria-hidden sx={{ height: measured ? 0 : BAR_HEIGHT, mb: measured ? 0 : 1 }} />;
  }

  return (
    <Box
      component="nav"
      aria-label="Sections of this page"
      sx={{
        position: "sticky",
        // Under the app bar, which is 64px and its own sticky layer.
        top: 64,
        zIndex: (theme) => theme.zIndex.appBar - 2,
        display: "flex",
        gap: 0.5,
        // Scrolls sideways rather than wrapping to three rows on a phone.
        overflowX: "auto",
        py: 1,
        mb: 1,
        minHeight: BAR_HEIGHT,
        borderBottom: `1px solid ${tokens.rule}`,
        backgroundColor: "rgba(247,249,252,0.94)",
        backdropFilter: "blur(8px)",
        // The bar itself scrolls; the page behind it should not follow.
        overscrollBehaviorX: "contain",
        "&::-webkit-scrollbar": { height: 0 },
        scrollbarWidth: "none",
      }}
    >
      {entries.map((e) => {
        const current = active === e.id;
        return (
          <Box
            key={e.id}
            component="a"
            href={`#${e.id}`}
            aria-current={current ? "true" : undefined}
            onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
              const target = document.getElementById(e.id);
              if (!target) return;
              event.preventDefault();
              target.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto" : "smooth",
                block: "start",
              });
              // The hash follows without a second jump, so the section can be
              // linked to and the back button still works.
              history.replaceState(null, "", `#${e.id}`);
            }}
            sx={{
              flex: "0 0 auto",
              px: 1.75, py: 1, borderRadius: 1,
              fontFamily: mono, fontSize: "0.82rem", fontWeight: 700,
              letterSpacing: "0.04em", textDecoration: "none", whiteSpace: "nowrap",
              // Three states that read apart. The current one is filled, so it
              // is never mistaken for whatever the pointer happens to be over;
              // hover is the soft tint; the rest are ink rather than muted grey,
              // which is what made the bar hard to read at a glance.
              color: current ? "#FFFFFF" : tokens.ink,
              backgroundColor: current ? tokens.brand : "transparent",
              transition: "background-color 120ms ease, color 120ms ease",
              "&:hover": current
                ? { backgroundColor: tokens.brandDeep }
                : { backgroundColor: tokens.brandSoft, color: tokens.brandDeep },
            }}
          >
            {e.label.toUpperCase()}
          </Box>
        );
      })}
    </Box>
  );
}
