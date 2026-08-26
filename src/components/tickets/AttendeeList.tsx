import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatMoney } from "@/utils/format";
import { initialsOf } from "@/utils/format";
import { tokens, type Faction } from "@/lib/tokens";

type Attendee = {
  id: number;
  reference: string;
  fullName: string;
  email: string;
  total: number;
  currency: string;
  tickets: number;
  summary: string;
};

/**
 * The door list, for the club.
 *
 * Sorted by name rather than by when they booked: on the day this gets read
 * by somebody looking up the person standing in front of them.
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

  const sorted = [...attendees].sort((a, b) => a.fullName.localeCompare(b.fullName));
  const seats = sorted.reduce((n, a) => n + a.tickets, 0);
  const takings = sorted.reduce((n, a) => n + a.total, 0);
  const currency = sorted[0]?.currency ?? "GBP";

  return (
    <Stack spacing={2}>
      {figures ? (
        <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: "wrap", alignItems: "baseline" }}>
          <Figure value={String(sorted.length)} label={sorted.length === 1 ? "booking" : "bookings"} />
          <Figure value={String(seats)} label={seats === 1 ? "ticket" : "tickets"} />
          <Figure value={formatMoney(takings, currency)} label="due on the day" tone={tokens.brass} />
        </Stack>
      ) : null}

      <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
        {sorted.map((a, i) => (
          <Stack key={a.id} direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.75, sm: 2 }}
            sx={{ px: 2, py: 1.5, alignItems: { sm: "center" }, justifyContent: "space-between",
                  borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}`,
                  backgroundColor: i % 2 ? tokens.surface : tokens.paper }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
              <Box sx={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                         display: "grid", placeItems: "center",
                         backgroundColor: faction.soft, color: faction.deep }}>
                <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700,
                                  fontSize: "0.78rem" }}>
                  {initialsOf(a.fullName)}
                </Typography>
              </Box>
              <Stack spacing={0} sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontFamily: "var(--font-display)" }}>
                  {a.fullName}
                </Typography>
                <Typography variant="body2" sx={{ color: tokens.inkMuted, overflow: "hidden",
                                                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.email}
                </Typography>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={2}
              sx={{ alignItems: "baseline", flexShrink: 0, pl: { xs: 6, sm: 0 } }}>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>{a.summary}</Typography>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                                letterSpacing: "0.06em", color: tokens.inkMuted }}>
                {a.reference}
              </Typography>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", fontWeight: 600 }}>
                {formatMoney(a.total, a.currency)}
              </Typography>
            </Stack>
          </Stack>
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
