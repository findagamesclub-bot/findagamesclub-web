import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AttendeeRow from "./AttendeeRow";
import { formatMoney } from "@/utils/format";
import { filterAttendees, type Attendee } from "@/utils/attendee-filter";
import { tokens, type Faction } from "@/lib/tokens";

/**
 * The door list, short.
 *
 * The preview on the event page. DoorList is the same list with the search,
 * the ticket type tabs and the paging, for the page whose whole job is this.
 * Both draw the row from AttendeeRow, so a change to what a booking shows
 * lands in both rather than in whichever one somebody remembered.
 */
export default function AttendeeList({
  attendees, faction, figures = true,
}: {
  attendees: Attendee[];
  faction: Faction;
  /** Off where something else on the page already carries the totals. */
  figures?: boolean;
}) {
  if (!attendees.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Nobody has booked yet. Names appear here the moment they do.
      </Typography>
    );
  }

  // Sorted by name, the same default as the full list: on the day this is read
  // by somebody looking up the person standing in front of them.
  const sorted = filterAttendees(attendees, {});
  const seats = sorted.reduce((n, a) => n + a.tickets, 0);
  const takings = sorted.reduce((n, a) => n + a.total, 0);
  const currency = sorted[0]?.currency ?? "GBP";

  return (
    <Stack spacing={2}>
      {figures ? (
        <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: "wrap", alignItems: "baseline" }}>
          <Figure value={String(sorted.length)} label={sorted.length === 1 ? "booking" : "bookings"} />
          <Figure value={String(seats)} label={seats === 1 ? "ticket" : "tickets"} />
          <Figure value={formatMoney(takings, currency)} label="to pay" tone={tokens.brass} />
        </Stack>
      ) : null}

      <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden",
                 "& > *:not(:first-of-type)": { borderTop: `1px solid ${tokens.rule}` } }}>
        {sorted.map((a, i) => (
          <AttendeeRow key={a.id} attendee={a} faction={faction} striped={i % 2 === 1} />
        ))}
      </Box>
    </Stack>
  );
}

function Figure({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.3rem", fontWeight: 700,
                        lineHeight: 1, color: tone }}>
        {value}
      </Typography>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        {label.toUpperCase()}
      </Typography>
    </Stack>
  );
}
