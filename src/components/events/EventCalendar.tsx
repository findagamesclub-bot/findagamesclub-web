import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { mono, tokens } from "@/lib/tokens";
import { clubIdentity } from "@/utils/club-identity";
import { monthYear } from "@/utils/dates";
import type { EventSummary } from "@/types/eventList";

/**
 * One month of events, chosen at the top.
 *
 * Stacking every month vertically meant scrolling past three of them to reach
 * the one you wanted, so the month is a choice: arrows for the next and last,
 * and a chip per month that actually has something on. The chips matter more
 * than the arrows here, because a directory's events cluster rather than spread
 * evenly, and clicking through empty months to find them is the tedious part.
 *
 * A real grid, ruled on every cell, with the neighbouring months filling the
 * corners — a calendar with holes at each end is not one.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday-first, which is how a UK club week is read. */
function mondayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

function shiftMonth(key: string, by: number): string {
  const [year, month] = key.split("-").map(Number);
  const d = new Date(Date.UTC(year!, month! - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

type Cell = { date: string; day: number; inMonth: boolean };

function buildMonth(key: string): Cell[] {
  const [year, month] = key.split("-").map(Number);
  const lead = mondayIndex(new Date(Date.UTC(year!, month! - 1, 1)));
  const cells: Cell[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(year!, month! - 1, 1 - lead + i));
    cells.push({
      date: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month! - 1,
    });
  }

  // Only show a sixth row when the month needs one.
  return cells.slice(0, cells.slice(35).every((c) => !c.inMonth) ? 35 : 42);
}

export default function EventCalendar({
  events, today, month, monthHref, trail = "",
}: {
  events: EventSummary[];
  today: string;
  /** The month on screen, YYYY-MM. */
  month: string;
  /** Builds a link to another month, so navigation lives in the URL. */
  monthHref: (month: string) => string;
  /** Query string that sends an event's back arrow to this search. */
  trail?: string;
}) {
  const dated = events.filter((e) => e.startDate);

  const byDate = new Map<string, EventSummary[]>();
  for (const event of dated) {
    byDate.set(event.startDate!, [...(byDate.get(event.startDate!) ?? []), event]);
  }

  const months = [...new Set(dated.map((e) => e.startDate!.slice(0, 7)))].sort();
  const cells = buildMonth(month);
  const count = dated.filter((e) => e.startDate!.startsWith(month)).length;
  const thisMonth = today.slice(0, 7);

  const arrow = (to: string, label: string, Icon: typeof ChevronLeftIcon) => (
    <NextLink href={monthHref(to)} aria-label={label} style={{ textDecoration: "none" }}>
      <Box sx={{ width: 34, height: 34, display: "grid", placeItems: "center",
                 borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
                 color: tokens.ink, bgcolor: tokens.paper,
                 "&:hover": { borderColor: tokens.ink } }}>
        <Icon sx={{ fontSize: 20 }} />
      </Box>
    </NextLink>
  );

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}
        sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          {arrow(shiftMonth(month, -1), "Previous month", ChevronLeftIcon)}
          {arrow(shiftMonth(month, 1), "Next month", ChevronRightIcon)}
          <Typography sx={{ fontFamily: mono, fontSize: "1rem", fontWeight: 600,
                            letterSpacing: "0.08em", ml: 1 }}>
            {monthYear(`${month}-01`)?.toUpperCase()}
          </Typography>
          <Typography sx={{ fontFamily: mono, fontSize: "0.78rem", color: tokens.inkMuted, ml: 1 }}>
            {count} {count === 1 ? "event" : "events"}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          {month !== thisMonth ? (
            <NextLink href={monthHref(thisMonth)} style={{ textDecoration: "none" }}>
              <Chip size="small" clickable label="Today" variant="outlined"
                sx={{ borderColor: tokens.rule, fontWeight: 600 }} />
            </NextLink>
          ) : null}
          {months.map((m) => (
            <NextLink key={m} href={monthHref(m)} style={{ textDecoration: "none" }}>
              <Chip
                size="small"
                clickable
                label={monthYear(`${m}-01`)}
                variant={m === month ? "filled" : "outlined"}
                sx={m === month
                  ? { bgcolor: tokens.ink, color: "#fff", fontWeight: 600 }
                  : { borderColor: tokens.rule }}
              />
            </NextLink>
          ))}
        </Stack>
      </Stack>

      <Box sx={{ borderRadius: 2, overflow: "hidden", border: `1px solid ${tokens.rule}`,
                 bgcolor: tokens.paper }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", bgcolor: tokens.surface }}>
          {WEEKDAYS.map((d) => (
            <Typography key={d}
              sx={{ fontFamily: mono, fontSize: "0.66rem", letterSpacing: "0.1em",
                    color: tokens.inkMuted, textAlign: "center", py: 1,
                    borderBottom: `1px solid ${tokens.rule}` }}>
              {d.toUpperCase()}
            </Typography>
          ))}
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          {cells.map((cell, i) => {
            const onThisDay = byDate.get(cell.date) ?? [];
            const isToday = cell.date === today;
            const isWeekend = i % 7 >= 5;

            return (
              <Stack
                key={cell.date}
                spacing={0.75}
                sx={{
                  // Tall enough for a card that says time, title and club.
                  // A one-line chip fitted, but only told you something was on.
                  minHeight: { xs: 96, md: 148 },
                  p: 1,
                  borderRight: (i + 1) % 7 === 0 ? "none" : `1px solid ${tokens.rule}`,
                  borderBottom: i >= cells.length - 7 ? "none" : `1px solid ${tokens.rule}`,
                  bgcolor: !cell.inMonth ? "#FBFCFD" : isWeekend ? tokens.surface : tokens.paper,
                }}
              >
                <Stack direction="row" spacing={0.75}
                  sx={{ alignItems: "center", justifyContent: "space-between" }}>
                  <Box sx={{
                    minWidth: 26, height: 26, px: 0.625,
                    display: "grid", placeItems: "center", borderRadius: "50%",
                    bgcolor: isToday ? tokens.brass : "transparent",
                    color: isToday ? "#FFFFFF" : cell.inMonth ? tokens.ink : "#C3CDDA",
                    fontFamily: mono, fontSize: "0.88rem",
                    fontWeight: isToday || onThisDay.length ? 700 : 500,
                  }}>
                    {cell.day}
                  </Box>

                  {onThisDay.length > 1 ? (
                    <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                      letterSpacing: "0.04em", px: 0.75, py: 0.25,
                                      borderRadius: 999, bgcolor: tokens.surface,
                                      color: tokens.inkMuted, whiteSpace: "nowrap" }}>
                      {onThisDay.length} events
                    </Typography>
                  ) : null}
                </Stack>

                {onThisDay.map((event) => {
                  const { faction } = clubIdentity(event.club.slug, event.club.name);
                  return (
                    <NextLink
                      key={event.id}
                      href={`/clubs/${event.club.slug}/events/${event.legacyId}${trail}`}
                      style={{ textDecoration: "none", display: "block" }}
                    >
                      {/* Past events are not greyed out. Each tab is already all
                          past or all upcoming, so muting them washed out a whole
                          month to make a distinction the tab had made already. */}
                      <Stack
                        spacing={0.125}
                        sx={{
                          px: 1, py: 0.875, borderRadius: 1,
                          borderLeft: `3px solid ${faction.base}`,
                          bgcolor: faction.soft,
                          transition: "background-color 120ms ease",
                          "&:hover": {
                            bgcolor: faction.base,
                            "& *": { color: "#FFFFFF !important" },
                          },
                        }}
                      >
                        <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", fontWeight: 700,
                                          letterSpacing: "0.04em", color: faction.base }}>
                          {event.startTime ?? "TIME TBC"}
                        </Typography>

                        {/* Wraps to two lines rather than truncating. Ink, not the
                            club colour: the title has to read first, and the colour
                            is already carrying identity in the rule and the ground. */}
                        <Typography sx={{
                          fontFamily: "var(--font-display)", fontSize: "0.76rem",
                          fontWeight: 700, lineHeight: 1.25, color: tokens.ink,
                          display: "-webkit-box", WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>
                          {event.title}
                        </Typography>

                        <Typography sx={{
                          fontSize: "0.68rem", lineHeight: 1.3, color: faction.deep,
                          display: "-webkit-box", WebkitLineClamp: 1,
                          WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>
                          {event.club.name}
                        </Typography>
                      </Stack>
                    </NextLink>
                  );
                })}
              </Stack>
            );
          })}
        </Box>
      </Box>
    </Stack>
  );
}
