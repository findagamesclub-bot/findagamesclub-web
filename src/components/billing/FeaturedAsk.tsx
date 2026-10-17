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
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { billingAction, type BillingState } from
  "@/app/clubs/[slug]/(console)/manage/billing/actions";
import type { FeaturedRequest } from "@/services/featuredRequests.service";
import { MAX_FEATURED_ASKS } from "@/utils/featured-slots";
import { pricePence as money } from "@/utils/format";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

/**
 * Asking to lead the homepage.
 *
 * An ask, not a booking. Slots are dated, priced and paid for offline, so an
 * admin still books the dates and records the money through 0113; this is the
 * half that was missing, which was any way for a club to put its hand up.
 *
 * It held one ask at a time until 0204, and the client asked for more: a club
 * running four events a year wants four weeks, each with its own date and its
 * own answer. So the form stays open while asks are waiting, and each one gets
 * its own way back out rather than the club having to take back the week it
 * does want to ask for a second.
 *
 * The price is here because a club deciding whether to ask needs to know what
 * it costs before it asks, not after somebody replies.
 */
export default function FeaturedAsk({
  slug, open, answered, pricePence, days, currency,
}: {
  slug: string;
  /** Asks waiting on an answer, longest-waiting first. */
  open: FeaturedRequest[];
  /** Their most recent answered ask, which is only read for a decline. */
  answered: FeaturedRequest | null;
  pricePence: number;
  days: number;
  currency: string;
}) {
  const [state, submit, busy] =
    useActionState<BillingState, FormData>(billingAction, {});
  useActionToast(state);
  // Uncontrolled, and cleared by remounting on a key. A controlled MUI
  // `multiline` field drops the character that wraps a line, because
  // TextareaAutosize re-renders with the previous value still in the prop;
  // 0185 measured a letter going per line on the noticeboard.
  const [asked, setAsked] = useState(0);
  // One spinner marks one action, so a take-back tracks which row was pressed.
  // A single busy flag across five buttons means either all of them spin or,
  // as the check-in board shipped once, none of them does.
  const [pending, setPending] = useState<number | null>(null);

  // Emptied on the way out, because the form stays on screen now: a week that
  // has just been asked for, still sitting in the box, reads as an ask that
  // did not go. Only on success, so a refusal keeps what was typed.
  useActionSuccess(state, () => { setAsked((count) => count + 1); setPending(null); });

  const send = (event: React.FormEvent<HTMLFormElement>, id?: number) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(id ?? null);
    startTransition(() => submit(data));
  };

  const turnedDown = answered?.status === "declined";
  const full = open.length >= MAX_FEATURED_ASKS;

  const cost = pricePence > 0
    ? `${money(pricePence, currency)} for ${days} days`
    : `${days} days`;

  return (
    <Stack spacing={2}>
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        {`Featured clubs lead the homepage, above the directory. A slot runs for `
          + `${cost}. Ask for as many weeks as you need and we will come back to `
          + `you on each one.`}
      </Typography>

      {open.length > 0 ? (
        <Stack>
          {open.map((request) => (
            // A row, not a card. Five of these sit directly under the slot
            // list above, which is hairline-separated mono rows: the same
            // panel drawing one list as rows and the other as boxes reads as
            // two panels, and at the cap it was five tall boxes for one fact
            // each.
            <Stack key={request.id} direction="row" spacing={1.5}
              sx={{ py: 1.1, alignItems: "flex-start", flexWrap: "wrap",
                    borderBottom: `1px solid ${tokens.rule}`,
                    "&:last-of-type": { borderBottom: 0 } }} useFlexGap>
              <Stack spacing={0.4} sx={{ flex: "1 1 240px", minWidth: 0 }}>
                <Stack direction="row" spacing={1}
                  sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
                  <StatusChip label="Asked" tone="waiting" />
                  <Typography sx={{ fontFamily: mono, fontSize: "0.8rem" }}>
                    {request.preferredFrom
                      ? `The week of ${shortDate(request.preferredFrom)}`
                      : "No dates named"}
                  </Typography>
                </Stack>

                {/* Their own words back, so a club that asked for something in
                    particular can see we have it rather than wondering. */}
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  {[`Asked on ${shortDate(request.createdAt.slice(0, 10))}`,
                    request.note || null].filter(Boolean).join(" · ")}
                </Typography>
              </Stack>

              <Box component="form" onSubmit={(event) => send(event, request.id)}
                sx={{ flexShrink: 0 }}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="intent" value="withdraw-featured" />
                <input type="hidden" name="requestId" value={String(request.id)} />
                <Button type="submit" size="small" variant="text" color="inherit"
                  loading={busy && pending === request.id} loadingPosition="start"
                  aria-label={request.preferredFrom
                    ? `Take back the ask for the week of ${shortDate(request.preferredFrom)}`
                    : "Take back the ask with no dates named"}
                  sx={{ color: tokens.inkMuted }}>
                  Take it back
                </Button>
              </Box>
            </Stack>
          ))}
        </Stack>
      ) : null}

      {/* Only a decline. A booked one is the slot listed above this panel, and
          saying it twice is the page talking over itself. */}
      {turnedDown ? (
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
            <StatusChip label="Not this time" tone="quiet" />
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {`Answered on ${shortDate((answered!.answeredAt ?? answered!.createdAt).slice(0, 10))}.`}
            </Typography>
          </Stack>
          {answered!.declineReason ? (
            <Typography variant="body2" sx={{ fontStyle: "italic" }}>
              {answered!.declineReason}
            </Typography>
          ) : null}
        </Stack>
      ) : null}

      {full ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          {`${MAX_FEATURED_ASKS} asks waiting is as many as we hold at once. Take `
            + `one back if you would rather ask for different dates.`}
        </Typography>
      ) : (
        <Box component="form" key={asked} onSubmit={send}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="intent" value="ask-featured" />

          <Stack spacing={2}>
            <TextField
              name="preferredFrom" type="date" label="Any week in mind"
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Optional. Leave it blank and we will find you a gap."
              fullWidth />

            <TextField
              name="note" label="Anything we should know"
              multiline minRows={2} fullWidth
              helperText="Optional. An open day or a tournament is worth saying." />

            <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
              <SubmitButton
                label={open.length > 0 ? "Ask for another week" : "Ask to be featured"}
                pendingLabel="Asking" pending={busy && pending === null}
                startIcon={<StarIcon />} />
            </Stack>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
