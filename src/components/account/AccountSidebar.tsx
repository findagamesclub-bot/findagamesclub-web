"use client";

import SideNav from "@/components/ui/SideNav";
import { accountGroups } from "./account-nav";
import type { AccountCounts } from "@/services/dashboard.service";

/**
 * The account's own navigation.
 *
 * A sidebar rather than tabs: eleven sections do not fit a strip, and a tab bar
 * that scrolls sideways hides half of itself. It also keeps every section
 * inside one shell — tickets used to open a page with no account navigation on
 * it at all, so getting back meant the browser's back button.
 *
 * Thin on purpose. The behaviour lives in SideNav, which the club console and
 * the admin console use too; the icons are functions and cannot cross the
 * server boundary, so each area builds its own groups on the client.
 */
export default function AccountSidebar({ counts }: { counts: AccountCounts }) {
  return (
    <SideNav
      groups={accountGroups(counts)}
      heading="Your account"
      fallbackLabel="Your account"
    />
  );
}
