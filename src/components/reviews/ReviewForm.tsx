"use client";

import { startTransition, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Rating from "@mui/material/Rating";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import Alert from "@mui/material/Alert";
import CloseIcon from "@mui/icons-material/Close";
import RateReviewIcon from "@mui/icons-material/RateReview";
import { tokens, type Faction } from "@/lib/tokens";
import type { ClubReview } from "@/types/clubDetail";

const WORDS = ["", "Poor", "Not great", "Fine", "Good", "Excellent"];

/**
 * Write or edit one review.
 *
 * A dialog rather than an inline form: the reviews sit at the bottom of a long
 * club page, and growing one open would push everything under it down while
 * somebody is mid-sentence.
 */
export default function ReviewForm({
  clubId, slug, faction, mine, busy, error, onSubmit,
}: {
  clubId: number;
  slug: string;
  faction: Faction;
  mine: ClubReview | null;
  busy: boolean;
  error?: string;
  onSubmit: (data: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(mine?.rating ?? null);
  const [comment, setComment] = useState(mine?.comment ?? "");
  const fullScreen = useMediaQuery("(max-width:600px)");

  const send = () => {
    const data = new FormData();
    data.set("intent", mine ? "edit" : "write");
    data.set("slug", slug);
    data.set("clubId", String(clubId));
    data.set("reviewId", String(mine?.id ?? ""));
    data.set("rating", String(rating ?? 0));
    data.set("comment", comment);
    startTransition(() => onSubmit(data));
    setOpen(false);
  };

  return (
    <>
      <Button variant={mine ? "outlined" : "contained"} startIcon={<RateReviewIcon />}
        onClick={() => setOpen(true)}
        sx={mine ? undefined : { backgroundColor: faction.base,
                                 "&:hover": { backgroundColor: faction.deep } }}>
        {mine ? "Edit your review" : "Write a review"}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"
        fullScreen={fullScreen}>
        <DialogTitle sx={{ pr: 6 }}>
          {mine ? "Edit your review" : "Write a review"}
          <IconButton onClick={() => setOpen(false)} aria-label="Close"
            sx={{ position: "absolute", right: 12, top: 12 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            <Stack spacing={0.75}>
              <Typography variant="body2" sx={{ color: tokens.inkMuted,
                                                fontFamily: "var(--font-display)" }}>
                Your score
              </Typography>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Rating value={rating} onChange={(_, v) => setRating(v)} size="large"
                  sx={{ color: tokens.brass, "& .MuiRating-iconEmpty": { color: "#D9E1EB" } }} />
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  {rating ? WORDS[rating] : "Pick a score"}
                </Typography>
              </Stack>
            </Stack>

            <TextField
              label="What was it like?"
              multiline
              minRows={4}
              fullWidth
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              helperText="What you played, who you met, how welcome you felt."
              slotProps={{ htmlInput: { maxLength: 4000 } }}
            />

            <Box>
              <Button variant="contained" size="large" fullWidth loading={busy}
                loadingPosition="start" disabled={!rating || !comment.trim()}
                onClick={send}
                sx={{ backgroundColor: faction.base,
                      "&:hover": { backgroundColor: faction.deep } }}>
                {mine ? "Save changes" : "Post review"}
              </Button>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
