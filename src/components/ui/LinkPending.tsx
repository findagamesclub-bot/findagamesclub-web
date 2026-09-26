"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useLinkStatus } from "next/link";

/**
 * A spinner while the link you just clicked is still fetching its page.
 *
 * Has to be rendered inside the `next/link` it reports on — that is how
 * `useLinkStatus` finds it. Next clears `pending` itself when the navigation
 * lands, which is the whole point: a spinner driven by a click handler has
 * nothing to turn it off, and the analytics window picker shipped with exactly
 * that and left its overlay up for good.
 *
 * Two shapes. By default it swaps for whatever the control already shows,
 * which suits a fixed-size icon. `overlay` keeps the content in place and puts
 * the spinner on top of it, for a control whose width comes from its text: a
 * tab reading "12 months" cannot shrink to a 14px circle without the whole row
 * reflowing under the cursor. The caller gives that link `position: relative`.
 *
 * The pages behind these links are server-rendered and dynamic, so there is a
 * real wait. Without this a button looks ignored, and people press it twice.
 */
export default function LinkPending({
  children, size = 20, colour, overlay = false,
}: {
  /** What to show when nothing is pending, usually the icon or the label. */
  children: React.ReactNode;
  size?: number;
  colour?: string;
  /** Keep the content in place and put the spinner over it. */
  overlay?: boolean;
}) {
  const { pending } = useLinkStatus();
  if (!pending) return <>{children}</>;

  const spinner = (
    <CircularProgress size={size} thickness={5} aria-label="Loading"
      sx={overlay
        ? { position: "absolute", top: "50%", left: "50%",
            mt: `${-size / 2}px`, ml: `${-size / 2}px`, color: colour ?? "inherit" }
        : { color: colour ?? "inherit" }} />
  );

  if (!overlay) return spinner;

  return (
    <>
      {/* Still laid out, so the control keeps its width; hidden from both the
          eye and the screen reader, which is reading the spinner's label. */}
      <Box component="span" aria-hidden sx={{ visibility: "hidden" }}>{children}</Box>
      {spinner}
    </>
  );
}
