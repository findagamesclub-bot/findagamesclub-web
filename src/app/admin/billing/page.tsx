import Box from "@mui/material/Box";
import PageHead from "@/components/ui/PageHead";
import NavTabs from "@/components/ui/NavTabs";
import BillingQueue from "@/components/admin/BillingQueue";
import BillingSettingsForm from "@/components/admin/BillingSettingsForm";
import {
  countOverdue, getBillingQueue, getBillingSettings, readBillingFilters,
} from "@/services/billing.service";
import { nextSearch, searchFrom, withSearch } from "@/utils/filter-url";

export const metadata = { title: "Billing" };

/**
 * What every listing costs, and whether it has been paid for.
 *
 * Two jobs on one address, and they were stacked: the prices sat under a queue
 * that pages, so finding them meant scrolling past however many rows happened
 * to be there, and an admin chasing money had a form of eight money fields
 * sitting under their thumb.
 *
 * Tabs rather than a stack, using the same `NavTabs` the shop and events
 * consoles use. Links rather than state, so a tab is a URL somebody can send
 * and the back button works.
 *
 * The queue keeps its own status row, so the subscriptions view does show two
 * rows of tabs. They are deliberately different weights: this one sits on the
 * page under a brass indicator, the statuses sit inside the card they filter.
 * The settings view renders no filter bar at all. Folding the statuses into
 * this row was the alternative and it is worse: "Overdue" and "What a listing
 * costs" are not the same kind of choice, and `UrlFilterBar` is shared by eight
 * other pages.
 */
export default async function AdminBillingPage({
  searchParams,
}: PageProps<"/admin/billing">) {
  const params = await searchParams;
  const filters = readBillingFilters(params);

  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  // Money first: this page is opened to chase it far more often than to change
  // a price, and the prices are the thing that must not move by accident.
  const showing = one("tab") === "costs" ? "costs" : "subscriptions";

  const [settings, owed, queue] = await Promise.all([
    getBillingSettings(),
    countOverdue(),
    showing === "subscriptions" ? getBillingQueue(filters) : null,
  ]);

  // The filters belong to the queue, not to this row, so they ride along
  // rather than being thrown away: a tab written as `?tab=costs` and back
  // would have dropped whichever status the reader was looking at.
  const at = (tab: string) => withSearch(
    "/admin/billing",
    nextSearch(searchFrom(params), { tab }, { tab: "subscriptions" }));

  return (
    <>
      <PageHead
        title="Billing"
        lede={showing === "costs"
          ? "What you charge, when you chase it, and what a club is told about paying. Changing a price here does not re-price a club that has already signed up."
          : settings.enabled
            ? "Every listing's subscription, and the payments recorded against it. Record a payment and the listing goes straight back."
            : "Billing is switched off, so every listing is free and nothing is being charged. Turn it on under What a listing costs."}
      />

      <Box sx={{ mb: 3 }}>
        <NavTabs
          ariaLabel="Billing"
          value={showing}
          tabs={[
            { value: "subscriptions", label: "Subscriptions",
              href: at("subscriptions"), count: owed },
            { value: "costs", label: "What a listing costs", href: at("costs") },
          ]}
        />
      </Box>

      {queue ? (
        <BillingQueue
          rows={queue.rows}
          counts={queue.counts}
          standing={filters.standing}
          query={filters.query}
          total={queue.total}
          page={queue.page}
          perPage={queue.perPage}
        />
      ) : (
        <BillingSettingsForm settings={settings} />
      )}
    </>
  );
}
