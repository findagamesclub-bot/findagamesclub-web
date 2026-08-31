import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { nightLabel } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";
import type { EventAttendance } from "@/services/memberContext.service";

function Group({ title, events, empty }: {
  title: string;
  events: EventAttendance[];
  empty: string;
}) {
  return (
    <Box>
      <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", fontWeight: 700,
                        letterSpacing: "0.1em", color: tokens.inkMuted, mb: 1 }}>
        {title.toUpperCase()}
      </Typography>

      {events.length ? (
        <Stack spacing={1}>
          {events.map((event) => (
            <Stack key={event.id} direction="row" spacing={1.5}
              sx={{ px: 1.75, py: 1.25, borderRadius: 2, alignItems: "center",
                    border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <NextLink href={event.href}
                  style={{ textDecoration: "none", color: "inherit" }}>
                  <Typography sx={{ fontFamily: display, fontWeight: 700,
                                    "&:hover": { color: tokens.brand } }} noWrap>
                    {event.title}
                  </Typography>
                </NextLink>
                <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                  color: tokens.inkMuted }} noWrap>
                  {[
                    event.club.name.toUpperCase(),
                    event.date ? nightLabel(event.date).toUpperCase() : null,
                    // Only when it is more than one, or every row carries a
                    // number that means nothing.
                    event.bookings > 1 ? `${event.bookings} BOOKINGS` : null,
                  ].filter(Boolean).join(" · ")}
                </Typography>
              </Box>

              {event.tickets > 1 ? (
                <Chip size="small" label={`${event.tickets} tickets`}
                  sx={{ height: 20, fontFamily: mono, fontSize: "0.62rem",
                        flexShrink: 0, bgcolor: tokens.surface }} />
              ) : null}
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>{empty}</Typography>
      )}
    </Box>
  );
}

/**
 * What this member has booked and been to.
 *
 * Legacy's two groups kept, and its rule: visible to anybody who shares an
 * approved membership with them. What they paid is deliberately left out, the
 * one field on the row no other member needs.
 */
export default function MemberEvents({ events }: { events: EventAttendance[] }) {
  const upcoming = events.filter((event) => !event.past);
  const past = events.filter((event) => event.past);

  return (
    <Stack spacing={2.5}>
      <Group title="Upcoming events booked" events={upcoming}
        empty="Nothing booked at the moment." />
      <Group title="Previous events attended" events={past}
        empty="No past events recorded yet." />
    </Stack>
  );
}
