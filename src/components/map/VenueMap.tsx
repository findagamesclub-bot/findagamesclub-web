"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import MapHint from "./MapHint";
import { mapPinHtml, mapSurfaceSx, mapTooltipHtml, pinSize, TILE_OPTIONS, TILE_URL, TOOLTIP_OPTIONS } from "./mapSurface";
import { type Faction } from "@/lib/tokens";

/**
 * Where a club actually meets, at street level.
 *
 * Zoomed in rather than fitted to the country: the question on a club page is
 * "what is it near and can I park", not "where in Britain is this".
 *
 * The wheel zooms. The usual objection is that a mid-page map steals the
 * scroll, so it only takes the wheel while the pointer is actually over it and
 * hands the page back the moment the pointer leaves.
 */
export default function VenueMap({
  latitude, longitude, name, monogram, faction,
}: {
  latitude: number;
  longitude: number;
  name: string;
  monogram: string;
  faction: Faction;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    let map: { remove: () => void } | null = null;
    let cleanup: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (cancelled || !container.current) return;

        const instance = L.map(container.current, {
          scrollWheelZoom: true,
          zoomControl: true,
        }).setView([latitude, longitude], 15);
        map = instance;

        const el = container.current;
        const take = () => instance.scrollWheelZoom.enable();
        const give = () => instance.scrollWheelZoom.disable();
        el.addEventListener("mouseenter", take);
        el.addEventListener("mouseleave", give);
        cleanup = () => {
          el.removeEventListener("mouseenter", take);
          el.removeEventListener("mouseleave", give);
        };

        L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map as never);

        const pin = L.marker([latitude, longitude], {
          title: name,
          // The only pin on the page, and it is what the page is about, so it
          // takes the size the directory gives its selected pin.
          icon: L.divIcon({
            className: "",
            html: mapPinHtml(monogram, faction.base, true),
            iconSize: [pinSize(true), pinSize(true)],
            iconAnchor: [pinSize(true) / 2, pinSize(true) / 2],
          }),
        }).addTo(map as never);

        pin.bindTooltip(mapTooltipHtml(name), TOOLTIP_OPTIONS);
      } catch (error) {
        console.error("venue map failed to load", error);
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
      map?.remove();
    };
  }, [latitude, longitude, name, monogram, faction]);

  if (failed) {
    return (
      <Typography variant="body2" color="text.secondary">
        The map could not load. The address above is everything it would show.
      </Typography>
    );
  }

  return (
    <Box>
      {/* The same line the directory maps carry. Shorter than those, because a
          detail page is showing one address rather than a country. */}
      <MapHint>{name}</MapHint>
      <Box
        ref={container}
        role="application"
        aria-label={`Map showing ${name}`}
        sx={mapSurfaceSx({ xs: 300, md: 380 })}
      />
    </Box>
  );
}
