import Box from "@mui/material/Box";
import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material/styles";
import { tokens } from "@/lib/tokens";

/**
 * A list that cannot grow past a point.
 *
 * Anything rendered inside a card or a disclosure needs this: a card sits in a
 * grid, so one member with a hundred payments stretches its whole row and
 * buries every control underneath it. There were four hand-rolled versions of
 * this before, at four different heights, and only one of them capped
 * conditionally. One of it, so a new list gets the same behaviour without
 * anybody deciding again.
 *
 * It overrides UI checklist rule 9 ("a nested scroll is the wrong answer to
 * this list is long"), which is still right for a list that can be bounded
 * another way. Reach for paging first; reach for this when the reader needs
 * every row in one place.
 */

/** Right padding that clears an overlay scrollbar. See the note below. */
export const SCROLLBAR_CLEARANCE = 2.5;

export default function ScrollBox({
  children, label, cap = 320, scrolls = true, sx,
}: {
  children: ReactNode;
  /**
   * What the box holds. A scroll container that can hold focus is announced,
   * so it needs to say what it is rather than "group".
   */
  label: string;
  /** How tall before it scrolls. A number of pixels or a breakpoint map. */
  cap?: number | Record<string, number>;
  /**
   * False leaves it uncapped, which is what a short list wants: a scrollbar on
   * three rows is a control that does nothing.
   */
  scrolls?: boolean;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      // A scroll container is only reachable by keyboard when it can hold
      // focus. Without this somebody who cannot use a mouse can open a list
      // and never get to the bottom of it.
      {...(scrolls ? { tabIndex: 0, role: "group", "aria-label": label } : {})}
      sx={[
        scrolls ? {
          maxHeight: cap,
          overflowY: "auto",
          overflowX: "hidden",

          // Thin and in the house grey, because the default is a chunky bar
          // that reads as a browser control sitting on top of the design.
          scrollbarWidth: "thin",
          scrollbarColor: `${tokens.rule} transparent`,
          "&::-webkit-scrollbar": { width: 8 },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: tokens.rule, borderRadius: 4 },
          "&::-webkit-scrollbar-thumb:hover": { backgroundColor: tokens.inkMuted },
          "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },

          // An OVERLAY scrollbar takes no layout width at all: on macOS
          // `offsetWidth - clientWidth` is 0 and the bar floats over whatever
          // is under it, so a right-aligned column ends up beneath it and £120
          // reads as £12. Styling the scrollbar does NOT make Chrome reserve a
          // gutter and `scrollbar-gutter: stable` does nothing either, because
          // a gutter is only created for classic bars. Both were tried and
          // measured. Padding is the only thing that moves content clear.
          pr: SCROLLBAR_CLEARANCE,

          "&:focus-visible": {
            outline: `2px solid ${tokens.brass}`, outlineOffset: 2, borderRadius: 1 },
        } : {},
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}
