import PageHead from "@/components/ui/PageHead";
import AdminEventList from "@/components/admin/AdminEventList";
import { getAdminEvents, readAdminFilters } from "@/services/adminLists.service";

export const metadata = { title: "Events" };

/**
 * Every event on the site, in one place.
 *
 * The client's words: "Every live event in one place, search and filters".
 * Drafts and cancelled events are here too, because the admin question this
 * page answers is usually "what happened to that one", and an event that has
 * gone from the public list is exactly the one being asked about.
 */
export default async function AdminEventsPage({
  searchParams,
}: PageProps<"/admin/events">) {
  const filters = readAdminFilters(await searchParams);
  const list = await getAdminEvents(filters);

  return (
    <>
      <PageHead
        title="Events"
        lede="Every event any club has put up. Search by event, club or town, then open one to see what a member sees."
      />
      <AdminEventList
        rows={list.rows}
        query={filters.query}
        when={list.when}
        status={filters.extra}
        tabs={list.tabs}
        total={list.total}
        page={list.page}
        perPage={list.perPage}
        failed={list.failed}
      />
    </>
  );
}
