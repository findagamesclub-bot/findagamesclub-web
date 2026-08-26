import NextLink from "next/link";
import type { CSSProperties, ReactNode } from "react";

/**
 * A link that changes what the current page shows, not which page you are on.
 *
 * Next scrolls to the top on navigation, which is right when the content is
 * new and wrong when it is the same content re-filtered: switching List to Map
 * a screen down threw you back to the hero, so you lost your place to see a
 * change that happened where you were already looking.
 *
 * Its own component rather than `scroll={false}` at each call site — that flag
 * is easy to leave off, and leaving it off has no symptom until somebody
 * scrolls.
 */
export default function FilterLink({
  href, children, style,
}: {
  href: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <NextLink href={href} scroll={false}
      style={{ textDecoration: "none", ...style }}>
      {children}
    </NextLink>
  );
}
