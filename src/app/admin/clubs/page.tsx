import PageHead from "@/components/ui/PageHead";
import AdminClubList from "@/components/admin/AdminClubList";
import { getAdminClubs, readAdminFilters } from "@/services/adminLists.service";

export const metadata = { title: "Clubs" };

/**
 * Every club on the site, in one place.
 *
 * The client's words: "Every live club in one place, search and filters".
 * Legacy has no such screen, so there is nothing to copy and the requirement is
 * the spec. Paused and suspended clubs are here too: an admin looking for a
 * club they cannot find in the directory is exactly the person this page is
 * for, and hiding them would send them to the SQL console.
 */
export default async function AdminClubsPage({
  searchParams,
}: PageProps<"/admin/clubs">) {
  const filters = readAdminFilters(await searchParams);
  const list = await getAdminClubs(filters);

  return (
    <>
      <PageHead
        title="Clubs"
        lede="Every club on the site, live or not. Search by name or town, then open one to see what a member sees."
      />
      <AdminClubList
        rows={list.rows}
        query={filters.query}
        status={filters.tab}
        tabs={list.tabs}
        total={list.total}
        page={list.page}
        perPage={list.perPage}
        failed={list.failed}
      />
    </>
  );
}
