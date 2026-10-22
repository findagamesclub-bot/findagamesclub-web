"use client";

import { useActionState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/Lock";
import { ticketAction, type TicketState } from "@/app/clubs/[slug]/(console)/events/[eventId]/actions";
import TicketPointsField from "./TicketPointsField";
import { formatMoney } from "@/utils/format";
import type { TicketPrice, TicketStanding } from "@/utils/ticket-pricing";
import { display, mono, tokens, type Faction } from "@/lib/tokens";

/**
 * Confirm and reserve.
 *
 * No card fields: nothing takes money yet, and a fake card form would teach
 * people to type real numbers into it. The buyer's details are still collected,
 * because the club needs to know who is coming.
 */
export default function CheckoutForm({
  slug, eventKey, eventId, fullName, email, currency, faction,
  standing, price, points, onPoints, showPaymentNote = true, teamEvent = false,
}: {
  slug: string;
  eventKey: string;
  eventId: number;
  fullName: string;
  email: string;
  currency: string;
  faction: Faction;
  /** What they may pay with. The field hides itself when that is nothing. */
  standing: TicketStanding;
  /** Priced by the parent, so the button and the order summary cannot disagree. */
  price: TicketPrice;
  points: number;
  onPoints: (value: number) => void;
  /**
   * The drawer turns this off. The event behind it already says the same
   * sentence under the ticket list, and a form that repeats it takes a third
   * of a phone screen to say nothing new.
   */
  showPaymentNote?: boolean;
  /**
   * Asked for only at a team event. The client's words: "for a team event
   * ticket booking, we should also capture a team name as part of the
   * booking." Anywhere else it is a field nobody can read back, and 0211
   * drops it on the way in rather than trusting the screen to have asked.
   */
  teamEvent?: boolean;
}) {
  const [state, submit, busy] = useActionState<TicketState, FormData>(ticketAction, {});

  return (
    <Box component="form" action={submit}>
      <input type="hidden" name="intent" value="checkout" />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="eventKey" value={eventKey} />
      <input type="hidden" name="eventId" value={eventId} />
      {/* Still posted, because the database keeps them as a fallback for an
          account whose profile carries no name. Never editable here. */}
      <input type="hidden" name="fullName" value={fullName} />
      <input type="hidden" name="email" value={email} />

      <Stack spacing={2.5}>
        {state.error ? <Alert severity="error">{state.error}</Alert> : null}

        <TicketPointsField standing={standing} price={price}
          points={points} onPoints={onPoints} />

        {/* Read back, not asked for. The place is the account's: a member
            typing somebody else's name here was booking them a place on the
            member's own tier discount, which is the thing the client objected
            to on the club's side first. 0208 reads both from the account on
            the way in as well, because a form is a claim and not a fact.

            Booking for somebody else has not gone, it has moved: the club does
            it from the door list, priced off whoever is named. */}
        <Stack spacing={0.75}
          sx={{ p: 2, borderRadius: 1.5, backgroundColor: tokens.surface,
                border: `1px solid ${tokens.rule}` }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                            letterSpacing: "0.1em", color: tokens.inkMuted }}>
            THIS PLACE IS FOR
          </Typography>
          <Typography sx={{ fontFamily: display, fontWeight: 700, fontSize: "1rem" }}>
            {fullName || "You"}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.inkMuted, wordBreak: "break-all" }}>
            {email}
          </Typography>
          <Typography variant="caption"
            sx={{ fontFamily: display, color: tokens.inkMuted, pt: 0.5 }}>
            Your reference and the club&apos;s notes for the day go to this address.
            Booking somebody else in is the club&apos;s to do, so ask them.
          </Typography>
        </Stack>

        {teamEvent ? (
          <TextField name="teamName" label="Your team" fullWidth
            slotProps={{ htmlInput: { maxLength: 80 } }}
            helperText="Who you are playing for. The club builds the teams from these, so everybody in yours should type the same thing." />
        ) : null}

        {showPaymentNote ? (
        <Box sx={{ p: 2, borderRadius: 1.5, backgroundColor: tokens.surface,
                   border: `1px solid ${tokens.rule}` }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
            <LockIcon sx={{ fontSize: 18, color: tokens.inkMuted, mt: 0.25 }} />
            <Stack spacing={0.25}>
              <Typography variant="subtitle2" sx={{ fontFamily: "var(--font-display)" }}>
                Payment for the event
              </Typography>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                Reserving holds your place. You settle up with the club either prior to
                the event or on the day, depending on their terms.
              </Typography>
            </Stack>
          </Stack>
        </Box>
        ) : null}

        <Button type="submit" variant="contained" size="large" fullWidth
          loading={busy} loadingPosition="start"
          sx={{ backgroundColor: faction.base, "&:hover": { backgroundColor: faction.deep } }}>
          Reserve for {formatMoney(price.total, currency)}
        </Button>
      </Stack>
    </Box>
  );
}
