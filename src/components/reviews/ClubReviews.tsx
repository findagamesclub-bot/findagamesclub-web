"use client";

import { startTransition, useActionState, useMemo, useRef, useState } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import FlagIcon from "@mui/icons-material/OutlinedFlag";
import StarRating from "@/components/ui/StarRating";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import ReviewForm from "./ReviewForm";
import ReviewBreakdown from "./ReviewBreakdown";
import { bandLabel, ratingBands } from "@/utils/review-breakdown";
import { reviewAction, type ReviewState } from "@/app/clubs/[slug]/review-actions";
import { sinceLabel } from "@/utils/dates";
import { tokens, type Faction } from "@/lib/tokens";
import type { ClubReview } from "@/types/clubDetail";
import { PER_PAGE } from "@/utils/paging";

/** Long enough to read as a page of opinion, short enough to skim. */
const REVIEWS_PER_PAGE = PER_PAGE.rich;

/**
 * The review list, and whatever the viewer is allowed to do to it.
 *
 * Three roles overlap here: anybody may write one, the club may flag one for
 * attention, and only an administrator may take one down. Flagging deliberately
 * does not hide anything — legacy keeps a flagged review on the page, and a
 * club that could hide criticism by pressing a button is not a review section.
 */
export default function ClubReviews({
  clubId, slug, faction, reviews, total, viewerId, canManageClub, isAdmin, signedIn,
}: {
  clubId: number;
  slug: string;
  faction: Faction;
  reviews: ClubReview[];
  /** Every review the club has, which is more than `reviews` once capped. */
  total: number;
  viewerId: string | null;
  canManageClub: boolean;
  isAdmin: boolean;
  signedIn: boolean;
}) {
  const [state, submit, busy] = useActionState<ReviewState, FormData>(reviewAction, {});
  useActionToast(state);
  const mine = reviews.find((r) => r.authorId && r.authorId === viewerId) ?? null;

  // Filtered here rather than through the URL: the list is already on the
  // client, so there is nothing to fetch, and a round trip would move the page
  // under somebody who is reading it.
  const [rating, setRating] = useState<number | null>(null);
  const bands = useMemo(() => ratingBands(reviews.map((r) => r.rating)), [reviews]);
  const shown = useMemo(
    () => rating === null
      ? reviews
      : reviews.filter((r) => Math.round(r.rating) === rating),
    [reviews, rating],
  );

  // Paged rather than a scroll box inside the page. Two scrollbars is a
  // guessing game about which one you are in, and the box hid how much there
  // was: a hundred reviews and six looked identical until you dragged it.
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(shown, REVIEWS_PER_PAGE, top);

  const act = (intent: string, reviewId: number) => {
    const data = new FormData();
    data.set("intent", intent);
    data.set("slug", slug);
    data.set("reviewId", String(reviewId));
    startTransition(() => submit(data));
  };

  return (
    <Stack spacing={2.5}>

      <ReviewBreakdown bands={bands} total={reviews.length} selected={rating}
        onSelect={setRating} faction={faction} />

      {rating !== null || total > reviews.length ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {rating !== null
              ? `Showing ${bandLabel(rating, shown.length)}.`
              : `Showing the most recent ${reviews.length} of ${total} reviews.`}
          </Typography>
          {rating !== null ? (
            <Button size="small" variant="text" onClick={() => setRating(null)}
              sx={{ minWidth: 0, fontSize: "0.78rem", color: tokens.brand }}>
              Show all
            </Button>
          ) : null}
        </Stack>
      ) : null}

      <Stack ref={top} spacing={2}>
        {paged.shown.map((r) => {
          const isMine = Boolean(r.authorId && r.authorId === viewerId);
          return (
            <Stack key={r.id} spacing={0.75}
              sx={{ pt: 1.5, borderTop: `1px solid ${tokens.rule}` }}>
              <Stack direction="row" spacing={1.25}
                sx={{ alignItems: "center", flexWrap: "wrap" }}>
                {/* Only when the review has an account behind it. The
                    imported reviews carry a legacy user id that belongs to
                    nobody here, and matching those on name would put a
                    stranger's face on somebody else's words. */}
                {r.authorId ? (
                  <NextLink href={`/members/${r.authorId}`}
                    style={{ color: "inherit", textDecoration: "none" }}>
                    <Typography variant="subtitle1"
                      sx={{ "&:hover": { color: faction.base, textDecoration: "underline" } }}>
                      {r.authorName}
                    </Typography>
                  </NextLink>
                ) : (
                  <Typography variant="subtitle1">{r.authorName}</Typography>
                )}
                <StarRating value={r.rating} />
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                                  color: tokens.inkMuted }}>
                  {(sinceLabel(r.createdAt) ?? "").toUpperCase()}
                </Typography>
                {isMine ? (
                  <Chip size="small" label="Yours"
                    sx={{ height: 20, fontSize: "0.68rem", bgcolor: faction.soft,
                          color: faction.deep, fontWeight: 600 }} />
                ) : null}
                {r.flaggedAt && (canManageClub || isAdmin) ? (
                  <Chip size="small" icon={<FlagIcon sx={{ fontSize: 13 }} />} label="Flagged"
                    sx={{ height: 20, fontSize: "0.68rem", bgcolor: tokens.brassSoft,
                          color: "#5c4310", fontWeight: 600 }} />
                ) : null}
              </Stack>

              {r.comment ? (
                <Typography variant="body2" color="text.secondary">{r.comment}</Typography>
              ) : null}

              {canManageClub || isAdmin ? (
                <Stack direction="row" spacing={1} sx={{ pt: 0.25 }}>
                  {canManageClub || isAdmin ? (
                    <Button size="small" variant="text" disabled={busy}
                      onClick={() => act(r.flaggedAt ? "unflag" : "flag", r.id)}
                      sx={{ color: tokens.inkMuted, fontSize: "0.75rem", minWidth: 0 }}>
                      {r.flaggedAt ? "Clear flag" : "Flag for review"}
                    </Button>
                  ) : null}
                  {isAdmin ? (
                    <Button size="small" variant="text" disabled={busy}
                      onClick={() => act("remove", r.id)}
                      sx={{ color: tokens.danger, fontSize: "0.75rem", minWidth: 0 }}>
                      Remove
                    </Button>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          );
        })}

        {reviews.length === 0 ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            No reviews yet. If you have played here, yours would be the first.
          </Typography>
        ) : null}
      </Stack>

      <Pager page={paged.page} total={paged.total} noun="reviews"
        size={REVIEWS_PER_PAGE} onChange={paged.goTo} />

      <Box>
        {signedIn ? (
          <ReviewForm clubId={clubId} slug={slug} faction={faction} mine={mine}
            busy={busy} error={undefined} onSubmit={submit} />
        ) : (
          <Button component={NextLink} href={`/auth/sign-in?next=/clubs/${slug}`}
            variant="outlined">
            Sign in to write a review
          </Button>
        )}
      </Box>
    </Stack>
  );
}
