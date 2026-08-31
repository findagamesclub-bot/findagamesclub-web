import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import GroupsIcon from "@mui/icons-material/Groups";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { mono, tokens, type Faction } from "@/lib/tokens";
import { formatMoney } from "@/utils/format";
import type { BuyableTicket } from "@/types/ticket";

/**
 * What the club sees where a buyer sees the ticket desk.
 *
 * An owner cannot sensibly add their own event's ticket to a basket and check
 * out to themselves, so they get the other half of the same information: what
 * is on sale, how each type is going, and the way to the door list.
 */
export default function TicketSalesBoard({
  tickets, faction, slug, eventKey, hasEnded, trail = "",
}: {
  tickets: BuyableTicket[];
  faction: Faction;
  slug: string;
  eventKey: string;
  hasEnded: boolean;
  /** Query string that keeps the door list's back link pointing home. */
  trail?: string;
}) {
  const sold = tickets.reduce((n, t) => n + t.sold, 0);
  const takings = tickets.reduce((n, t) => n + t.sold * t.unitAmount, 0);
  const capped = tickets.filter((t) => t.remaining !== null);
  const left = capped.reduce((n, t) => n + (t.remaining ?? 0), 0);

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <ConfirmationNumberIcon sx={{ fontSize: 18, color: tokens.brass }} />
        <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", letterSpacing: "0.14em",
                          color: tokens.inkMuted, fontWeight: 700 }}>
          YOUR TICKETS
        </Typography>
      </Stack>

      <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden",
                 backgroundColor: tokens.paper }}>
        <Stack direction="row" spacing={2.5} useFlexGap
          sx={{ flexWrap: "wrap", px: 2, py: 1.75, backgroundColor: tokens.surface,
                borderBottom: `1px solid ${tokens.rule}` }}>
          <Figure value={sold} label={sold === 1 ? "sold" : "sold"} />
          {capped.length ? <Figure value={left} label="left" /> : null}
          <Figure value={formatMoney(takings)} label="due" tone={tokens.brass} />
        </Stack>

        <Stack>
          {tickets.map((t, i) => (
            <Stack key={t.id} spacing={0.4}
              sx={{ px: 2, py: 1.5, borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}` }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline" }}>
                <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0,
                                                      fontFamily: "var(--font-display)" }}>
                  {t.label}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.9rem", fontWeight: 700 }}>
                  {t.price ?? "Free"}
                </Typography>
              </Stack>

              {t.audienceLabel ? (
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  {t.audienceLabel}
                </Typography>
              ) : null}

              <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", letterSpacing: "0.08em",
                                color: t.soldOut ? tokens.danger : tokens.inkMuted }}>
                {t.soldOut
                  ? `SOLD OUT · ${t.sold} GONE`
                  : t.remaining === null
                    ? `${t.sold} SOLD · NO LIMIT`
                    : `${t.sold} SOLD · ${t.remaining} LEFT`}
              </Typography>
            </Stack>
          ))}
        </Stack>

        {sold ? (
          <NextLink href={`/clubs/${slug}/events/${eventKey}/attendees${trail}`}
            style={{ textDecoration: "none", display: "block" }}>
            <Stack direction="row" spacing={0.5}
              sx={{ alignItems: "center", px: 2, py: 1.4,
                    borderTop: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface,
                    "&:hover": { backgroundColor: faction.soft } }}>
              <GroupsIcon sx={{ fontSize: 17, color: faction.deep }} />
              <Typography variant="body2" sx={{ color: faction.deep, fontWeight: 600, flex: 1 }}>
                Door list
              </Typography>
              <ChevronRightIcon sx={{ fontSize: 17, color: faction.deep }} />
            </Stack>
          </NextLink>
        ) : null}
      </Box>

      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        {hasEnded
          ? "This event has finished. Figures are the final reserved count."
          : "Figures count reserved bookings. Payment is taken before the event or on the day."}
      </Typography>
    </Stack>
  );
}

function Figure({ value, label, tone }: { value: number | string; label: string; tone?: string }) {
  return (
    <Stack direction="row" spacing={0.6} sx={{ alignItems: "baseline" }}>
      <Typography sx={{ fontFamily: mono, fontSize: "1.3rem", fontWeight: 700,
                        lineHeight: 1, color: tone ?? tokens.ink }}>
        {value}
      </Typography>
      <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", letterSpacing: "0.1em",
                        color: tokens.inkMuted }}>
        {label.toUpperCase()}
      </Typography>
    </Stack>
  );
}
