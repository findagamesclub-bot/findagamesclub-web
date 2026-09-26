"use client";

import { useActionState, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LongText from "@/components/ui/LongText";
import Alert from "@mui/material/Alert";
import NextLink from "next/link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import {
  claimClubAction, withdrawClaimAction, type ClaimState,
} from "@/app/clubs/[slug]/claim/actions";
import { claimantNextStep, claimantCanWithdraw, claimLabel } from "@/utils/claim-status";
import { CLAIM_LIMIT } from "@/utils/claims-limit";
import { tokens } from "@/lib/tokens";

/**
 * Say this club is yours.
 *
 * Two fields and no evidence upload, because proving you run a club is done in
 * sentences: a link to the club's own Facebook page, or "I am on the committee
 * and you can ring the venue". An upload would be a file nobody can verify
 * either.
 *
 * Dispatched from `onSubmit` inside a transition rather than through the form's
 * `action` prop, so a refused claim does not empty what they typed. React 19
 * resets a form once its action has run.
 */
export default function ClaimForm({
  slug, clubName, existing,
}: {
  slug: string;
  clubName: string;
  existing: { id: number; status: string; note: string } | null;
}) {
  const [state, act, working] =
    useActionState<ClaimState, FormData>(claimClubAction, {});
  const [pullState, pull, pulling] =
    useActionState<ClaimState, FormData>(withdrawClaimAction, {});
  useActionToast(state);
  useActionToast(pullState);

  const [, start] = useTransition();
  const [, startPull] = useTransition();
  const [words, setWords] = useState("");

  const left = CLAIM_LIMIT - words.length;

  // Only an open claim replaces the form, and an approved one, which means the
  // club is already theirs. A decline does not: the unique index is
  // `where status = 'open'` (0114), so the database allows another go, and the
  // decline dialog promises the club stays open to claims. Blocking all three
  // read the reason out and then offered no way to answer it.
  const answered = existing?.status === "declined" ? existing : null;

  if (existing && (existing.status === "open" || existing.status === "approved")) {
    return (
      <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
        <Typography sx={{ fontWeight: 700 }}>{claimLabel(existing.status)}</Typography>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          {claimantNextStep(existing.status, { note: existing.note, club: clubName })}
        </Typography>

        {claimantCanWithdraw(existing.status) ? (
          <Box component="form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData();
              data.set("claim", String(existing.id));
              data.set("slug", slug);
              startPull(() => pull(data));
            }}>
            <SubmitButton label="Take it back" pendingLabel="Taking it back"
              variant="outlined" pending={pulling}
              sx={{ color: tokens.inkMuted, borderColor: tokens.rule }} />
          </Box>
        ) : (
          <Button component={NextLink} variant="outlined"
            href={`/clubs/${slug}`}>Back to the club</Button>
        )}
      </Stack>
    );
  }

  return (
    <Box component="form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        data.set("slug", slug);
        start(() => act(data));
      }}>
      <Stack spacing={2.5}>
        {/* What they were told last time, above the boxes rather than instead
            of them, so they can answer the thing that was actually asked. */}
        {answered ? (
          <Alert severity="warning" icon={false}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
              We could not hand this one over last time
            </Typography>
            <LongText text={answered.note} lines={9} />
          </Alert>
        ) : null}

        <TextField
          name="message"
          label="Why this club is yours"
          value={words}
          onChange={(e) => setWords(e.target.value)}
          required multiline minRows={5} fullWidth
          slotProps={{ htmlInput: { maxLength: CLAIM_LIMIT } }}
          helperText={left <= 150
            ? `${left} character${left === 1 ? "" : "s"} left.`
            : "Who you are and what you do at the club. A sentence or two is plenty."}
        />

        <TextField
          name="evidence"
          label="Anything that shows it"
          fullWidth multiline minRows={2}
          helperText="A link to the club's own page, a committee list, anything public. Optional."
        />

        <SubmitButton label="Send the claim" pendingLabel="Sending your claim"
          variant="contained" size="large" pending={working}
          sx={{ alignSelf: "flex-start" }} />
      </Stack>
    </Box>
  );
}
