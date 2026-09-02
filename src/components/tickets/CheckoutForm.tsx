"use client";

import { useActionState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/Lock";
import { ticketAction, type TicketState } from "@/app/clubs/[slug]/events/[eventId]/actions";
import TicketPointsField from "./TicketPointsField";
import { formatMoney } from "@/utils/format";
import type { TicketPrice, TicketStanding } from "@/utils/ticket-pricing";
import { tokens, type Faction } from "@/lib/tokens";

/**
 * Confirm and reserve.
 *
 * No card fields: nothing takes money yet, and a fake card form would teach
 * people to type real numbers into it. The buyer's details are still collected,
 * because the club needs to know who is coming.
 */
export default function CheckoutForm({
  slug, eventKey, eventId, fullName, email, currency, faction,
  standing, price, points, onPoints,
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
}) {
  const [state, submit, busy] = useActionState<TicketState, FormData>(ticketAction, {});

  return (
    <Box component="form" action={submit}>
      <input type="hidden" name="intent" value="checkout" />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="eventKey" value={eventKey} />
      <input type="hidden" name="eventId" value={eventId} />

      <Stack spacing={2.5}>
        {state.error ? <Alert severity="error">{state.error}</Alert> : null}

        <TicketPointsField standing={standing} price={price}
          points={points} onPoints={onPoints} />

        <Stack spacing={2}>
          <TextField name="fullName" label="Your name" defaultValue={fullName} required fullWidth
            autoComplete="name" />
          <TextField name="email" type="email" label="Email for your confirmation"
            defaultValue={email} required fullWidth autoComplete="email"
            helperText="Your reference and the club's notes for the day go here." />
        </Stack>

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

        <Button type="submit" variant="contained" size="large" fullWidth
          loading={busy} loadingPosition="start"
          sx={{ backgroundColor: faction.base, "&:hover": { backgroundColor: faction.deep } }}>
          Reserve for {formatMoney(price.total, currency)}
        </Button>
      </Stack>
    </Box>
  );
}
