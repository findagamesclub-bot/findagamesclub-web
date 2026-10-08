"use client";

import { startTransition, useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import StarIcon from "@mui/icons-material/StarBorder";
import StatusChip from "@/components/ui/StatusChip";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { billingAction, type BillingState } from
  "@/app/clubs/[slug]/(console)/manage/billing/actions";
import type { FeaturedRequest } from "@/services/featuredRequests.service";
import { pricePence as money } from "@/utils/format";
import { shortDate } from "@/utils/dates";
import { tokens } from "@/lib/tokens";

/**
 * Asking to lead the homepage.
 *
 * An ask, not a booking. Slots are dated, priced and paid for offline, so an
 * admin still books the dates and records the money through 0113; this is the
 * half that was missing, which was any way for a club to put its hand up. The
 * client asked how an owner selects a featured listing and the answer was that
 * they could not, and nothing on any owner screen said the option existed.
 *
 * The price is here because a club deciding whether to ask needs to know what
 * it costs before it asks, not after somebody replies.
 */
export default function FeaturedAsk({
  slug, request, pricePence, days, currency,
}: {
  slug: string;
  /** Their most recent ask, whatever became of it. */
  request: FeaturedRequest | null;
  pricePence: number;
  days: number;
  currency: string;
}) {
  const [state, submit, busy] =
    useActionState<BillingState, FormData>(billingAction, {});
  useActionToast(state);
  const [from, setFrom] = useState("");
  const [note, setNote] = useState("");

  const send = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  };

  const waiting = request?.status === "pending";
  const booked = request?.status === "booked";
  const turnedDown = request?.status === "declined";

  const cost = pricePence > 0
    ? `${money(pricePence, currency)} for ${days} days`
    : `${days} days`;

  return (
    <Stack spacing={2}>
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        {`Featured clubs lead the homepage, above the directory. A slot runs for `
          + `${cost}. We pick the dates from what you ask for and tell you before `
          + `it starts and when it ends.`}
      </Typography>

      {waiting || booked || turnedDown ? (
        <Box sx={{ p: 1.75, borderRadius: 1.5, backgroundColor: tokens.surface,
                   border: `1px solid ${tokens.rule}` }}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
              <StatusChip
                label={waiting ? "Asked" : booked ? "Booked" : "Not this time"}
                tone={waiting ? "waiting" : booked ? "kept" : "quiet"} />
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                {waiting
                  ? `You asked on ${shortDate(request!.createdAt.slice(0, 10))}.`
                  : booked
                    ? "Your slot is booked. You will hear when it starts."
                    : `Answered on ${shortDate((request!.answeredAt ?? request!.createdAt).slice(0, 10))}.`}
              </Typography>
            </Stack>

            {/* Their own words back, so a club that asked for a particular week
                can see we have it rather than wondering if it got through. */}
            {waiting && (request!.preferredFrom || request!.note) ? (
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                {[
                  request!.preferredFrom
                    ? `From ${shortDate(request!.preferredFrom)}`
                    : null,
                  request!.note || null,
                ].filter(Boolean).join(" · ")}
              </Typography>
            ) : null}

            {turnedDown && request!.declineReason ? (
              <Typography variant="body2" sx={{ fontStyle: "italic" }}>
                {request!.declineReason}
              </Typography>
            ) : null}

            {waiting ? (
              <Box component="form" onSubmit={send}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="intent" value="withdraw-featured" />
                <input type="hidden" name="requestId" value={String(request!.id)} />
                <Button type="submit" size="small" variant="text" color="inherit"
                  disabled={busy} sx={{ color: tokens.inkMuted, alignSelf: "flex-start" }}>
                  Take it back
                </Button>
              </Box>
            ) : null}
          </Stack>
        </Box>
      ) : null}

      {/* Asking again after a decline or a withdrawal is ordinary, so the form
          comes back rather than the panel going quiet. */}
      {waiting || booked ? null : (
        <Box component="form" onSubmit={send}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="intent" value="ask-featured" />

          <Stack spacing={2}>
            <TextField
              name="preferredFrom" type="date" label="Any week in mind"
              value={from} onChange={(event) => setFrom(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Optional. Leave it blank and we will find you a gap."
              fullWidth />

            <TextField
              name="note" label="Anything we should know"
              value={note} onChange={(event) => setNote(event.target.value)}
              multiline minRows={2} fullWidth
              helperText="Optional. An open day or a tournament is worth saying." />

            <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
              <SubmitButton label="Ask to be featured" pendingLabel="Asking"
                pending={busy} startIcon={<StarIcon />} />
            </Stack>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
