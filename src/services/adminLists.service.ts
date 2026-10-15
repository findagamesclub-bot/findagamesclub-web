import "server-only";

import * as repo from "@/repositories/adminLists.repository";
import {
  CLUB_TABS, EVENT_TABS, clubSort, eventSort, eventWhen, eventWhenForSql, tabsWith,
  type AdminListFilters,
} from "@/utils/admin-lists";

const PER_PAGE = 25;

export {
  CLUB_SORTS, CLUB_TABS, EVENT_SORTS, EVENT_TABS, readAdminFilters,
} from "@/utils/admin-lists";
export type { AdminListFilters } from "@/utils/admin-lists";

/**
 * A page of rows, and the total behind it.
 *
 * The total rides on every row from SQL, so an empty page has to answer zero
 * rather than read a total off a row that is not there. Getting that wrong
 * shows "no clubs" beside a pager offering page four.
 */
function paged<T extends { total_count: number }>(rows: T[] | null, page: number) {
  return {
    rows: rows ?? [], total: rows?.[0]?.total_count ?? 0, page, perPage: PER_PAGE,
    // A read that failed is not a search that matched nothing. Without this the
    // page says "No club matches that. Try a different town" to somebody whose
    // database has not had 0118 run against it yet, which sends them looking
    // for a club that is sitting right there.
    failed: rows === null,
  };
}

export async function getAdminClubs(filters: AdminListFilters) {
  const sort = clubSort(filters);
  // One wave. Two reads that do not need each other's answer, so waiting for
  // the first before starting the second would cost 300ms for nothing.
  const [rows, counts] = await Promise.all([
    repo.findAdminClubs({
      query: filters.query, status: filters.tab, sort,
      limit: PER_PAGE, offset: (filters.page - 1) * PER_PAGE,
    }).catch(() => null),
    repo.findAdminClubCounts(filters.query).catch(() => ({})),
  ]);
  return {
    ...paged(rows, filters.page), sort, tabs: tabsWith(CLUB_TABS, counts ?? {}),
  };
}

export async function getAdminEvents(filters: AdminListFilters) {
  // Upcoming unless the address says otherwise, so the plain URL answers the
  // question an admin nearly always has.
  const when = eventWhen(filters);
  const sort = eventSort(filters);
  const [rows, counts] = await Promise.all([
    repo.findAdminEvents({
      query: filters.query, status: filters.extra, when: eventWhenForSql(when),
      sort, limit: PER_PAGE, offset: (filters.page - 1) * PER_PAGE,
    }).catch(() => null),
    repo.findAdminEventCounts(filters.query).catch(() => ({})),
  ]);
  return {
    ...paged(rows, filters.page), when, sort,
    tabs: tabsWith(EVENT_TABS, counts ?? {}),
  };
}
