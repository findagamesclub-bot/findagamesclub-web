import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FilterLink from "@/components/ui/FilterLink";
import NavTabs from "@/components/ui/NavTabs";
import EventCard from "@/components/events/EventCard";
import EventMap from "@/components/events/EventMap";
import EventCalendar from "@/components/events/EventCalendar";
import { londonToday } from "@/services/bookingCalendar.service";
import { listEvents } from "@/services/events.service";
import { tokens } from "@/lib/tokens";
import SearchModeToggle from "@/components/ui/SearchModeToggle";
import EventsHero from "@/components/events/EventsHero";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import MapIcon from "@mui/icons-material/Map";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EventFilters from "@/components/events/EventFilters";
import SavedAlerts from "@/components/events/SavedAlerts";
import { EventsBusyProvider, EventResults } from "@/components/events/EventsBusy";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import { pageFrom, pageOf } from "@/utils/paging";

/** Three across on a wide screen, so a page is a whole number of rows. */
const EVENTS_PER_PAGE = 18;
import { getCurrentProfile } from "@/services/auth.service";
import { getMyAlerts } from "@/services/eventAlerts.service";
import { EVENT_SORTS, type EventSort } from "@/utils/event-filters";

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

  const rawSort = first(params.sort);
  const filters = {
    q: first(params.q),
    city: first(params.city),
    format: first(params.format),
    days: first(params.day) ? [first(params.day)!] : undefined,
    eventType: first(params.eventType),
    featuredGame: first(params.featuredGame),
    facility: first(params.facility),
    dateFrom: first(params.dateFrom),
    dateTo: first(params.dateTo),
    location: first(params.location),
    withinMiles: first(params.withinMiles),
    sort: EVENT_SORTS.includes(rawSort as EventSort) ? (rawSort as EventSort) : undefined,
  };

  /** Every filter rides along, so a tab or a view change keeps the search. */
  const carriedFilters = Object.fromEntries(
    Object.entries({
      q: filters.q, city: filters.city, format: filters.format, day: first(params.day),
      eventType: filters.eventType, featuredGame: filters.featuredGame,
      facility: filters.facility, dateFrom: filters.dateFrom, dateTo: filters.dateTo,
      location: filters.location, withinMiles: filters.withinMiles, sort: rawSort,
    }).filter(([, v]) => v),
  ) as Record<string, string>;

  /**
   * The trail back to this exact search. Appended to every link out to an
   * event, so its back arrow returns here rather than to the club.
   */
  const trail = (() => {
    const params = new URLSearchParams({ from: "events" });
    if (when === "past") params.set("when", "past");
    if (rawView) params.set("view", rawView);
    if (game) params.set("game", game);
    if (rawMonth) params.set("month", rawMonth);
    for (const [k, v] of Object.entries(carriedFilters)) params.set(k, v);
    return `?${params.toString()}`;
  })();

  /** Keeps every other choice while changing one. */
  const link = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = {
      when: when === "past" ? "past" : undefined,
      ...carriedFilters, game, view: rawView, month: rawMonth, ...patch,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const query = next.toString();
    return query ? `/events?${query}` : "/events";
  };

  const [{ events, upcomingCount, pastCount, games, options, origin, locationUnresolved },
         everything, viewer] = await Promise.all([
    listEvents({ ...filters, when, game }),
    listEvents({ when: "all" }),
    getCurrentProfile(),
  ]);

  const savedAlerts = viewer ? await getMyAlerts(viewer.id) : [];

  // The list pages; the map and the calendar do not. Both of those are a view
  // of the whole set at once, and a map showing a page of pins is a wrong map.
  const page = pageFrom(params.page);
  const listed = pageOf(events, page, EVENTS_PER_PAGE);

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

      <Box sx={{ mb: 3 }}>
        <NavTabs
          ariaLabel="Upcoming or past events"
          value={when}
          tabs={[
            { value: "upcoming", label: "Coming up", count: upcomingCount,
              href: link({ when: undefined }) },
            { value: "past", label: "Already run", count: pastCount,
              href: link({ when: "past" }) },
          ]}
        />
      </Box>

      <EventsBusyProvider>
      <EventFilters
        options={options}
        resultCount={events.length}
        canSaveAlert={Boolean(viewer)}
      />

      <SavedAlerts alerts={savedAlerts} />

      {locationUnresolved ? (
        <Box sx={{ mb: 3 }}>
          <EmptyState
            title={`We could not find “${filters.location}”`}
            description="Try a town, a city or a postcode: “Didcot”, “Manchester” or “OX11”."
          />
        </Box>
      ) : null}

      {origin ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 2 }}>
          Distances measured from <strong>{origin.label}</strong>.
        </Typography>
      ) : null}

      {games.length ? (
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap", mb: 3 }}>
          {/* Wrapped in a plain next/link rather than component={NextLink}: a
              Server Component cannot pass a function into an MUI client
              component. Same pattern as ClubCard. */}
          {/* Clears the game only. It used to rebuild the URL from scratch,
              which silently threw away every other filter. */}
          <FilterLink href={link({ game: undefined })}>
            <Chip
              clickable
              label="All games"
              variant={game ? "outlined" : "filled"}
              sx={game ? { borderColor: tokens.rule } : { bgcolor: tokens.ink, color: "#fff" }}
            />
          </FilterLink>
          {games.map((g) => (
            <FilterLink key={g} href={link({ game: g })}>
              <Chip
                clickable
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

      <EventResults>
      {events.length ? (
        <>
          <Stack direction="row" spacing={2}
            sx={{ alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap" }}>
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: tokens.inkMuted }}>
              {events.length} {events.length === 1 ? "event" : "events"}
            </Typography>
            <NavTabs
              ariaLabel="How to show the results"
              value={view}
              dense
              tabs={[
                { value: "list", label: "List", href: link({ view: undefined }),
                  icon: <FormatListBulletedIcon sx={{ fontSize: 18 }} /> },
                { value: "map", label: "Map", href: link({ view: "map" }),
                  icon: <MapIcon sx={{ fontSize: 18 }} /> },
                { value: "calendar", label: "Calendar", href: link({ view: "calendar" }),
                  icon: <CalendarMonthIcon sx={{ fontSize: 18 }} /> },
              ]}
            />
          </Stack>

          {view === "map" ? (
            <EventMap events={events} trail={trail} />
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
              trail={trail}
            />
          ) : (
            <Box sx={{ display: "grid", gap: 2.5,
                       gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" } }}>
              {listed.map((event) => <EventCard key={event.id} event={event} canSaveAlert={Boolean(viewer)} trail={trail} />)}
            </Box>
          )}

          {view === "list" || !view ? (
            <Pager page={page} total={events.length} noun="events"
              size={EVENTS_PER_PAGE}
              href={{
                path: "/events",
                // The same set `link` carries, so turning the page keeps the
                // search, the game and the tab the reader is already in.
                params: {
                  when: when === "past" ? "past" : undefined,
                  ...carriedFilters,
                  game,
                  view: rawView,
                  month: rawMonth,
                },
              }} />
          ) : null}
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
      </EventResults>
      </EventsBusyProvider>
      </Container>
    </Box>
  );
}
