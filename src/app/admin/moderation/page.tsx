import Box from "@mui/material/Box";
import PageHead from "@/components/ui/PageHead";
import ModerationQueue from "@/components/moderation/ModerationQueue";
import { moderationAction } from "./actions";
import { getQueue, readFilters } from "@/services/moderation.service";

export const metadata = { title: "Reported" };

/**
 * Everything somebody has reported, in one place.
 *
 * The client's words: "Moderation queue for reviews, board posts (club and
 * event) and messages, if flagged to admin". Legacy can flag a review and
 * nothing else, so there is nothing to copy and the requirement is the spec.
 *
 * Site-wide, and the final say. 0128 gave each club its own queue over its own
 * reports, because that is how every community platform works and the club is
 * closest to the context. This one still holds every report on the site, it is
 * the only place a review or a report about a club's own team can be answered,
 * and it can overrule a club's decision, which is the one place anything gets
 * put back after a removal.
 */
export default async function AdminModerationPage({
  searchParams,
}: PageProps<"/admin/moderation">) {
  const filters = readFilters(await searchParams);
  const queue = await getQueue(filters);

  return (
    <>
      <PageHead
        title="Reported"
        lede="Things members have reported. Read it in context, then leave it or take it down. Taking something down keeps the thread together."
      />

      <Box>
        <ModerationQueue
          rows={queue.rows}
          tabs={queue.tabs}
          tab={filters.tab}
          type={filters.type}
          query={filters.query}
          total={queue.total}
          page={queue.page}
          perPage={queue.perPage}
          failed={queue.failed}
          action={moderationAction}
          basePath="/admin/moderation"
        />
      </Box>
    </>
  );
}
