import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatMoney, initialsOf } from "@/utils/format";
import { shortDate } from "@/utils/dates";
import { tokens, type Faction } from "@/lib/tokens";
import type { Attendee } from "@/utils/attendee-filter";

/**
 * One booking on the door list.
 *
 * The date earns its place: somebody who books six times appears six times,
 * and without it the rows are identical apart from a reference nobody has
 * memorised. It is the first thing a club looks for when checking whether the
 * booking they were just told about is the one in front of them.
 */
export default function AttendeeRow({
  attendee, faction, striped,
}: {
  attendee: Attendee;
  faction: Faction;
  striped: boolean;
}) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.75, sm: 2 }}
      sx={{ px: 2, py: 1.5, alignItems: { sm: "center" }, justifyContent: "space-between",
            backgroundColor: striped ? tokens.surface : tokens.paper }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                   display: "grid", placeItems: "center",
                   backgroundColor: faction.soft, color: faction.deep }}>
          <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700,
                            fontSize: "0.78rem" }}>
            {initialsOf(attendee.fullName)}
          </Typography>
        </Box>
        <Stack spacing={0} sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontFamily: "var(--font-display)" }}>
            {attendee.fullName}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.inkMuted, overflow: "hidden",
                                            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {attendee.email}
          </Typography>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2}
        sx={{ alignItems: "baseline", flexShrink: 0, pl: { xs: 6, sm: 0 } }}>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>{attendee.summary}</Typography>
        <Stack spacing={0} sx={{ alignItems: { sm: "flex-end" } }}>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                            letterSpacing: "0.06em", color: tokens.inkMuted }}>
            {attendee.reference}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                            color: tokens.inkMuted }}>
            {`BOOKED ${(shortDate(attendee.createdAt) ?? "").toUpperCase()}`}
          </Typography>
        </Stack>
        <Typography sx={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
                          fontSize: "0.9rem", fontWeight: 600, minWidth: 62,
                          textAlign: "right" }}>
          {formatMoney(attendee.total, attendee.currency)}
        </Typography>
      </Stack>
    </Stack>
  );
}
