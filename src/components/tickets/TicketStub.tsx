import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatMoney } from "@/utils/format";
import { nightLabel } from "@/utils/dates";
import { tokens, type Faction } from "@/lib/tokens";
import type { EventBooking } from "@/types/ticket";

/**
 * The booking, drawn as a ticket.
 *
 * A table of totals would carry the same facts, but this is the artefact people
 * screenshot and show on the door, so it is worth it being a ticket — notched
 * edge, torn perforation, reference set large enough to read across a hall.
 */
export default function TicketStub({
  booking, faction, monogram,
}: {
  booking: EventBooking;
  faction: Faction;
  monogram: string;
}) {
  const cancelled = booking.status === "cancelled";
  const count = booking.lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: 2,
        overflow: "hidden",
        border: `1px solid ${tokens.rule}`,
        backgroundColor: tokens.paper,
        opacity: cancelled ? 0.72 : 1,
        boxShadow: "0 2px 14px rgba(16,27,45,0.07)",
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        sx={{
          px: { xs: 2, sm: 3 }, py: 2.25,
          alignItems: "center",
          background: `linear-gradient(135deg, ${faction.deep} 0%, ${faction.base} 100%)`,
        }}
      >
        <Box sx={{ width: 44, height: 44, borderRadius: 1, flexShrink: 0,
                   display: "grid", placeItems: "center",
                   border: "1px solid rgba(255,255,255,.45)",
                   backgroundColor: "rgba(255,255,255,.12)" }}>
          <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 800,
                            color: "#fff", fontSize: "1rem", letterSpacing: "0.02em" }}>
            {monogram}
          </Typography>
        </Box>

        <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                            letterSpacing: "0.12em", color: "rgba(255,255,255,.78)" }}>
            {booking.clubName.toUpperCase()}
          </Typography>
          <Typography variant="h3" sx={{ fontSize: { xs: "1.15rem", sm: "1.35rem" },
                                         color: "#fff", lineHeight: 1.2 }}>
            {booking.eventTitle}
          </Typography>
        </Stack>

        {cancelled ? (
          <Chip size="small" label="Cancelled"
            sx={{ bgcolor: "rgba(255,255,255,.92)", color: tokens.danger, fontWeight: 700 }} />
        ) : null}
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={0}>
        <Box sx={{ flex: 1, p: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={1.75}>
            <Fact label="When" value={
              booking.eventDate ? nightLabel(booking.eventDate) : "To be confirmed"
            } />
            <Fact label="Name" value={booking.fullName} />

            <Stack spacing={0.5}>
              <Label>Tickets</Label>
              {booking.lines.map((line) => (
                <Stack key={`${line.ticketTypeId}-${line.label}`} direction="row" spacing={2}
                  sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
                  <Typography variant="body2">
                    <Box component="span" sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                                                color: faction.deep, mr: 0.75 }}>
                      {line.quantity}&times;
                    </Box>
                    {line.label}
                  </Typography>
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                    {formatMoney(line.lineTotal, booking.currency)}
                  </Typography>
                </Stack>
              ))}
            </Stack>

            {booking.discountAmount > 0 ? (
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: tokens.positive }}>Member discount</Typography>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem",
                                  color: tokens.positive }}>
                  − {formatMoney(booking.discountAmount, booking.currency)}
                </Typography>
              </Stack>
            ) : null}
          </Stack>
        </Box>

        {/* The tear. Notches at both ends of a dashed rule, so the stub reads as
            a stub rather than as a second panel that happens to be beside it. */}
        <Box sx={{ position: "relative", flexShrink: 0,
                   width: { xs: "100%", sm: 0 }, height: { xs: 0, sm: "auto" },
                   borderLeft: { sm: `2px dashed ${tokens.rule}` },
                   borderTop: { xs: `2px dashed ${tokens.rule}`, sm: "none" } }}>
          <Notch sx={{ top: { xs: -9, sm: -9 }, left: { xs: -9, sm: -9 } }} />
          <Notch sx={{ bottom: { xs: -9, sm: -9 }, right: { xs: -9, sm: -9 } }} />
        </Box>

        <Stack spacing={0.75}
          sx={{ flex: { sm: "0 0 190px" }, p: { xs: 2, sm: 2.5 },
                backgroundColor: tokens.surface, justifyContent: "center" }}>
          <Label>Reference</Label>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                            fontSize: { xs: "1.3rem", sm: "1.15rem" }, letterSpacing: "0.04em",
                            lineHeight: 1.2, wordBreak: "break-all" }}>
            {booking.reference}
          </Typography>

          <Box sx={{ pt: 1, mt: 0.5, borderTop: `1px solid ${tokens.rule}` }}>
            <Label>{count === 1 ? "1 ticket · total" : `${count} tickets · total`}</Label>
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.45rem", fontWeight: 700,
                              textDecoration: cancelled ? "line-through" : "none" }}>
              {formatMoney(booking.total, booking.currency)}
            </Typography>
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                      letterSpacing: "0.12em", color: tokens.inkMuted }}>
      {String(children).toUpperCase()}
    </Typography>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.25}>
      <Label>{label}</Label>
      <Typography variant="body1" sx={{ lineHeight: 1.3 }}>{value}</Typography>
    </Stack>
  );
}

function Notch({ sx }: { sx: object }) {
  return (
    <Box sx={{ position: "absolute", width: 18, height: 18, borderRadius: "50%",
               backgroundColor: tokens.surface, border: `1px solid ${tokens.rule}`,
               display: { xs: "none", sm: "block" }, ...sx }} />
  );
}
