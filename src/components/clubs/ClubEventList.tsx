import Box from "@mui/material/Box";
import NextLink from "next/link";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import ScheduleIcon from "@mui/icons-material/Schedule";
import PlaceIcon from "@mui/icons-material/Place";
import GroupsIcon from "@mui/icons-material/Groups";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { mono, tokens } from "@/lib/tokens";
import { ticketsLeft } from "@/utils/tickets-left";
import { formatMoney } from "@/utils/format";
import type { EventSales } from "@/services/eventBookings.service";
import type { ClubEventSummary } from "@/types/clubDetail";

/** Day and month split out so the card can stack them as a calendar tile. */
function dateParts(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // timeZone: UTC on purpose. A club date is a calendar date, and without this
  // anyone west of Greenwich sees the day before on the tile.
  const opts = { timeZone: "UTC" } as const;
  return {
    day: d.toLocaleDateString("en-GB", { ...opts, day: "numeric" }),
    month: d.toLocaleDateString("en-GB", { ...opts, month: "short" }).toUpperCase(),
    weekday: d.toLocaleDateString("en-GB", { ...opts, weekday: "short" }),
    year: d.getUTCFullYear(),
  };
}

function Tag({ label, tone = "quiet" }: { label: string; tone?: "quiet" | "sold" }) {
  return (
    <Box
      component="span"
      sx={{
        fontFamily: "var(--font-display)",
        fontSize: "0.78rem",
        fontWeight: 600,
        lineHeight: 1.2,
        px: 0.875,
        py: 0.5,
        borderRadius: "3px",
        ...(tone === "sold"
          ? { backgroundColor: "#F7E4E4", color: "#7A1F20" }
          : { backgroundColor: tokens.surface, color: tokens.inkMuted, border: `1px solid ${tokens.rule}` }),
      }}
    >
      {label}
    </Box>
  );
}

export default function ClubEventList({
  events,
  clubSlug,
  sales,
  trail = "",
  clubVenue,
}: {
  events: ClubEventSummary[];
  clubSlug: string;
  /** Falls back to this when the event does not name a venue of its own. */
  clubVenue?: { name: string | null; postcode: string | null };
  /** Only the club gets this. Absent means "not my club", not "nothing sold". */
  sales?: Map<number, EventSales>;
  /** Query string marking where these links were followed from. */
  trail?: string;
}) {
  return (
    <Stack spacing={1.5}>
      {events.map((event) => {
        const date = dateParts(event.startDate);
        const spansDays = Boolean(
          event.endDate && event.startDate && event.endDate !== event.startDate,
        );
        const endDate = spansDays ? dateParts(event.endDate) : null;
        const tickets = ticketsLeft(event.ticketsAvailable, true);

        // An event usually runs at the club's own hall, so an empty venue means
        // "here" rather than "unknown". Saying nothing left somebody unable to
        // tell a home night from one across the county.
        const place = [
          event.venue.name || clubVenue?.name,
          event.venue.postcode || (event.venue.name ? null : clubVenue?.postcode),
        ].filter(Boolean).join(" · ");
        const sold = sales?.get(event.id);

        return (
          <Card
            key={event.id}
            sx={{
              overflow: "hidden",
              transition: "border-color 120ms ease",
              "&:hover": { borderColor: tokens.brass },
            }}
          >
            <NextLink href={`/clubs/${clubSlug}/events/${event.slug}${trail}`}
              style={{ color: "inherit", textDecoration: "none", display: "block" }}>
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
              <Stack direction="row" sx={{ alignItems: "stretch" }}>
                {/* Calendar tile. A date read as a figure is faster than one
                    read as a sentence at the end of a line. */}
                <Box
                  sx={{
                    flexShrink: 0,
                    width: { xs: 68, sm: 80 },
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.125,
                    py: 2,
                    backgroundColor: tokens.ink,
                    color: "#FFFFFF",
                  }}
                >
                  {date ? (
                    <>
                      <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", color: tokens.brassOnDark, letterSpacing: "0.1em" }}>
                        {date.weekday.toUpperCase()}
                      </Typography>
                      <Typography sx={{ fontFamily: mono, fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.1 }}>
                        {date.day}
                      </Typography>
                      <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", letterSpacing: "0.08em", color: "#B9C9DD" }}>
                        {date.month}
                      </Typography>
                      {endDate ? (
                        <>
                          <Box aria-hidden sx={{ width: 16, height: "1px", my: 0.5,
                                                 bgcolor: "rgba(255,255,255,0.45)" }} />
                          <Typography sx={{ fontFamily: mono, fontSize: "1.15rem", fontWeight: 600, lineHeight: 1.1 }}>
                            {endDate.day}
                          </Typography>
                          <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                            letterSpacing: "0.08em", color: "#B9C9DD" }}>
                            {endDate.month}
                          </Typography>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: "#B9C9DD", textAlign: "center", px: 1 }}>
                      Date TBC
                    </Typography>
                  )}
                </Box>

                <Stack spacing={1} sx={{ flex: 1, minWidth: 0, p: 2.5 }}>
                  <Typography variant="h4">{event.title}</Typography>

                  <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                    {event.startTime ? (
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <ScheduleIcon aria-hidden sx={{ fontSize: 15, color: tokens.brass }} />
                        <Typography sx={{ fontFamily: mono, fontSize: "0.85rem", color: "text.secondary" }}>
                          {event.startTime}
                          {event.endTime ? ` \u2013 ${event.endTime}` : ""}
                        </Typography>
                      </Stack>
                    ) : null}
                    {event.price ? (
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <ConfirmationNumberIcon aria-hidden sx={{ fontSize: 15, color: tokens.brass }} />
                        <Typography sx={{ fontFamily: mono, fontSize: "0.85rem", color: "text.secondary" }}>
                          {event.price}
                        </Typography>
                      </Stack>
                    ) : null}
                  </Stack>

                  {place ? (
                    <Stack direction="row" spacing={0.6} sx={{ alignItems: "flex-start" }}>
                      <PlaceIcon aria-hidden
                        sx={{ fontSize: 15, color: tokens.brass, mt: 0.25, flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ color: "text.secondary", minWidth: 0 }}>
                        {place}
                      </Typography>
                    </Stack>
                  ) : null}

                  {event.summary ? (
                    <Typography variant="body2" color="text.secondary">{event.summary}</Typography>
                  ) : null}

                  <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap", pt: 0.25 }}>
                    {event.eventType ? <Tag label={event.eventType} /> : null}
                    {event.roundCount ? <Tag label={`${event.roundCount} rounds`} /> : null}
                    {tickets ? (
                      <Tag label={tickets.label} tone={tickets.soldOut ? "sold" : "quiet"} />
                    ) : null}
                  </Stack>
                </Stack>
              </Stack>
            </CardContent>
            </NextLink>

            {sales ? (
              <Stack direction="row" spacing={2} useFlexGap
                sx={{ flexWrap: "wrap", alignItems: "center", px: 2.5, py: 1.25,
                      borderTop: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>
                {sold ? (
                  <>
                    <Sold value={sold.bookings} label={sold.bookings === 1 ? "booking" : "bookings"} />
                    <Sold value={sold.tickets} label={sold.tickets === 1 ? "ticket" : "tickets"} />
                    <Sold value={formatMoney(sold.due)} label="due" tone={tokens.brass} />
                  </>
                ) : (
                  <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                    Nobody has booked yet.
                  </Typography>
                )}

                {sold ? (
                  <NextLink href={`/clubs/${clubSlug}/events/${event.slug}/attendees${trail}`}
                    style={{ textDecoration: "none", marginLeft: "auto" }}>
                    <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
                      <GroupsIcon sx={{ fontSize: 16, color: tokens.brand }} />
                      <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                        Door list
                      </Typography>
                      <ChevronRightIcon sx={{ fontSize: 16, color: tokens.brand }} />
                    </Stack>
                  </NextLink>
                ) : null}
              </Stack>
            ) : null}
          </Card>
        );
      })}
    </Stack>
  );
}

/** One figure in the club's own strip under an event. */
function Sold({ value, label, tone }: { value: number | string; label: string; tone?: string }) {
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
