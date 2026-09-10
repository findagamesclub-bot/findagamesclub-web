import type { SvgIconComponent } from "@mui/icons-material";

/**
 * The shape every side navigation is built from.
 *
 * Three areas use it now: the member's account, a club's console and the admin
 * console. They were going to be three copies of the same drawer, and the
 * account's took two goes and two rounds of client feedback to get right.
 *
 * Every item goes somewhere. A section that cannot show anything yet is left
 * out rather than greyed, because advertising it only promises an empty page.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: SvgIconComponent;
  count?: number;
  /** Marks a count worth noticing rather than merely reporting. */
  alert?: boolean;
  /**
   * Lights only on this exact path. The section root would otherwise light up
   * on every page beneath it, so both it and the child would look current.
   */
  exact?: boolean;
};

export type NavGroup = { title: string; items: NavItem[] };

export function isOn(item: NavItem, pathname: string): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** The section being looked at, which is what the phone trigger names. */
export function currentItem(groups: NavGroup[], pathname: string): NavItem | undefined {
  const all = groups.flatMap((g) => g.items);
  // Longest href first, so /manage/events/new picks Events rather than the
  // console root that also matches it.
  return [...all]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isOn(item, pathname));
}
