"use client";

import { useEffect, useState } from "react";
import Fab from "@mui/material/Fab";
import Zoom from "@mui/material/Zoom";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { tokens } from "@/lib/tokens";

/** The same trigger legacy uses (clubs/assets/back-to-top.js). */
const SHOW_AFTER = 360;

/**
 * Back to the top of a long page.
 *
 * The club page runs to fifteen sections, and the only way back to the header
 * was to scroll all of it again. Legacy grew the same button for the same
 * reason.
 *
 * Bottom left, not right: the right is where a phone's own back gesture and
 * most floating actions live, and this must never sit over the club's own
 * controls. It also stays clear of the safe area on a gesture-bar phone.
 */
export default function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const sync = () => setShown(window.scrollY > SHOW_AFTER);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  return (
    <Zoom in={shown}>
      <Fab
        size="large"
        aria-label="Back to top"
        onClick={() => window.scrollTo({
          top: 0,
          // Respects a reader who has asked for less movement; for them the
          // jump is instant rather than a long scroll they did not want.
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto" : "smooth",
        })}
        sx={{
          position: "fixed",
          left: { xs: 16, md: 24 },
          bottom: `calc(${16}px + env(safe-area-inset-bottom))`,
          zIndex: (theme) => theme.zIndex.appBar - 1,
          backgroundColor: tokens.paper,
          color: tokens.ink,
          border: `1px solid ${tokens.rule}`,
          "&:hover": { backgroundColor: tokens.surface, borderColor: tokens.brand },
        }}
      >
        <KeyboardArrowUpIcon sx={{ fontSize: 28 }} />
      </Fab>
    </Zoom>
  );
}
