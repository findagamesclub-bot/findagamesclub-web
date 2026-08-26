"use client";

import { useLinkStatus } from "next/link";
import Button, { type ButtonProps } from "@mui/material/Button";

/**
 * A button inside a Link that spins while the page is on its way.
 *
 * A link is not an action, so nothing was driving a spinner — you pressed
 * Continue to checkout and the page sat there until the next one painted.
 * useLinkStatus reads the pending state of the enclosing Link, which is the
 * only thing that knows a navigation has started.
 *
 * Must be rendered *inside* a <Link>, the way SubmitButton must be inside a
 * <form>.
 */
export default function LinkProgress({
  label, pendingLabel, ...props
}: Omit<ButtonProps, "type"> & {
  label: string;
  /** Present tense. Announced to screen readers; never shown on screen. */
  pendingLabel: string;
}) {
  const { pending } = useLinkStatus();

  return (
    <Button
      loading={pending}
      loadingPosition="start"
      aria-label={pending ? pendingLabel : undefined}
      {...props}
    >
      {label}
    </Button>
  );
}
