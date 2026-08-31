import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import LockIcon from "@mui/icons-material/Lock";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { ClubSession } from "@/types/club";

/**
 * When the club meets, and the way to book a table.
 *
 * Booking used to hang off a four-character "Book" link inside the TABLES
 * stat, which is the smallest thing on a page three thousand pixels long.
 * Legacy gives it a section of its own with a primary button
 * (detail.js:927), and it is the main thing most people come here to do.
 *
 * A non-member is shown the nights and told what joining unlocks rather than
 * being given a button that would refuse them.
 */
export default function ClubNights({
  schedule, tablesAvailable, slug, clubName, faction, canBook, signedIn, isMember,
}: {
  schedule: ClubSession[];
  tablesAvailable: number | null;
  slug: string;
  clubName: string;
  faction: Faction;
  canBook: boolean;
  signedIn: boolean;
  isMember: boolean;
}) {
  const takesBookings = (tablesAvailable ?? 0) > 0;

  return (
    <Stack spacing={2}>
      {schedule.length ? (
        <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
          {schedule.map((session, i) => (
            <Stack key={`${session.day}-${i}`} direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 0.25, sm: 2 }}
              sx={{ px: 2, py: 1.5, alignItems: { sm: "baseline" },
                    borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}`,
                    backgroundColor: i % 2 ? tokens.surface : tokens.paper }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.85rem", fontWeight: 700,
                                minWidth: 92 }}>
                {session.day}
              </Typography>
              <Typography sx={{ fontFamily: mono, fontSize: "0.85rem", flexShrink: 0 }}>
                {session.time}
              </Typography>
              {session.label ? (
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  {session.label}
                </Typography>
              ) : null}
            </Stack>
          ))}
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          {clubName} has not published its meeting nights yet.
        </Typography>
      )}

      {takesBookings ? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
          sx={{ alignItems: { sm: "center" } }}>
          {canBook ? (
            <NextLink href={`/clubs/${slug}/bookings`} style={{ textDecoration: "none" }}>
              <Button variant="contained" size="large" startIcon={<EventSeatIcon />}
                sx={{ minHeight: 48, px: 3, bgcolor: faction.base,
                      "&:hover": { bgcolor: faction.deep } }}>
                Book a table
              </Button>
            </NextLink>
          ) : (
            // A button that refuses is worse than no button, so this says what
            // is needed and offers the step that gets there.
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
              <LockIcon sx={{ fontSize: 17, color: tokens.inkMuted, flexShrink: 0 }} />
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                {isMember
                  ? "Table booking is open to approved members."
                  : signedIn
                    ? `Join ${clubName} to book a table.`
                    : `Sign in and join ${clubName} to book a table.`}
              </Typography>
            </Stack>
          )}

          {!canBook ? (
            <NextLink href={`/clubs/${slug}#join`} style={{ textDecoration: "none" }}>
              <Button variant="contained" size="large"
                sx={{ minHeight: 48, px: 3, bgcolor: faction.base,
                      "&:hover": { bgcolor: faction.deep } }}>
                {signedIn ? "Join this club" : "Sign in and join"}
              </Button>
            </NextLink>
          ) : null}

          <Typography sx={{ fontFamily: mono, fontSize: "0.78rem", color: tokens.inkMuted }}>
            {tablesAvailable} {tablesAvailable === 1 ? "table" : "tables"} a night
          </Typography>
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          {clubName} does not take table bookings through FindAGamesClub. Turn up on
          one of the nights above.
        </Typography>
      )}
    </Stack>
  );
}
