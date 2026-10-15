"use client";

import Link from "next/link";
import Button, { type ButtonProps } from "@mui/material/Button";

/**
 * Button that navigates client-side.
 *
 * `<Button component={Link}>` only works inside Client Components — passing the
 * Link function from a Server Component crosses the RSC boundary and throws.
 * Marking this file "use client" keeps that boundary in one place.
 */
export default function LinkButton({
  href, target, rel, ...props
}: ButtonProps & {
  href: string;
  /**
   * `_blank` where the reader has to come back, which is a worklist thing
   * rather than a general one: the moderation dialog sends somebody off to
   * read a thread and the queue behind it has filters, a page and an open
   * report to keep. Still `component={Link}` so `check:nav` can see that this
   * is a client navigation rather than a full page load.
   */
  target?: string;
  rel?: string;
}) {
  return (
    <Button
      component={Link}
      href={href}
      target={target}
      // Anything opening a new tab gets this whether the caller remembered or
      // not: a window with a live `opener` can navigate the page it came from.
      rel={target === "_blank" ? rel ?? "noopener noreferrer" : rel}
      {...props}
    />
  );
}
