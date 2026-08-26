"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { tokens } from "@/lib/tokens";
import { clubIdentity } from "@/utils/club-identity";
import type { ClubSummary } from "@/types/club";

/**
 * Clubs on a map.
 *
 * Leaflet with OpenStreetMap tiles, the same as the legacy app: no API key, no
 * billing account, nothing for the client to sign up for. It is also the only
 * mapping stack that can be swapped later without rewriting the markers.
 *
 * Loaded through a dynamic import rather than a module import because Leaflet
 * touches `window` at module scope and would break the server render.
 */
export default function ClubMap({ clubs }: { clubs: ClubSummary[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const placed = useMemo(() => clubs.filter((c) => c.coordinates), [clubs]);

  useEffect(() => {
    if (!container.current || !placed.length) return;

    let map: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (cancelled || !container.current) return;

        const bounds = placed.map((c) => [c.coordinates!.latitude, c.coordinates!.longitude] as [number, number]);

        map = L.map(container.current, { scrollWheelZoom: false });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(map as never);

        for (const club of placed) {
          const { faction, monogram } = clubIdentity(club.slug, club.name);
          // A div icon rather than the default pin: the club's own colour and
          // monogram are how it is identified everywhere else in the app, and a
          // row of identical blue teardrops tells you nothing.
          const icon = L.divIcon({
            className: "",
            html: `<span style="
              display:flex;align-items:center;justify-content:center;
              width:34px;height:34px;border-radius:50%;
              background:${faction.base};color:#fff;
              font-family:var(--font-display);font-weight:700;font-size:13px;
              box-shadow:0 1px 4px rgba(16,27,45,.35);
              border:2px solid #fff;">${monogram}</span>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
            popupAnchor: [0, -18],
          });

          L.marker([club.coordinates!.latitude, club.coordinates!.longitude], { icon })
            .addTo(map as never)
            .bindPopup(
              `<strong>${club.name}</strong><br>${club.city}` +
                (club.meetingLabel ? `<br>${club.meetingLabel}` : "") +
                `<br><a href="/clubs/${club.slug}">Open club page</a>`,
            );
        }

        (map as unknown as { fitBounds: (b: [number, number][], o: object) => void })
          .fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });

        setReady(true);
      } catch (error) {
        console.error("map failed to load", error);
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [placed]);

  if (!placed.length) {
    return (
      <Stack spacing={1} sx={{ border: `1px dashed ${tokens.rule}`, borderRadius: 2,
                               p: { xs: 3, md: 5 }, textAlign: "center", bgcolor: tokens.paper }}>
        <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>Nothing to map</Typography>
        <Typography variant="body2" color="text.secondary">
          None of these clubs has a postcode we could place. Try widening the search.
        </Typography>
      </Stack>
    );
  }

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        ref={container}
        role="application"
        aria-label={`Map of ${placed.length} clubs`}
        sx={{
          height: { xs: 420, md: 560 },
          borderRadius: 2,
          overflow: "hidden",
          border: `1px solid ${tokens.rule}`,
          bgcolor: tokens.surface,
          // Leaflet's own controls, brought into the design system.
          "& .leaflet-container": { fontFamily: "var(--font-display)" },
          "& .leaflet-popup-content-wrapper": { borderRadius: "8px" },
          "& .leaflet-popup-content a": { color: tokens.brand, fontWeight: 600 },
        }}
      />

      {!ready && !failed ? (
        <Typography sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
                          fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: tokens.inkMuted }}>
          Loading the map…
        </Typography>
      ) : null}

      {failed ? (
        <Stack spacing={1} sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", p: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            The map could not load. The club list below has everything the map would show.
          </Typography>
        </Stack>
      ) : null}

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
        {placed.length} of {clubs.length} clubs shown.{" "}
        <NextLink href="/clubs" style={{ color: tokens.brand, fontWeight: 600 }}>
          Back to the list
        </NextLink>
      </Typography>
    </Box>
  );
}
