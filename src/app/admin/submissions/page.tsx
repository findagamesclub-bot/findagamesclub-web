import PageHead from "@/components/ui/PageHead";
import SubmissionQueue from "@/components/admin/SubmissionQueue";
import { getQueue, readQueueFilters } from "@/services/submissionReview.service";

export const metadata = { title: "Club requests" };

/**
 * The queue.
 *
 * "Club requests" rather than "Listings": under a rail heading that already
 * says CLUBS, the second word read as the clubs on the site rather than the
 * people asking to be one of them.
 *
 * Oldest first on the waiting tab, because that is the only order that is fair
 * to somebody who sent theirs in three weeks ago. Legacy shows the same list
 * and offers one verb; this one can also send a listing back.
 */
export default async function AdminSubmissionsPage({
  searchParams,
}: PageProps<"/admin/submissions">) {
  const filters = readQueueFilters(await searchParams);
  const queue = await getQueue(filters);

  return (
    <>
      <PageHead
        title="Club requests"
        lede="People asking to have their club put in the directory. Read one, then approve it, send it back with a note, or decline it."
      />

      <SubmissionQueue
        rows={queue.rows}
        counts={queue.counts}
        filters={filters}
        total={queue.total}
        page={queue.page}
        perPage={queue.perPage}
      />
    </>
  );
}
