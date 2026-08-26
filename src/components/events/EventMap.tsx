"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens } from "@/lib/tokens";
import { clubIdentity } from "@/utils/club-identity";
import { nightLabel } from "@/utils/dates";
import type { EventSummary } from "@/types/eventList";

/**
 * Events on a map, placed by the club that runs them.
 *
 * Several events at one club stack on the same point, so a pin carries a count
 * rather than eleven markers fighting over one postcode, and the popup lists
 * what is on there.
 */
export default function EventMap({ events }: { events: EventSummary[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // One pin per club, however many events it is running.
  const byClub = useMemo(() => {
    const groups = new Map<string, EventSummary[]>();
    for (const event of events) {
      if (!event.coordinates) continue;
      groups.set(event.club.slug, [...(groups.get(event.club.slug) ?? []), event]);
    }
    return [...groups.values()];
  }, [events]);

  useEffect(() => {
    if (!container.current || !byClub.length) return;
    let map: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (cancelled || !container.current) return;

        const instance = L.map(container.current, { scrollWheelZoom: true, zoomControl: true });
        map = instance;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(instance);

        for (const group of byClub) {
          const lead = group[0]!;
          const { faction } = clubIdentity(lead.club.slug, lead.club.name);

          const marker = L.marker(
            [lead.coordinates!.latitude, lead.coordinates!.longitude],
            {
              title: lead.club.name,
              icon: L.divIcon({
                className: "",
                html: `<span style="
                  display:flex;align-items:center;justify-content:center;
                  width:34px;height:34px;border-radius:50%;
                  background:${faction.base};color:#fff;
                  font-family:var(--font-display);font-weight:700;font-size:13px;
                  border:2px solid #fff;box-shadow:0 1px 5px rgba(16,27,45,.4);
                  ">${group.length}</span>`,
                iconSize: [34, 34],
                iconAnchor: [17, 17],
                popupAnchor: [0, -18],
              }),
            },
          ).addTo(instance);

          const lines = group
            .slice(0, 5)
            .map((e) =>
              `<a href="/clubs/${e.club.slug}/events/${e.legacyId}">${e.title}</a>` +
              (e.startDate ? ` <span style="color:#4E5F79">${nightLabel(e.startDate)}</span>` : ""))
            .join("<br>");

          marker.bindPopup(
            `<strong>${lead.club.name}</strong><br>${lead.club.city}<br><br>${lines}` +
            (group.length > 5 ? `<br><em>and ${group.length - 5} more</em>` : ""),
          );
        }

        const fit = () => {
          instance.invalidateSize();
          instance.fitBounds(
            byClub.map((g) => [g[0]!.coordinates!.latitude, g[0]!.coordinates!.longitude] as [number, number]),
            { padding: [40, 40], maxZoom: 11 },
          );
        };
        fit();
        requestAnimationFrame(fit);
      } catch (error) {
        console.error("event map failed to load", error);
        setFailed(true);
      }
    })();

    return () => { cancelled = true; map?.remove(); };
  }, [byClub]);

  if (!byClub.length) {
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

  return (
    <Box>
      <Stack direction="row" spacing={2}
        sx={{ alignItems: "baseline", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: tokens.inkMuted }}>
          {events.length} {events.length === 1 ? "event" : "events"} at {byClub.length}{" "}
          {byClub.length === 1 ? "club" : "clubs"}
        </Typography>
        <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: tokens.inkMuted }}>
          Scroll to zoom · drag to move
        </Typography>
      </Stack>

      <Box
        ref={container}
        role="application"
        aria-label={`Map of ${events.length} events`}
        sx={{ height: { xs: 400, md: 560 }, borderRadius: 2, overflow: "hidden",
              border: `1px solid ${tokens.rule}`, bgcolor: tokens.surface,
              "& .leaflet-container": { fontFamily: "var(--font-display)" },
              "& .leaflet-popup-content a": { color: tokens.brand, fontWeight: 600 } }}
      />

      {failed ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          The map could not load. The list has everything it would show.
        </Typography>
      ) : null}
    </Box>
  );
}
