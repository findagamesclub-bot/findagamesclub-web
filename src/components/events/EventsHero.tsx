import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { clubIdentity } from "@/utils/club-identity";
import { nightLabel } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";
import type { EventSummary } from "@/types/eventList";

type Props = {
  /** Everything, not the filtered view — these counts describe what is on offer. */
  events: EventSummary[];
  upcomingCount: number;
  pastCount: number;
};

/**
 * Events hero.
 *
 * Shares the directory's dark battle-mat ground so the two pages read as one
 * product, but not its club mosaic — repeating that would make Events look like
 * Directory with different words. The object here is a fixture strip: the next
 * few dates as tiles, which is what an events page is actually about.
 */
export default function EventsHero({ events, upcomingCount, pastCount }: Props) {
  // Upcoming first, then topped up with the most recent, so the strip is a
  // strip rather than one tile marooned in the corner. A directory with a
  // single event coming up still has a history worth showing.
  const dated = events.filter((e) => e.startDate);
  const upcoming = dated.filter((e) => !e.hasEnded);
  const recent = dated.filter((e) => e.hasEnded)
    .sort((a, b) => b.startDate!.localeCompare(a.startDate!));
  const strip = [...upcoming, ...recent].slice(0, 4);

  const clubs = new Set(events.map((e) => e.club.slug)).size;

  const stats: [string, string][] = [
    [String(upcomingCount), upcomingCount === 1 ? "coming up" : "coming up"],
    [String(pastCount), "already run"],
    [String(clubs), clubs === 1 ? "club" : "clubs"],
  ];

  return (
    <Box
      sx={{
        backgroundColor: tokens.ink,
        color: "#FFFFFF",
        backgroundImage: `
          repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 44px),
          repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 44px)`,
        borderBottom: `2px solid ${tokens.brassOnDark}`,
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 4, md: 6 }}
          sx={{ alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between" }}
        >
          <Stack spacing={2} sx={{ maxWidth: 620 }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.88rem", letterSpacing: "0.16em",
                              textTransform: "uppercase", color: tokens.brassOnDark }}>
              What is on
            </Typography>

            <Typography variant="h1" sx={{ color: "#FFFFFF" }}>
              Tournaments, leagues and club nights
            </Typography>

            <Typography sx={{ color: "#B9C9DD", maxWidth: 560, lineHeight: 1.6 }}>
              Every event the clubs are running, and every one they have already run.
              Finished tournaments keep their results and the armies people brought.
            </Typography>

            <Stack
              direction="row"
              sx={{ pt: 0.5, border: `1px solid rgba(255,255,255,0.16)`,
                    borderRadius: "3px", alignSelf: "flex-start", py: 0 }}
            >
              {stats.map(([value, label], i) => (
                <Stack key={label} spacing={0.25}
                  sx={{ px: { xs: 2, sm: 2.5 }, py: 1.25,
                        borderLeft: i === 0 ? "none" : `1px solid ${tokens.brassOnDark}33` }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "1.5rem", fontWeight: 600,
                                    lineHeight: 1, color: "#FFFFFF" }}>
                    {value}
                  </Typography>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", letterSpacing: "0.12em",
                                    textTransform: "uppercase", color: "#B9C9DD" }}>
                    {label}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>

          {/* A fixture strip: the dates themselves, torn off like tickets. */}
          <Stack
            aria-hidden
            direction="row"
            spacing={1}
            sx={{ display: { xs: "none", md: "flex" }, flexShrink: 0 }}
          >
            {strip.map((event) => {
              const { faction, monogram } = clubIdentity(event.club.slug, event.club.name);
              const [weekday, day, month] = nightLabel(event.startDate!).split(" ");
              return (
                <Stack
                  key={event.id}
                  sx={{
                    width: 92,
                    borderRadius: "3px",
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.14)",
                    bgcolor: "rgba(255,255,255,0.04)",
                  }}
                >
                  <Box sx={{ height: 4, bgcolor: event.hasEnded ? "#3A4A63" : faction.base }} />
                  <Stack spacing={0.125} sx={{ alignItems: "center", py: 1.75 }}>
                    <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                      letterSpacing: "0.12em", color: "#B9C9DD" }}>
                      {weekday?.toUpperCase()}
                    </Typography>
                    <Typography sx={{ fontFamily: mono, fontSize: "1.6rem", fontWeight: 700,
                                      lineHeight: 1.05,
                                      color: event.hasEnded ? "#B9C9DD" : "#FFFFFF" }}>
                      {day}
                    </Typography>
                    <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                                      letterSpacing: "0.1em", color: "#B9C9DD" }}>
                      {month?.toUpperCase()}
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "0.66rem",
                                    fontWeight: 700, letterSpacing: "0.06em", textAlign: "center",
                                    color: "#FFFFFF",
                                    bgcolor: event.hasEnded ? "#2A3A52" : faction.deep,
                                    py: 0.5 }}>
                    {monogram}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
