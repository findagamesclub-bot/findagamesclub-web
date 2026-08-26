"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Portal from "@mui/material/Portal";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens } from "@/lib/tokens";

/**
 * A backdrop while something is in flight.
 *
 * `scrim` covers the whole viewport with the loader in the middle, the way a
 * dialog's backdrop does — one unmistakable "wait" rather than several controls
 * quietly greying out and leaving somebody to work out which one they pressed.
 * It sits above the header too, so nothing on the page is reachable mid-write.
 *
 * `dim` is for a refetch, where what is underneath is still true and only going
 * out of date. That fades in place instead of being covered.
 *
 * The fade-in is delayed in CSS rather than timed in state, so an action that
 * lands in 200ms never flashes a backdrop — and because the delay applies only
 * on the way in, it clears the instant the work is done.
 */
export default function BusyOverlay({
  busy, label = "Working", variant = "scrim", children,
}: {
  busy: boolean;
  /** Present tense. Announced to screen readers and shown beside the spinner. */
  label?: string;
  variant?: "scrim" | "dim";
  children: React.ReactNode;
}) {
  const scrim = variant === "scrim";

  const pill = (
    <Stack
      direction="row"
      spacing={1.5}
      role="status"
      aria-live="polite"
      sx={{
        alignItems: "center",
        px: 2.75, py: 1.4,
        borderRadius: 999,
        backgroundColor: tokens.paper,
        border: `1px solid ${tokens.rule}`,
        boxShadow: "0 6px 28px rgba(16,27,45,0.24)",
      }}
    >
      <CircularProgress size={18} thickness={5} aria-hidden />
      <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.95rem" }}>
        {label}
      </Typography>
    </Stack>
  );

  const overlay = (
      <Box
        aria-hidden={!busy}
        sx={{
          position: scrim ? "fixed" : "absolute",
          inset: 0,
          // Above the header, so a write cannot be interrupted by navigating.
          zIndex: (theme) => (scrim ? theme.zIndex.modal : 2),
          display: "flex",
          alignItems: scrim ? "center" : "flex-start",
          justifyContent: "center",
          pt: scrim ? 0 : 6,
          backgroundColor: scrim ? "rgba(16,27,45,0.4)" : "transparent",
          backdropFilter: scrim ? "blur(2px)" : "none",
          opacity: busy ? 1 : 0,
          pointerEvents: busy ? "auto" : "none",
          transition: "opacity 180ms ease",
          transitionDelay: busy ? "150ms" : "0ms",
        }}
      >
        {scrim ? pill : <Box sx={{ position: "sticky", top: 96 }}>{pill}</Box>}
      </Box>
  );

  return (
    <Box sx={{ position: scrim ? "static" : "relative" }}>
      <Box
        aria-busy={busy}
        sx={{
          opacity: !scrim && busy ? 0.4 : 1,
          pointerEvents: !scrim && busy ? "none" : "auto",
          transition: "opacity 150ms ease",
        }}
      >
        {children}
      </Box>

      {/*
        The full-screen scrim is rendered at the end of <body>.
        `position: fixed` is still stacked inside whatever context its ancestors
        create, and Leaflet puts z-index 400 on its map panes from the root
        context — so a scrim nested inside a sticky sidebar painted underneath
        the map. A portal has no ancestors to be trapped by.
      */}
      {scrim ? <Portal>{overlay}</Portal> : overlay}
    </Box>
  );
}
