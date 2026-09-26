import Box from "@mui/material/Box";
import PageHead from "@/components/ui/PageHead";
import NavTabs from "@/components/ui/NavTabs";
import ClaimQueue from "@/components/admin/ClaimQueue";
import ClaimableClubs from "@/components/admin/ClaimableClubs";
import {
  countOpenClaims, getClaimableClubs, getClaimsQueue, readClaimFilters,
} from "@/services/claims.service";
import { nextSearch, searchFrom, withSearch } from "@/utils/filter-url";

export const metadata = { title: "Club claims" };

/**
 * People saying an existing listing is theirs.
 *
 * A second queue beside Club requests, and shaped like it on purpose: an admin
 * works both and should not have to learn two vocabularies. The difference is
 * what is being asked for, which is a club that already exists.
 *
 * Split into tabs for the same reason the billing page is: the doors were
 * stacked under a queue that pages, so opening one meant scrolling past
 * however many claims happened to be waiting. Links rather than state, and the
 * queue's own filters ride along, so a tab never throws away the status
 * somebody was reading.
 */
export default async function AdminClaimsPage({
  searchParams,
}: PageProps<"/admin/claims">) {
  const params = await searchParams;
  const filters = readClaimFilters(params);

  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  // The queue first: answering somebody who is waiting is the job, and opening
  // a door is the setup you do once.
  const showing = one("tab") === "doors" ? "doors" : "claims";

  const [waiting, queue, claimable] = await Promise.all([
    countOpenClaims(),
    showing === "claims" ? getClaimsQueue(filters) : null,
    showing === "claims" ? null : getClaimableClubs(),
  ]);

  const at = (tab: string) => withSearch(
    "/admin/claims",
    nextSearch(searchFrom(params), { tab }, { tab: "claims" }));

  return (
    <>
      <PageHead
        title="Club claims"
        lede={showing === "doors"
          ? "A club can only be claimed where you have opened it. Nobody gets a club without you reading their claim first, so this only decides where the button appears."
          : "People who say a listing in the directory is their club. Read what they sent, then hand it over or turn it down with a reason."}
      />

      <Box sx={{ mb: 3 }}>
        <NavTabs
          ariaLabel="Club claims"
          value={showing}
          tabs={[
            { value: "claims", label: "Claims", href: at("claims"), count: waiting },
            { value: "doors", label: "Open to claims", href: at("doors") },
          ]}
        />
      </Box>

      {queue ? (
        <ClaimQueue
          rows={queue.rows}
          counts={queue.counts}
          status={filters.status}
          total={queue.total}
          page={queue.page}
          perPage={queue.perPage}
        />
      ) : (
        <ClaimableClubs open={claimable?.open ?? []} closed={claimable?.closed ?? []} />
      )}
    </>
  );
}
