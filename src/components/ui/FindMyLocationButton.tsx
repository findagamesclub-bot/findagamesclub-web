"use client";

import { useState } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import { locatePlace } from "@/app/location-actions";
import { tokens } from "@/lib/tokens";

/**
 * "Find my location", beside the place box.
 *
 * The browser gives coordinates; the server turns them into a postcode
 * district and that goes in the box. Legacy keeps the raw coordinates and
 * writes "Current location", which leaves the box unable to say where it is
 * searching and nothing to correct if it guessed wrong. A district is
 * editable, shareable in the URL, and the right size for a radius.
 *
 * Every failure says which one it was. "Something went wrong" would leave
 * somebody toggling a browser permission that was never the problem.
 */
export default function FindMyLocationButton({
  onFound,
}: {
  /** Called with a place the directory can search, e.g. "OX11". */
  onFound: (place: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = () => {
    if (!("geolocation" in navigator)) {
      setError("This browser cannot find your location. Type a town or postcode instead.");
      return;
    }

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const result = await locatePlace(position.coords.latitude, position.coords.longitude);
        setBusy(false);
        if (result.ok) onFound(result.place);
        else setError(result.error);
      },
      (positionError) => {
        setBusy(false);
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Location access was blocked. Allow it in your browser and try again."
            : positionError.code === positionError.TIMEOUT
              ? "That took too long. Try again, or type a town instead."
              : "We could not find your location just now.",
        );
      },
      // Town-level is all a radius search needs, so a cached fix from the last
      // few minutes is fine and far faster than waking the GPS.
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  };

  return (
    <>
      <Tooltip title="Find my location">
        {/* span, so the tooltip still works while the button is disabled */}
        <span>
          <IconButton
            onClick={find}
            disabled={busy}
            aria-label="Find my location"
            sx={{
              // 44px is the floor a finger needs.
              width: 44, height: 44, flexShrink: 0,
              borderRadius: 1.5,
              border: `1px solid ${tokens.rule}`,
              color: tokens.inkMuted,
              "&:hover": { borderColor: tokens.brass, color: tokens.ink },
            }}
          >
            {busy
              ? <CircularProgress size={19} sx={{ color: tokens.brass }} />
              : <MyLocationIcon sx={{ fontSize: 20 }} />}
          </IconButton>
        </span>
      </Tooltip>

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="warning" onClose={() => setError(null)} sx={{ width: "100%" }}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}
