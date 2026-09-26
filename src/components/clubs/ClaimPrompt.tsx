"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ClaimForm from "./ClaimForm";
import { claimLabel } from "@/utils/claim-status";
import { tokens } from "@/lib/tokens";

/**
 * "Is this your club?", and the two boxes behind it.
 *
 * A dialog rather than a page, for the reason the ticket drawer exists: two
 * fields is not worth taking somebody off the club page they are in the middle
 * of deciding about. `/clubs/[slug]/claim` stays exactly where it is, renders
 * the same `ClaimForm`, and is what a bookmarked link or an email to a club
 * still opens. Same call the checkout made.
 *
 * Somebody who has already asked gets the state instead of the button, so the
 * prompt cannot invite a second claim the database would refuse anyway.
 */
export default function ClaimPrompt({
  slug, clubName, existing,
}: {
  slug: string;
  clubName: string;
  existing: { id: number; status: string; note: string } | null;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [open, setOpen] = useState(false);

  // A claim they took back is no claim at all, so the offer comes back. A
  // decline is not a lock either: the database allows another go and the
  // decline dialog promises exactly that. What it does change is the button,
  // because re-offering "Claim it" to somebody just turned down, without
  // showing them why, is the page pretending nothing happened.
  const held = existing && existing.status !== "withdrawn" ? existing : null;

  const heading = held ? claimLabel(held.status) : "Is this your club?";
  const body = !held
    ? "This page was put together without you. Tell us who you are and we "
      + "will hand it over, and everything on it becomes yours to change."
    : held.status === "open"
      ? "You have asked for this one. We will email you either way."
      : "We could not hand this one over. Open it to read why, and to ask again.";
  const label = !held ? "Claim it"
    : held.status === "open" ? "See your claim" : "See what happened";

  return (
    <>
      <Alert severity="info" sx={{ mb: 3 }}
        action={(
          <Button size="small" variant="contained" onClick={() => setOpen(true)}>
            {label}
          </Button>
        )}>
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
          {heading}
        </Typography>
        <Typography variant="body2">{body}</Typography>
      </Alert>

      <Dialog open={open} onClose={() => setOpen(false)}
        fullScreen={fullScreen} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 0.5 }}>Claim {clubName}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 2.5 }}>
            This listing was put together without the club. Tell us who you are
            and we will hand it over, and from then on everything on the page is
            yours to change.
          </Typography>
          <ClaimForm slug={slug} clubName={clubName} existing={existing} />
        </DialogContent>
      </Dialog>
    </>
  );
}
