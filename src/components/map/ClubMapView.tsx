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
import { tokens } from "@/lib/tokens";
import { clubIdentity } from "@/utils/club-identity";
import MapHint from "./MapHint";
import { mapPinHtml, mapSurfaceSx, mapTooltipHtml, pinSize, TILE_OPTIONS, TILE_URL, TOOLTIP_OPTIONS } from "./mapSurface";
import { similarClubs } from "@/utils/similar-clubs";
import SimilarClubs from "./SimilarClubs";
import ClubArt from "@/components/clubs/ClubArt";
import FacilityChips from "@/components/clubs/FacilityChips";
import StarRating from "@/components/ui/StarRating";
import StatLine from "@/components/ui/StatLine";
import type { ClubSummary } from "@/types/club";

/**
 * The directory, on a map.
 *
 * A view of the same filtered results rather than a page of its own: a map that
 * ignores the filters above it is a different answer to the question the member
 * just asked. Legacy makes the same call — its map is a toggle on the directory
 * and shows "11 clubs mapped" from the matching set.
 *
 * Leaflet with OpenStreetMap tiles, exactly as legacy does, so there is no API
 * key and no billing account for the client to set up.
 */
export default function ClubMapView({ clubs }: { clubs: ClubSummary[] }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void; setView: (c: [number, number], z: number) => void } | null>(null);
  const markersRef = useRef<Map<string, { setIcon: (i: unknown) => void }>>(new Map());
  const iconFactory = useRef<((club: ClubSummary, index: number, active: boolean) => unknown) | null>(null);

  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const placed = useMemo(() => clubs.filter((c) => c.coordinates), [clubs]);
  const active = useMemo(
    () => placed.find((c) => c.slug === selected) ?? placed[0] ?? null,
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

        // Numbered to match the list, and in the club's own colour so a club is
        // recognisable on the map the way it is on its card.
        const makeIcon = (club: ClubSummary, index: number, isActive: boolean) => {
          const { faction } = clubIdentity(club.slug, club.name);
          return L.divIcon({
            className: "",
            html: mapPinHtml(String(index + 1), faction.base, isActive),
            iconSize: [pinSize(isActive), pinSize(isActive)],
            iconAnchor: [pinSize(isActive) / 2, pinSize(isActive) / 2],
          });
        };
        iconFactory.current = makeIcon as never;

        const map = L.map(container.current, {
          // Legacy allows the wheel, and a map you cannot zoom with the mouse
          // reads as broken.
          scrollWheelZoom: true,
          zoomControl: true,
        });
        mapRef.current = map as never;

        L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);

        placed.forEach((club, index) => {
          const marker = L.marker(
            [club.coordinates!.latitude, club.coordinates!.longitude],
            { icon: makeIcon(club, index, index === 0) as never, title: club.name },
          ).addTo(map);
          marker.bindTooltip(
            mapTooltipHtml(club.name, [club.city, club.neighbourhood].filter(Boolean).join(" · ")),
            TOOLTIP_OPTIONS,
          );
          marker.on("click", () => setSelected(club.slug));
          markersRef.current.set(club.slug, marker as never);
        });

        // Arriving by client-side navigation, the container has not been laid
        // out yet when Leaflet measures it, so the fit is computed against the
        // wrong size and lands somewhere between Iceland and Hungary. Measure
        // again on the next frame, then fit.
        const fit = () => {
          map.invalidateSize();
          map.fitBounds(
            placed.map((c) => [c.coordinates!.latitude, c.coordinates!.longitude] as [number, number]),
            { padding: [40, 40], maxZoom: 11 },
          );
        };
        fit();
        requestAnimationFrame(fit);

        // And again if the column is resized under it.
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => map.invalidateSize());
          observer.observe(container.current);
        }
      } catch (error) {
        console.error("map failed to load", error);
        setFailed(true);
      }
    })();

    // Captured now: by the time cleanup runs the ref may point elsewhere.
    const markers = markersRef.current;
    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, [placed]);

  // Redraw the pins when the selection moves, so the active one is obvious
  // whether it was chosen on the map or in the panel.
  useEffect(() => {
    if (!iconFactory.current) return;
    placed.forEach((club, index) => {
      markersRef.current.get(club.slug)?.setIcon(
        iconFactory.current!(club, index, club.slug === active?.slug),
      );
    });
  }, [active, placed]);

  if (!placed.length) {
    return (
      <Stack spacing={1} sx={{ border: `1px dashed ${tokens.rule}`, borderRadius: 2,
                               p: { xs: 3, md: 5 }, textAlign: "center", bgcolor: tokens.paper }}>
        <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>Nothing to map</Typography>
        <Typography variant="body2" color="text.secondary">
          None of these clubs has a postcode we could place.
        </Typography>
      </Stack>
    );
  }

  const activeIndex = active ? placed.findIndex((c) => c.slug === active.slug) : -1;
  // Drawn from the clubs already on the map, so a filtered search recommends
  // inside its own filter rather than ignoring it.
  const similar = active ? similarClubs(active, clubs) : [];
  const identity = active ? clubIdentity(active.slug, active.name) : null;

  return (
    <Box>
    <Box sx={{ display: "grid",
               gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.6fr) minmax(300px, 1fr)" },
               gap: 2 }}>
      <Box>
        <MapHint>
          {placed.length} {placed.length === 1 ? "club" : "clubs"} mapped
        </MapHint>

        <Box
          ref={container}
          role="application"
          aria-label={`Map of ${placed.length} clubs`}
          sx={mapSurfaceSx({ xs: 380, md: 560 })}
        />

        {failed ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            The map could not load. Switch to the list, which has everything the map would show.
          </Typography>
        ) : null}
      </Box>

      {/* The selected club, alongside rather than in a popup: a popup covers the
          map it is anchored to, and this is the panel a member reads to decide
          whether the club is worth the journey. */}
      {active && identity ? (
        <Stack
          sx={{ borderRadius: 2, bgcolor: tokens.paper, overflow: "hidden",
                border: `1px solid ${identity.faction.base}`, alignSelf: "start" }}
        >
          <ClubArt
            slug={active.slug}
            name={active.name}
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
                  {[active.city, active.neighbourhood, active.postcodeArea]
                    .filter(Boolean).join(" · ").toUpperCase()}
                </Typography>
                <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>{active.name}</Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              {active.rating ? (
                <StarRating
                  value={active.rating.average}
                  caption={`${active.rating.average.toFixed(1)} · ${active.rating.count} ${active.rating.count === 1 ? "review" : "reviews"}`}
                />
              ) : null}
              {typeof active.distanceMiles === "number" ? (
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem",
                                  color: tokens.brass, fontWeight: 600 }}>
                  {active.distanceMiles.toFixed(1)} mi away
                </Typography>
              ) : null}
            </Stack>

            {active.summary ? (
              <Typography variant="body2" color="text.secondary">{active.summary}</Typography>
            ) : null}

            {/* Every night, not just the next one: "can I make it" is the whole
                question a map is being asked. */}
            {active.schedule?.length ? (
              <Box>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                                  letterSpacing: "0.1em", color: tokens.inkMuted, mb: 0.5 }}>
                  MEETS
                </Typography>
                <Stack spacing={0.25}>
                  {active.schedule.slice(0, 3).map((s, i) => (
                    <Typography key={`${s.day}-${i}`} variant="body2"
                      sx={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                      {s.day} {s.time}
                      {s.label ? (
                        <Box component="span" sx={{ color: tokens.inkMuted }}> · {s.label}</Box>
                      ) : null}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            ) : null}

            <StatLine
              columns={2}
              dense
              stats={[
                { label: "From", value: active.fromPrice },
                { label: "Tables", value: active.tablesAvailable },
                { label: "Members", value: active.joinedCount || "Open" },
                { label: "Age", value: active.ages },
              ]}
            />

            {/* 1. The figure is the club's own headline count; the roster is who
                has joined through the site, and it is members-only. Saying so on
                the link stops the two numbers reading as a contradiction. */}
            <NextLink href={`/clubs/${active.slug}/members`} style={{ textDecoration: "none" }}>
              <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
                <GroupsIcon sx={{ fontSize: 16, color: identity.faction.base }} />
                <Typography variant="body2"
                  sx={{ color: identity.faction.deep, fontWeight: 600,
                        "&:hover": { textDecoration: "underline" } }}>
                  See who has joined
                </Typography>
              </Stack>
            </NextLink>

            {active.featuredGames?.length ? (
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                {active.featuredGames.slice(0, 5).map((g) => (
                  <Chip key={g} size="small" label={g}
                    sx={{ bgcolor: identity.faction.soft, color: identity.faction.deep,
                          fontWeight: 600, fontSize: "0.72rem" }} />
                ))}
              </Stack>
            ) : null}

            {active.facilities?.length ? (
              <Box>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                                  letterSpacing: "0.1em", color: tokens.inkMuted, mb: 0.5 }}>
                  FACILITIES
                </Typography>
                <FacilityChips values={active.facilities.slice(0, 6)} />
              </Box>
            ) : null}

            <Button
              component={NextLink}
              href={`/clubs/${active.slug}`}
              variant="contained"
              fullWidth
              endIcon={<OpenInNewIcon />}
              sx={{ bgcolor: identity.faction.base, "&:hover": { bgcolor: identity.faction.deep } }}
            >
              Open club page
            </Button>

            {placed.length > 1 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.82rem" }}>
                Click any numbered pin to see that club here.
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      ) : null}

    </Box>

      <SimilarClubs items={similar} />
    </Box>
  );
}
