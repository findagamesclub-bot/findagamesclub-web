"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ClubLogo from "@/components/clubs/ClubLogo";
import { nightLabel } from "@/utils/dates";
import { clubIdentity } from "@/utils/club-identity";
import { mono, tokens } from "@/lib/tokens";
import type { OwnerResult } from "@/services/ownerBookings.service";

/**
 * One table still to come, as a card.
 *
 * Not the results row: everything here is in the future, so there is no score
 * to show and nothing to approve. Showing "ADD A SCORE" against a game nobody
 * has played yet is an invitation to record a result for a night that has not
 * happened.
 */
export default function OwnerBookingCard({ booking }: { booking: OwnerResult }) {
  const { faction } = clubIdentity(booking.club.slug, booking.club.name);
  const [weekday, day, month] = nightLabel(booking.date).split(" ");

  return (
    <Stack sx={{ height: "100%", borderRadius: 2, overflow: "hidden",
                 backgroundColor: tokens.paper,
                 border: `1px solid ${tokens.rule}`,
                 transition: "border-color 140ms ease",
                 "&:hover": { borderColor: faction.base } }}>
      <Stack direction="row" spacing={1.5} sx={{ p: 2, alignItems: "flex-start" }}>
        {/* The night as a tile: this page is read to answer "what is on when",
            so the date is the thing the eye should land on. */}
        <Stack sx={{ alignItems: "center", px: 1.25, py: 0.75, borderRadius: 1.5,
                     backgroundColor: faction.base, color: "#FFFFFF",
                     minWidth: 52, flexShrink: 0 }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.58rem",
                            letterSpacing: "0.1em", opacity: 0.9 }}>
            {weekday?.toUpperCase()}
          </Typography>
          <Typography sx={{ fontFamily: mono, fontSize: "1.25rem", fontWeight: 700,
                            lineHeight: 1.05 }}>
            {day}
          </Typography>
          <Typography sx={{ fontFamily: mono, fontSize: "0.6rem",
                            letterSpacing: "0.08em", opacity: 0.9 }}>
            {month?.toUpperCase()}
          </Typography>
        </Stack>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ lineHeight: 1.3 }}>
            {booking.homeName} v {booking.awayName}
          </Typography>
          <Typography variant="body2" noWrap sx={{ color: tokens.inkMuted }}>
            {booking.title}
          </Typography>
          {booking.time ? (
            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", color: tokens.inkMuted }}>
              {booking.time}
            </Typography>
          ) : null}
        </Box>
      </Stack>

      <Stack direction="row" spacing={1.5}
        sx={{ mt: "auto", px: 2, py: 1.25, alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>
        <Stack direction="row" spacing={0.875} sx={{ alignItems: "center", minWidth: 0 }}>
          <ClubLogo slug={booking.club.slug} name={booking.club.name}
            logoUrl={null} size={22} ring={tokens.rule} />
          <Typography noWrap sx={{ fontFamily: mono, fontSize: "0.64rem",
                                   letterSpacing: "0.06em", color: tokens.inkMuted }}>
            {booking.club.name.toUpperCase()}
          </Typography>
        </Stack>

        <NextLink href={`/clubs/${booking.club.slug}/bookings`} style={{ textDecoration: "none" }}>
          <Typography variant="body2" sx={{ color: faction.deep, fontWeight: 600,
                                            flexShrink: 0 }}>
            Manage
          </Typography>
        </NextLink>
      </Stack>
    </Stack>
  );
}
