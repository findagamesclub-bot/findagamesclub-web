"use client";

import { startTransition, useActionState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import FlagIcon from "@mui/icons-material/OutlinedFlag";
import StarRating from "@/components/ui/StarRating";
import ReviewForm from "./ReviewForm";
import { reviewAction, type ReviewState } from "@/app/clubs/[slug]/review-actions";
import { sinceLabel } from "@/utils/dates";
import { tokens, type Faction } from "@/lib/tokens";
import type { ClubReview } from "@/types/clubDetail";

/**
 * The review list, and whatever the viewer is allowed to do to it.
 *
 * Three roles overlap here: anybody may write one, the club may flag one for
 * attention, and only an administrator may take one down. Flagging deliberately
 * does not hide anything — legacy keeps a flagged review on the page, and a
 * club that could hide criticism by pressing a button is not a review section.
 */
export default function ClubReviews({
  clubId, slug, faction, reviews, viewerId, canManageClub, isAdmin, signedIn,
}: {
  clubId: number;
  slug: string;
  faction: Faction;
  reviews: ClubReview[];
  viewerId: string | null;
  canManageClub: boolean;
  isAdmin: boolean;
  signedIn: boolean;
}) {
  const [state, submit, busy] = useActionState<ReviewState, FormData>(reviewAction, {});
  const mine = reviews.find((r) => r.authorId && r.authorId === viewerId) ?? null;

  const act = (intent: string, reviewId: number) => {
    const data = new FormData();
    data.set("intent", intent);
    data.set("slug", slug);
    data.set("reviewId", String(reviewId));
    startTransition(() => submit(data));
  };

  return (
    <Stack spacing={2.5}>
      {state.error ? <Alert severity="error">{state.error}</Alert> : null}
      {state.notice ? <Alert severity="success">{state.notice}</Alert> : null}

      <Stack spacing={2}>
        {reviews.map((r) => {
          const isMine = Boolean(r.authorId && r.authorId === viewerId);
          return (
            <Stack key={r.id} spacing={0.75}
              sx={{ pt: 1.5, borderTop: `1px solid ${tokens.rule}` }}>
              <Stack direction="row" spacing={1.25}
                sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Typography variant="subtitle1">{r.authorName}</Typography>
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
