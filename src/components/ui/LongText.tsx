import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { tokens } from "@/lib/tokens";

/**
 * Somebody else's words, however many of them there are.
 *
 * Free text written by a person has no length anybody controls. An admin
 * pasting a thousand words into a note ran the review screen for several
 * thousand pixels and pushed Approve off the bottom of it, which is the page
 * being unusable because of something typed into a different page.
 *
 * So it scrolls inside its own box rather than growing the page. The cap is
 * generous enough that an ordinary note, a sentence or two, never scrolls at
 * all and looks like plain text; only the outliers are contained.
 *
 * `lines` is the cap worth reaching for, because a height in pixels is a guess
 * about type that goes stale the moment the theme changes. It measures in the
 * text's own line-height instead, so nine lines is nine lines.
 */

/**
 * body2, copied from `theme.ts` rather than read from it.
 *
 * Reading it needs an `sx` callback, a callback is a function, and this file
 * has no "use client", so React refuses to hand one to MUI's Box and the whole
 * page 500s with "Functions cannot be passed directly to Client Components".
 * `tsc`, `next build` and `check:links` all stay green while it does.
 */
const BODY2 = { fontSize: "1.0625rem", lineHeight: 1.55 };
export default function LongText({
  text, max = 260, lines,
}: {
  text: string;
  /** How tall it may grow before it starts scrolling. */
  max?: number;
  /** How many lines it may run to. Wins over `max` when both are given. */
  lines?: number;
}) {
  return (
    <Box
      sx={{
        // 1em inside this box is body2's own size, so the multiplication below
        // is in lines of the text it actually contains.
        fontSize: BODY2.fontSize,
        maxHeight: lines ? `${lines * BODY2.lineHeight}em` : max,
        overflowY: "auto",
        overscrollBehavior: "contain",
        // Room for the scrollbar so it never sits on top of the last word.
        pr: 0.5,
      }}
    >
      <Typography variant="body2" sx={{ color: tokens.ink, whiteSpace: "pre-wrap" }}>
        {text}
      </Typography>
    </Box>
  );
}
