import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import NextLink from "next/link";
import LongText from "@/components/ui/LongText";
import Button from "@mui/material/Button";
import { ownerCanEdit } from "@/utils/submission-status";
import type { ListingCard } from "@/services/submissions.service";
import { mono, tokens } from "@/lib/tokens";

/**
 * Where a listing got to, and the one thing to do about it.
 *
 * The account overview only, which is a glance rather than a list: one card for
 * the newest, and a link to the rest. `/list-your-club` and `/account/listings`
 * both use `ListingList` instead, because there the question is "which of mine"
 * rather than "is anything waiting on me".
 *
 * Legacy has nothing like it, because legacy has no draft: somebody who started
 * and stopped had nothing to come back to.
 */
export default function ListingResumeCard({ card }: { card: ListingCard }) {
  const tone = card.tone === "good" ? tokens.positive
    : card.tone === "bad" ? tokens.danger
      : card.tone === "warn" ? tokens.brass : tokens.inkMuted;

  const editable = ownerCanEdit(card.status);

  return (
    <Stack spacing={1.25}
      sx={{ p: 2.5, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
            backgroundColor: tokens.paper }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: tokens.inkMuted }}>
          YOUR LISTING
        </Typography>
        <Chip size="small" label={card.statusLabel}
          sx={{ bgcolor: tone, color: "#fff", fontWeight: 700, fontSize: "0.68rem" }} />
      </Stack>

      <Typography variant="h4" sx={{ fontSize: "1.1rem" }}>
        {card.clubName}{card.city ? `, ${card.city}` : ""}
      </Typography>

      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>{card.next}</Typography>

      {/* The admin's own words, apart from our sentence and bounded like every
          other piece of free text. A 600-character reason folded into the line
          above ran the card down the page. */}
      {card.said ? <LongText text={card.said} max={120} /> : null}

      {editable ? (
        <NextLink href={`/list-your-club/${card.id}/${card.lastStep}`}
          style={{ textDecoration: "none", alignSelf: "flex-start" }}>
          <Button variant="contained">
            {card.status === "changes_requested" ? "Make the changes" : "Pick up where you left off"}
          </Button>
        </NextLink>
      ) : card.status === "approved" ? (
        <NextLink href="/my-clubs" style={{ textDecoration: "none", alignSelf: "flex-start" }}>
          <Button variant="outlined">Open your club</Button>
        </NextLink>
      ) : null}

      {/* This card can only ever show one. Somebody with two on the go needs
          the door to the rest of them. */}
      <NextLink href="/account/listings" style={{ textDecoration: "none" }}>
        <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
          All your listings
        </Typography>
      </NextLink>
    </Stack>
  );
}
