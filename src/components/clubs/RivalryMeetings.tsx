import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import { nightLabel, shortDate } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { RivalryMeeting } from "@/services/games.service";
import MonoLabel from "@/components/ui/MonoLabel";

/**
 * The meetings already in the diary.
 *
 * Everything else on this page is history. Legacy leads its head-to-head with
 * the next booked game for the same reason a fixture list beats a results
 * archive: the interesting one has not been played yet.
 */
export default function RivalryMeetings({
  meetings, faction, slug,
}: {
  meetings: RivalryMeeting[];
  faction: Faction;
  slug: string;
}) {
  const [next, ...rest] = meetings;

  return (
    <Box>
      <MonoLabel>NEXT MEETINGS</MonoLabel>

      {!next ? (
        <Stack spacing={1.5}
          sx={{ alignItems: "flex-start", p: { xs: 2, sm: 2.5 }, borderRadius: 1.5,
                border: `1px dashed ${tokens.rule}`, backgroundColor: tokens.paper }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Nothing booked between them yet. Book a table and name the other as your
            opponent, and it will show up here.
          </Typography>
          {/* A Server Component cannot hand NextLink to MUI as a component
              prop, so the button sits inside a plain link instead. */}
          <NextLink href={`/clubs/${slug}/bookings`} style={{ textDecoration: "none" }}>
            <Button variant="outlined" size="small">Open the diary</Button>
          </NextLink>
        </Stack>
      ) : (
        <Stack spacing={0}
          sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1.5, sm: 2.5 }}
            sx={{ px: { xs: 2, sm: 2.5 }, py: 2, alignItems: { sm: "center" },
                  backgroundColor: faction.soft }}>
            <EventAvailableIcon sx={{ fontSize: 26, color: faction.deep, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: "1.05rem", fontWeight: 600, color: faction.deep }}>
                {nightLabel(next.date)}
              </Typography>
              <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: faction.deep,
                                opacity: 0.85, mt: 0.25 }}>
                {[next.time, next.label].filter(Boolean).join(" · ").toUpperCase()}
              </Typography>
              <Typography variant="body2" sx={{ color: tokens.ink, mt: 0.75 }}>
                {next.game}
              </Typography>
              {next.notes ? (
                <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 0.25 }}>
                  {next.notes}
                </Typography>
              ) : null}
            </Box>
            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", color: tokens.inkMuted,
                              flexShrink: 0 }}>
              {`BOOKED BY ${next.bookedBy.toUpperCase()}`}
            </Typography>
          </Stack>

          {rest.map((m) => (
            <Box key={m.bookingId}
              sx={{ display: "grid", gap: { xs: 0.5, sm: 1.5 }, px: 2, py: 1.5,
                    alignItems: { sm: "baseline" },
                    gridTemplateColumns: { xs: "1fr", sm: "76px minmax(0, 1fr) auto" },
                    borderTop: `1px solid ${tokens.rule}` }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
                {(shortDate(m.date) ?? "").toUpperCase()}
              </Typography>
              <Typography variant="body2" sx={{ minWidth: 0 }}>{m.game}</Typography>
              <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", color: tokens.inkMuted,
                                textAlign: { sm: "right" } }}>
                {[m.time, `BOOKED BY ${m.bookedBy}`].filter(Boolean).join(" · ").toUpperCase()}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
