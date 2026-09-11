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
   * The path this item is current for, when the section is wider than the page
   * it opens on. The listing editor points at step one and owns all five, so
   * without this its entry goes dark the moment you move to step two.
   */
  owns?: string;
  /**
   * Lights only on this exact path. The section root would otherwise light up
   * on every page beneath it, so both it and the child would look current.
   */
  exact?: boolean;
};

export type NavGroup = { title: string; items: NavItem[] };

/** Where the item's section starts, which is not always where it points. */
const rootOf = (item: NavItem) => item.owns ?? item.href;

export function isOn(item: NavItem, pathname: string): boolean {
  const root = rootOf(item);
  return item.exact
    ? pathname === item.href
    : pathname === root || pathname.startsWith(`${root}/`);
}

/**
 * The section being looked at: the one item to light, and what the phone
 * trigger names.
 *
 * The most specific match wins, because several can match at once. Renewals
 * lives under Members, so its page lit both of them and neither looked
 * current.
 */
export function currentItem(groups: NavGroup[], pathname: string): NavItem | undefined {
  const all = groups.flatMap((g) => g.items);
  return [...all]
    .sort((a, b) => rootOf(b).length - rootOf(a).length)
    .find((item) => isOn(item, pathname));
}
