"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { tokens, type Faction } from "@/lib/tokens";

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

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(map as never);

        L.marker([latitude, longitude], {
          title: name,
          icon: L.divIcon({
            className: "",
            html: `<span style="
              display:flex;align-items:center;justify-content:center;
              width:38px;height:38px;border-radius:50%;
              background:${faction.base};color:#fff;
              font-family:var(--font-display);font-weight:700;font-size:14px;
              border:3px solid #fff;box-shadow:0 2px 8px rgba(16,27,45,.4);
              ">${monogram}</span>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
          }),
        }).addTo(map as never);
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
    <Box
      ref={container}
      role="application"
      aria-label={`Map showing ${name}`}
      sx={{
        height: { xs: 240, md: 300 },
        borderRadius: 2,
        overflow: "hidden",
        border: `1px solid ${tokens.rule}`,
        bgcolor: tokens.surface,
        "& .leaflet-container": { fontFamily: "var(--font-display)" },
      }}
    />
  );
}
