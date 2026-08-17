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
export default function LinkButton({ href, ...props }: ButtonProps & { href: string }) {
  return <Button component={Link} href={href} {...props} />;
}
