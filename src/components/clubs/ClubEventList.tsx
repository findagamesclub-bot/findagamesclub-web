import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { mono, tokens } from "@/lib/tokens";
import type { ClubEventSummary } from "@/types/clubDetail";

/** Day and month split out so the card can stack them as a calendar tile. */
function dateParts(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: d.toLocaleDateString("en-GB", { day: "numeric" }),
    month: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(),
    weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
    year: d.getFullYear(),
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

export default function ClubEventList({ events }: { events: ClubEventSummary[] }) {
  return (
    <Stack spacing={1.5}>
      {events.map((event) => {
        const date = dateParts(event.startDate);
        const soldOut = event.ticketsAvailable === 0;

        return (
          <Card key={event.id} sx={{ overflow: "hidden" }}>
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

                  {event.summary ? (
                    <Typography variant="body2" color="text.secondary">{event.summary}</Typography>
                  ) : null}

                  <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap", pt: 0.25 }}>
                    {event.eventType ? <Tag label={event.eventType} /> : null}
                    {event.roundCount ? <Tag label={`${event.roundCount} rounds`} /> : null}
                    {event.ticketsAvailable != null ? (
                      <Tag
                        label={soldOut ? "Sold out" : `${event.ticketsAvailable} tickets left`}
                        tone={soldOut ? "sold" : "quiet"}
                      />
                    ) : null}
                  </Stack>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
