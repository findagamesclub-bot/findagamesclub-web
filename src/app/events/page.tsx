import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FilterLink from "@/components/ui/FilterLink";
import EventCard from "@/components/events/EventCard";
import EventMap from "@/components/events/EventMap";
import EventCalendar from "@/components/events/EventCalendar";
import { londonToday } from "@/services/bookingCalendar.service";
import { listEvents } from "@/services/events.service";
import { tokens } from "@/lib/tokens";
import SearchModeToggle from "@/components/ui/SearchModeToggle";
import EventsHero from "@/components/events/EventsHero";

export const metadata = {
  title: "Events",
  description: "Tournaments, leagues and club nights across the UK directory.",
};

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const when = first(params.when) === "past" ? "past" : "upcoming";
  const game = first(params.game);
  const rawView = first(params.view);
  const view: "list" | "map" | "calendar" =
    rawView === "map" ? "map" : rawView === "calendar" ? "calendar" : "list";

  const rawMonth = first(params.month);

  /** Keeps every other choice while changing one. */
  const link = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = {
      when: when === "past" ? "past" : undefined,
      game, view: rawView, month: rawMonth, ...patch,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const query = next.toString();
    return query ? `/events?${query}` : "/events";
  };

  const [{ events, upcomingCount, pastCount, games }, everything] = await Promise.all([
    listEvents({ when, game }),
    listEvents({ when: "all" }),
  ]);

  const tab = (value: "upcoming" | "past", label: string, count: number) => {
    const active = when === value;
    const href = link({ when: value === "past" ? "past" : undefined });
    return (
      <FilterLink key={value} href={href}>
        <Typography
          sx={{
            fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1rem",
            py: 0.5, whiteSpace: "nowrap",
            color: active ? tokens.ink : tokens.inkMuted,
            borderBottom: `2px solid ${active ? tokens.brass : "transparent"}`,
          }}
        >
          {label} <Box component="span" sx={{ color: tokens.inkMuted }}>{count}</Box>
        </Typography>
      </FilterLink>
    );
  };

  return (
    <Box component="main">
      <EventsHero
        events={everything.events}
        upcomingCount={everything.upcomingCount}
        pastCount={everything.pastCount}
      />

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 5 } }}>
      <Stack direction="row" spacing={2}
        sx={{ justifyContent: "flex-end", mb: 2 }}>
        <SearchModeToggle mode="events" />
      </Stack>

      <Stack direction="row" spacing={3} sx={{ borderBottom: `1px solid ${tokens.rule}`, mb: 3 }}>
        {tab("upcoming", "Coming up", upcomingCount)}
        {tab("past", "Already run", pastCount)}
      </Stack>

      {games.length ? (
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap", mb: 3 }}>
          {/* Wrapped in a plain next/link rather than component={NextLink}: a
              Server Component cannot pass a function into an MUI client
              component. Same pattern as ClubCard. */}
          <FilterLink href={when === "past" ? "/events?when=past" : "/events"}>
            <Chip
              clickable
              size="small"
              label="All games"
              variant={game ? "outlined" : "filled"}
              sx={game ? { borderColor: tokens.rule } : { bgcolor: tokens.ink, color: "#fff" }}
            />
          </FilterLink>
          {games.map((g) => (
            <FilterLink key={g} href={link({ game: g })}>
              <Chip
                clickable
                size="small"
                label={g}
                variant={game === g ? "filled" : "outlined"}
                sx={game === g
                  ? { bgcolor: tokens.ink, color: "#fff" }
                  : { borderColor: tokens.rule }}
              />
            </FilterLink>
          ))}
        </Stack>
      ) : null}

      {events.length ? (
        <>
          <Stack direction="row" spacing={2}
            sx={{ alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap" }}>
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: tokens.inkMuted }}>
              {events.length} {events.length === 1 ? "event" : "events"}
            </Typography>
            <Stack direction="row" spacing={0.5}
              sx={{ p: 0.5, borderRadius: 999, bgcolor: tokens.surface,
                    border: `1px solid ${tokens.rule}` }}>
              {([
                ["list", "List", undefined],
                ["map", "Map", "map"],
                ["calendar", "Calendar", "calendar"],
              ] as const).map(([value, label, param]) => (
                <FilterLink key={value} href={link({ view: param })}>
                  <Typography sx={{
                    fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.9rem",
                    px: 1.75, py: 0.75, borderRadius: 999, whiteSpace: "nowrap",
                    bgcolor: view === value ? tokens.ink : "transparent",
                    color: view === value ? "#FFFFFF" : tokens.inkMuted,
                    "&:hover": view === value ? {} : { color: tokens.ink },
                  }}>
                    {label}
                  </Typography>
                </FilterLink>
              ))}
            </Stack>
          </Stack>

          {view === "map" ? (
            <EventMap events={events} />
          ) : view === "calendar" ? (
            <EventCalendar
              events={events}
              today={londonToday()}
              // Opens on the month of the nearest event rather than today,
              // which for a past-events list would be an empty grid.
              month={
                /^\d{4}-\d{2}$/.test(rawMonth ?? "")
                  ? rawMonth!
                  : events.find((e) => e.startDate)?.startDate?.slice(0, 7)
                    ?? londonToday().slice(0, 7)
              }
              monthHref={(m) => link({ month: m })}
            />
          ) : (
            <Box sx={{ display: "grid", gap: 2.5,
                       gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" } }}>
              {events.map((event) => <EventCard key={event.id} event={event} />)}
            </Box>
          )}
        </>
      ) : (
        <Stack spacing={1} sx={{ border: `1px dashed ${tokens.rule}`, borderRadius: 2,
                                 p: { xs: 3, md: 5 }, textAlign: "center", bgcolor: tokens.paper }}>
          <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>
            {when === "upcoming" ? "Nothing coming up yet" : "No past events to show"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {game
              ? "No events for that game. Try another, or clear the filter."
              : when === "upcoming"
                ? "Clubs add events as they schedule them. Have a look at what has already run."
                : "Once clubs run events, they will appear here with their results."}
          </Typography>
        </Stack>
      )}
      </Container>
    </Box>
  );
}
