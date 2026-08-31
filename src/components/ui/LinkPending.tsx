"use client";

import CircularProgress from "@mui/material/CircularProgress";
import { useLinkStatus } from "next/link";

/**
 * A spinner while the link you just clicked is still fetching its page.
 *
 * Has to be rendered inside the `next/link` it reports on — that is how
 * `useLinkStatus` finds it. It swaps for whatever the control already shows
 * rather than appearing beside it, so nothing moves mid-click.
 *
 * The pages behind these links are server-rendered and dynamic, so there is a
 * real wait. Without this a button looks ignored, and people press it twice.
 */
export default function LinkPending({
  children, size = 20, colour,
}: {
  /** What to show when nothing is pending, usually the icon. */
  children: React.ReactNode;
  size?: number;
  colour?: string;
}) {
  const { pending } = useLinkStatus();
  return pending
    ? <CircularProgress size={size} thickness={5} sx={{ color: colour ?? "inherit" }} />
    : <>{children}</>;
}
