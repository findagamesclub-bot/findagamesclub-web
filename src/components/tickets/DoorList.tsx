"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import { formatMoney, initialsOf } from "@/utils/format";
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
 * The door list, built for the door.
 *
 * A hundred names is a wall, and the job on the day is not reading it — it is
 * finding one person who is standing in front of you. So it leads with a search
 * that matches a name, an email or a reference, and the row stays dense enough
 * that a filtered list is one glance.
 */
export default function DoorList({
  attendees, faction,
}: {
  attendees: Attendee[];
  faction: Faction;
}) {
  const [term, setTerm] = useState("");

  const sorted = useMemo(
    () => [...attendees].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [attendees],
  );

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((a) =>
      a.fullName.toLowerCase().includes(needle)
      || a.email.toLowerCase().includes(needle)
      || a.reference.toLowerCase().includes(needle));
  }, [sorted, term]);

  const seats = sorted.reduce((n, a) => n + a.tickets, 0);
  const takings = sorted.reduce((n, a) => n + a.total, 0);
  const currency = sorted[0]?.currency ?? "GBP";

  if (!sorted.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Nobody has booked yet. Names appear here the moment they do.
      </Typography>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: "wrap", alignItems: "baseline" }}>
        <Figure value={String(sorted.length)} label={sorted.length === 1 ? "booking" : "bookings"} />
        <Figure value={String(seats)} label={seats === 1 ? "ticket" : "tickets"} />
        <Figure value={formatMoney(takings, currency)} label="to pay" tone={tokens.brass} />
      </Stack>

      {/* Only worth the space once the list is long enough to need it. */}
      {sorted.length >= 8 ? (
        <TextField
          fullWidth size="small" placeholder="Find a name, email or reference"
          value={term} onChange={(e) => setTerm(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: tokens.inkMuted }} />
                </InputAdornment>
              ),
            },
          }}
          helperText={term ? `${shown.length} of ${sorted.length}` : undefined}
        />
      ) : null}

      <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
        {shown.map((a, i) => (
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

            <Stack direction="row" spacing={2} sx={{ alignItems: "baseline", flexShrink: 0,
                                                     pl: { xs: 6, sm: 0 } }}>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>{a.summary}</Typography>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                                letterSpacing: "0.06em", color: tokens.inkMuted }}>
                {a.reference}
              </Typography>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", fontWeight: 700 }}>
                {formatMoney(a.total, a.currency)}
              </Typography>
            </Stack>
          </Stack>
        ))}

        {shown.length === 0 ? (
          <Typography variant="body2" sx={{ px: 2, py: 2.5, color: tokens.inkMuted }}>
            Nobody by that name, email or reference.
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

function Figure({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.4rem", fontWeight: 700,
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
