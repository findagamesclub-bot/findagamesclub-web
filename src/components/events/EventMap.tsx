"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import GroupsIcon from "@mui/icons-material/Groups";
import SimilarEvents from "./SimilarEvents";
import ClubArt from "@/components/clubs/ClubArt";
import StatLine from "@/components/ui/StatLine";
import FacilityChips from "@/components/clubs/FacilityChips";
import { similarEvents } from "@/utils/similar-events";
import { clubIdentity } from "@/utils/club-identity";
import MapHint from "@/components/map/MapHint";
import { mapPinHtml, mapSurfaceSx, mapTooltipHtml, pinSize, TILE_OPTIONS, TILE_URL, TOOLTIP_OPTIONS } from "@/components/map/mapSurface";
import { nightLabel } from "@/utils/dates";
import { ticketsLeft } from "@/utils/tickets-left";
import { tokens } from "@/lib/tokens";
import type { EventSummary } from "@/types/eventList";

/**
 * Events on a map, placed by the club that runs them.
 *
 * Built to the same shape as ClubMapView: numbered pins matching the list, the
 * selected one in a panel alongside rather than a popup, and recommendations
 * underneath. A popup covers the map it is anchored to, and this panel is what
 * somebody reads to decide whether an event is worth the journey.
 */
export default function EventMap({ events, trail = "" }: {
  events: EventSummary[];
  trail?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  const markersRef = useRef<Map<number, { setIcon: (i: unknown) => void }>>(new Map());
  const iconFactory = useRef<((e: EventSummary, i: number, active: boolean) => unknown) | null>(null);

  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const placed = useMemo(() => events.filter((e) => e.coordinates), [events]);
  const active = useMemo(
    () => placed.find((e) => e.id === selected) ?? placed[0] ?? null,
    [placed, selected],
  );

  useEffect(() => {
    if (!container.current || !placed.length) return;

    let cancelled = false;
    let observer: ResizeObserver | null = null;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (cancelled || !container.current) return;

        // Numbered to match the list, and in the club's colour so an event is
        // recognisable on the map the way it is on its card.
        const makeIcon = (event: EventSummary, index: number, isActive: boolean) => {
          const { faction } = clubIdentity(event.club.slug, event.club.name);
          return L.divIcon({
            className: "",
            html: mapPinHtml(String(index + 1), faction.base, isActive),
            iconSize: [pinSize(isActive), pinSize(isActive)],
            iconAnchor: [pinSize(isActive) / 2, pinSize(isActive) / 2],
          });
        };
        iconFactory.current = makeIcon as never;

        const map = L.map(container.current, { scrollWheelZoom: true, zoomControl: true });
        mapRef.current = map as never;

        L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);

        placed.forEach((event, index) => {
          const marker = L.marker(
            [event.coordinates!.latitude, event.coordinates!.longitude],
            { icon: makeIcon(event, index, index === 0) as never, title: event.title },
          ).addTo(map);
          marker.bindTooltip(
            mapTooltipHtml(event.title, [event.club.name, event.club.city].filter(Boolean).join(" · ")),
            TOOLTIP_OPTIONS,
          );
          marker.on("click", () => setSelected(event.id));
          markersRef.current.set(event.id, marker as never);
        });

        // Arriving by client-side navigation, the container has not been laid
        // out when Leaflet measures it, so the fit lands somewhere between
        // Iceland and Hungary. Measure again on the next frame, then fit.
        const fit = () => {
          map.invalidateSize();
          map.fitBounds(
            placed.map((e) => [e.coordinates!.latitude, e.coordinates!.longitude] as [number, number]),
            { padding: [40, 40], maxZoom: 11 },
          );
        };
        fit();
        requestAnimationFrame(fit);

        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => map.invalidateSize());
          observer.observe(container.current);
        }
      } catch (error) {
        console.error("event map failed to load", error);
        setFailed(true);
      }
    })();

    // Captured now: by the time cleanup runs the ref may point elsewhere.
    const markers = markersRef.current;
    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      markers.clear();
    };
  }, [placed]);

  // Redraw the pins when the selection changes, so the active one grows.
  useEffect(() => {
    if (!iconFactory.current) return;
    placed.forEach((event, index) => {
      markersRef.current.get(event.id)?.setIcon(
        iconFactory.current!(event, index, event.id === active?.id),
      );
    });
  }, [active, placed]);

  if (!placed.length) {
    return (
      <Stack spacing={1} sx={{ border: `1px dashed ${tokens.rule}`, borderRadius: 2,
                               p: { xs: 3, md: 5 }, textAlign: "center", bgcolor: tokens.paper }}>
        <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>Nothing to map</Typography>
        <Typography variant="body2" color="text.secondary">
          None of these events has a venue we could place.
        </Typography>
      </Stack>
    );
  }

  const activeIndex = active ? placed.findIndex((e) => e.id === active.id) : -1;
  const similar = active ? similarEvents(active, events) : [];
  const identity = active ? clubIdentity(active.club.slug, active.club.name) : null;

  return (
    <Box>
      <Box sx={{ display: "grid",
                 gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.6fr) minmax(300px, 1fr)" },
                 gap: 2 }}>
        <Box>
          <MapHint>
            {placed.length} {placed.length === 1 ? "event" : "events"} mapped
          </MapHint>

          <Box
            ref={container}
            role="application"
            aria-label={`Map of ${placed.length} events`}
            sx={mapSurfaceSx({ xs: 380, md: 560 })}
          />

          {failed ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              The map could not load. Switch to the list, which has everything the map would show.
            </Typography>
          ) : null}
        </Box>

        {active && identity ? (
          <Stack sx={{ borderRadius: 2, bgcolor: tokens.paper, overflow: "hidden",
                       border: `1px solid ${identity.faction.base}`, alignSelf: "start" }}>
            <ClubArt
              slug={active.club.slug}
              name={active.club.name}
              image={active.image ?? null}
              ratio="16 / 7"
              showPlate={false}
            />

            <Stack spacing={1.75} sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Box sx={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                           display: "grid", placeItems: "center",
                           bgcolor: identity.faction.base, color: "#fff",
                           fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.85rem" }}>
                  {activeIndex + 1}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                                    letterSpacing: "0.08em", color: tokens.inkMuted }}>
                    {[active.club.name, active.club.city].filter(Boolean).join(" · ").toUpperCase()}
                  </Typography>
                  <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>{active.title}</Typography>
                </Box>
              </Stack>

              {active.startDate ? (
                <Box>
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                                    letterSpacing: "0.1em", color: tokens.inkMuted, mb: 0.5 }}>
                    WHEN
                  </Typography>
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                    {nightLabel(active.startDate)}
                    {active.startTime ? (
                      <Box component="span" sx={{ color: tokens.inkMuted }}> · {active.startTime}</Box>
                    ) : null}
                  </Typography>
                </Box>
              ) : null}

              {active.summary ? (
                <Typography variant="body2" color="text.secondary">{active.summary}</Typography>
              ) : null}

              <StatLine
                columns={2}
                dense
                stats={[
                  { label: "Entry", value: active.price },
                  { label: "Rounds", value: active.roundCount },
                  { label: ticketsLeft(active.ticketsAvailable)?.soldOut ? "Tickets" : "Tickets left",
                    value: ticketsLeft(active.ticketsAvailable)?.soldOut
                      ? "Sold out" : active.ticketsAvailable },
                  { label: "Games", value: active.featuredGames?.length || null },
                ]}
              />

              {active.featuredGames?.length ? (
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                  {active.featuredGames.slice(0, 5).map((g) => (
                    <Chip key={g} size="small" label={g}
                      sx={{ bgcolor: identity.faction.soft, color: identity.faction.deep,
                            fontWeight: 600, fontSize: "0.72rem" }} />
                  ))}
                </Stack>
              ) : null}

              {/* Labelled, the same as the club tile: an icon on its own does
                  not tell you a painting bench from a storage shelf. */}
              {active.facilities?.length ? (
                <Box>
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                                    letterSpacing: "0.1em", color: tokens.inkMuted, mb: 0.5 }}>
                    FACILITIES
                  </Typography>
                  <FacilityChips values={active.facilities.slice(0, 6)} />
                </Box>
              ) : null}

              {/* The club behind the event, reachable the way the club tile
                  reaches its roster. */}
              <NextLink href={`/clubs/${active.club.slug}/members`} style={{ textDecoration: "none" }}>
                <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
                  <GroupsIcon sx={{ fontSize: 16, color: identity.faction.base }} />
                  <Typography variant="body2"
                    sx={{ color: identity.faction.deep, fontWeight: 600,
                          "&:hover": { textDecoration: "underline" } }}>
                    See who has joined {active.club.name}
                  </Typography>
                </Stack>
              </NextLink>

              <Button
                component={NextLink}
                href={`/clubs/${active.club.slug}/events/${active.legacyId}${trail}`}
                variant="contained"
                fullWidth
                endIcon={<OpenInNewIcon />}
                sx={{ bgcolor: identity.faction.base,
                      "&:hover": { bgcolor: identity.faction.deep } }}
              >
                Open event page
              </Button>

              {placed.length > 1 ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.82rem" }}>
                  Click any numbered pin to see that event here.
                </Typography>
              ) : null}
            </Stack>
          </Stack>
        ) : null}
      </Box>

      <SimilarEvents items={similar} trail={trail} />
    </Box>
  );
}
