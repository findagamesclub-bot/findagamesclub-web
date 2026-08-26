import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import GroupsIcon from "@mui/icons-material/Groups";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { mono, tokens } from "@/lib/tokens";
import { clubIdentity } from "@/utils/club-identity";
import { formatMoney } from "@/utils/format";
import { FROM_MY_EVENTS } from "@/utils/back-link";
import type { OwnerEvent } from "@/services/ownerEvents.service";

/** Day and month split out so the tile reads as a date, not a sentence. */
function dateParts(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // UTC on purpose: a club date is a calendar date, and without this anyone
  // west of Greenwich sees the day before.
  const opts = { timeZone: "UTC" } as const;
  return {
    day: d.toLocaleDateString("en-GB", { ...opts, day: "numeric" }),
    month: d.toLocaleDateString("en-GB", { ...opts, month: "short" }).toUpperCase(),
    weekday: d.toLocaleDateString("en-GB", { ...opts, weekday: "short" }).toUpperCase(),
  };
}

/**
 * One event across the clubs somebody runs.
 *
 * The club is named on every row because this list interleaves four clubs by
 * date — without it "Autumn Open" on the 26th tells you nothing about where to
 * be. Its colour comes from the same hash the directory uses, so an owner
 * learns to skim by it.
 */
export default function OwnerEventRow({ event }: { event: OwnerEvent }) {
  const { faction, monogram } = clubIdentity(event.club.slug, event.club.name);
  const date = dateParts(event.startDate);
  const href = `/clubs/${event.club.slug}/events/${event.slug}`;
  // Both ways out of this row lead back to My events, not to the club page.
  const sold = event.sales;

  return (
    <Card sx={{ overflow: "hidden", transition: "border-color 120ms ease",
                "&:hover": { borderColor: faction.base } }}>
      <NextLink href={`${href}${FROM_MY_EVENTS}`}
        style={{ color: "inherit", textDecoration: "none", display: "block" }}>
        <Stack direction="row" sx={{ alignItems: "stretch" }}>
          <Stack sx={{ flexShrink: 0, width: { xs: 66, sm: 78 }, py: 1.75, gap: 0.125,
                       alignItems: "center", justifyContent: "center",
                       backgroundColor: tokens.ink, color: "#FFFFFF" }}>
            {date ? (
              <>
                <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                                  letterSpacing: "0.1em", color: tokens.brassOnDark }}>
                  {date.weekday}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "1.45rem", fontWeight: 600, lineHeight: 1.1 }}>
                  {date.day}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                  letterSpacing: "0.08em", color: "#B9C9DD" }}>
                  {date.month}
                </Typography>
              </>
            ) : (
              <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", color: "#B9C9DD",
                                textAlign: "center", px: 1 }}>
                Date TBC
              </Typography>
            )}
          </Stack>

          <Stack spacing={0.6} sx={{ flex: 1, minWidth: 0, p: 2 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 18, height: 18, borderRadius: 0.5, flexShrink: 0,
                         display: "grid", placeItems: "center", backgroundColor: faction.base }}>
                <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 800,
                                  fontSize: "0.52rem", color: "#fff", lineHeight: 1 }}>
                  {monogram}
                </Typography>
              </Box>
              <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", letterSpacing: "0.09em",
                                color: faction.deep, overflow: "hidden",
                                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {event.club.name.toUpperCase()}
              </Typography>
            </Stack>

            <Typography variant="h4" sx={{ fontSize: "1.05rem" }}>{event.title}</Typography>

            {event.startTime ? (
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <ScheduleIcon aria-hidden sx={{ fontSize: 14, color: tokens.brass }} />
                <Typography sx={{ fontFamily: mono, fontSize: "0.8rem", color: "text.secondary" }}>
                  {event.startTime}
                </Typography>
              </Stack>
            ) : null}
          </Stack>
        </Stack>
      </NextLink>

      {/* Outside the card-wide link: a link inside a link is invalid, and the
          browser picks one of them for you. */}
      <Stack direction="row" spacing={2} useFlexGap
        sx={{ flexWrap: "wrap", alignItems: "center", px: 2, py: 1.15,
              borderTop: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>
        {sold ? (
          <>
            <Figure value={sold.bookings} label={sold.bookings === 1 ? "booking" : "bookings"} />
            <Figure value={sold.tickets} label={sold.tickets === 1 ? "ticket" : "tickets"} />
            <Figure value={formatMoney(sold.due)} label="due" tone={tokens.brass} />
            <NextLink href={`${href}/attendees${FROM_MY_EVENTS}`}
              style={{ textDecoration: "none", marginLeft: "auto" }}>
              <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
                <GroupsIcon sx={{ fontSize: 16, color: tokens.brand }} />
                <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                  Door list
                </Typography>
                <ChevronRightIcon sx={{ fontSize: 16, color: tokens.brand }} />
              </Stack>
            </NextLink>
          </>
        ) : (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Nobody has booked yet.
          </Typography>
        )}
      </Stack>
    </Card>
  );
}

function Figure({ value, label, tone }: { value: number | string; label: string; tone?: string }) {
  return (
    <Stack direction="row" spacing={0.6} sx={{ alignItems: "baseline" }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.95rem", fontWeight: 700,
                        lineHeight: 1, color: tone ?? tokens.ink }}>
        {value}
      </Typography>
      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", letterSpacing: "0.1em",
                        color: tokens.inkMuted }}>
        {label.toUpperCase()}
      </Typography>
    </Stack>
  );
}
