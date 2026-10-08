import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import LongText from "@/components/ui/LongText";
import StarRating from "@/components/ui/StarRating";
import StatusChip from "@/components/ui/StatusChip";
import ReportButton from "@/components/ui/ReportButton";
import type { ConsoleReview } from "@/services/reviews.service";
import { reportKey } from "@/utils/reported-set";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

/**
 * What members have said about this club, for the club.
 *
 * Two across rather than the three every other console list uses, and that is
 * the one deliberate departure: a review is prose, and three columns at `lg`
 * gives about forty characters a line, under the readable minimum. The rule
 * exists so a short record does not get a full-width band to itself; a
 * paragraph is not a short record.
 *
 * Report is the only action, and the panel says why rather than leaving
 * somebody hunting for a delete. A club ruling on a bad review of itself is
 * the conflict of interest 0128 was written to avoid.
 */
export default function ConsoleReviews({
  reviews, reportedKeys, membersBase,
}: {
  reviews: ConsoleReview[];
  /** Flags this viewer already has open, so a button can read "Reported". */
  reportedKeys: string[];
  /** Where an author's name links, when they have an account here. */
  membersBase: string;
}) {
  if (reviews.length === 0) {
    return (
      <EmptyState
        title="Nothing here"
        description="No review matches this filter. Members write them from your club page."
      />
    );
  }

  const already = new Set(reportedKeys);

  return (
    <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
               gridTemplateColumns: {
                 xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } }}>
      {reviews.map((review) => (
        <Stack key={review.id} spacing={1.25}
          sx={{ height: "100%", p: 2, borderRadius: 1.5,
                border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
          <Stack direction="row" spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between",
                  flexWrap: "wrap" }} useFlexGap>
            <StarRating value={review.rating} caption={review.rating.toFixed(1)} />
            <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                              letterSpacing: "0.08em", color: tokens.inkMuted }}>
              {(shortDate(review.createdAt.slice(0, 10)) ?? "").toUpperCase()}
            </Typography>
          </Stack>

          <Typography sx={{ fontWeight: 700 }}>
            {review.authorId ? (
              <NextLink href={`${membersBase}/${review.authorId}`}
                style={{ color: "inherit", textDecoration: "none" }}>
                {review.authorName}
              </NextLink>
            ) : review.authorName}
          </Typography>

          {review.comment ? (
            <LongText text={review.comment} max={320} />
          ) : (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              A rating with no words.
            </Typography>
          )}

          {/* Footers line up however long the words above them ran. */}
          <Box sx={{ flex: 1 }} />

          <Stack direction="row" spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
            {/* "With an admin", not "Reported": the button beside it already
                says Reported, and it means something else — that *you* have a
                report open. This one is the review's own state, which is that
                somebody flagged it and a site admin has not ruled yet. Two
                chips reading the same word for two different facts is the trap
                rule 11 is about. */}
            {review.reported ? (
              <StatusChip label="With an admin" tone="waiting" />
            ) : null}
            <ReportButton type="review" id={review.id} what="review"
              reported={review.reported || already.has(reportKey("review", review.id))} />
          </Stack>
        </Stack>
      ))}
    </Box>
  );
}
