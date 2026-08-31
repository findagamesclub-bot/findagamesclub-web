"use client";

import { startTransition, useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ClubLogo from "@/components/clubs/ClubLogo";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useActionToast } from "@/components/ui/Toaster";
import { accountBookingAction, type AccountBookingState }
  from "@/app/account/bookings/actions";
import { clubIdentity } from "@/utils/club-identity";
import { nightLabel } from "@/utils/dates";
import { formatPence } from "@/utils/format";
import { mono, tokens } from "@/lib/tokens";
import type { TableBooking } from "@/services/dashboard.service";

/**
 * One booked table, with the two things a member wants to do to it.
 *
 * Cancelling used to mean working out which club a booking belonged to and
 * going to that club's page. Adding the result afterwards lives on Your games,
 * which is linked from here rather than left to be found.
 */
export default function TableBookingRow({ booking }: { booking: TableBooking }) {
  const { faction } = clubIdentity(booking.clubSlug, booking.clubName);
  const [state, submit, busy] = useActionState<AccountBookingState, FormData>(
    accountBookingAction, {});
  useActionToast(state);
  const [asking, setAsking] = useState(false);

  const cancel = () => {
    const data = new FormData();
    data.set("bookingId", String(booking.id));
    data.set("clubSlug", booking.clubSlug);
    data.set("clubName", booking.clubName);
    startTransition(() => submit(data));
    setAsking(false);
  };

  const facts = [
    booking.opponentName ? `vs ${booking.opponentName}` : null,
    booking.total > 0 ? formatPence(booking.total) : "nothing to pay",
    booking.tierLabel,
  ].filter(Boolean) as string[];

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}
      sx={{ p: 2.25, borderRadius: 2, alignItems: { sm: "center" },
            border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      <ClubLogo slug={booking.clubSlug} name={booking.clubName}
        logoUrl={booking.logoUrl} size={44} ring={tokens.rule} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1">{booking.gameTitle || "Table booked"}</Typography>
        <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                          letterSpacing: "0.06em", color: tokens.inkMuted }}>
          {booking.clubName.toUpperCase()}
        </Typography>
        {/* What it costs, said here rather than only in the booking dialog:
            this is the page somebody checks before a club night. */}
        {facts.length ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 0.25 }}>
            {facts.join(" · ")}
          </Typography>
        ) : null}
      </Box>

      <Stack sx={{ alignItems: { xs: "flex-start", sm: "flex-end" }, flexShrink: 0 }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.95rem", fontWeight: 700,
                          color: faction.deep }}>
          {nightLabel(booking.date)}
        </Typography>
        {booking.time ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.75rem", color: tokens.inkMuted }}>
            {booking.time}
          </Typography>
        ) : null}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
        <NextLink href={`/clubs/${booking.clubSlug}/bookings`} style={{ textDecoration: "none" }}>
          <Button size="small" variant="outlined"
            sx={{ color: tokens.ink, borderColor: tokens.rule }}>
            The night
          </Button>
        </NextLink>

        {/* Shown disabled with the reason rather than hidden: a member looking
            for the cancel button on the day needs to know why it is not there. */}
        <Tooltip title={booking.isToday ? "Tonight's table cannot be cancelled here" : ""}>
          <span>
            <Button size="small" variant="text" loading={busy}
              disabled={busy || booking.isToday}
              onClick={() => setAsking(true)}
              sx={{ color: tokens.inkMuted,
                    "&:hover": { color: tokens.danger, backgroundColor: "transparent" } }}>
              Cancel
            </Button>
          </span>
        </Tooltip>
      </Stack>

      <ConfirmDialog
        open={asking}
        title="Cancel this table?"
        body={
          <>
            {`Your table at ${booking.clubName} on ${nightLabel(booking.date)} will be given up, `}
            {"and anybody on the waiting list is offered it straight away. "}
            {booking.total > 0
              ? "Nothing has been paid, so there is nothing to refund."
              : "Nothing was owed on it."}
          </>
        }
        confirmLabel="Cancel the booking"
        cancelLabel="Keep it"
        destructive
        busy={busy}
        onConfirm={cancel}
        onClose={() => setAsking(false)}
      />
    </Stack>
  );
}
