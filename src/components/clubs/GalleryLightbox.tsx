"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ZoomInIcon from "@mui/icons-material/ZoomOutMap";
import ClubArt from "./ClubArt";
import { tokens } from "@/lib/tokens";
import type { ClubImage } from "@/types/clubDetail";

/**
 * The club's photos, openable full size.
 *
 * Legacy opens one image and makes you close it to see the next
 * (detail.js:4377). With ten photos that is ten open-and-close cycles, so this
 * keeps the arrows and a counter: once somebody is looking at photos, the next
 * photo is what they want, not the page they left.
 *
 * MUI's Dialog brings the focus trap, the scroll lock, the backdrop and the
 * restore-focus-to-opener that legacy hand-rolls, so none of that is rebuilt
 * here.
 */
export default function GalleryLightbox({
  images, slug, name,
}: {
  images: ClubImage[];
  slug: string;
  name: string;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  // Focus returns here, so the keyboard lands back on the photo it opened.
  const openers = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback(() => setOpenAt(null), []);
  const step = useCallback(
    (by: number) =>
      setOpenAt((at) => (at === null ? at : (at + by + images.length) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (openAt === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAt, step]);

  if (!images.length) return null;
  const current = openAt === null ? null : images[openAt];

  // Past this many, the grid scrolls in place rather than pushing everything
  // below it off the page. Every photo still has its own tile: a cap would
  // make somebody open the lightbox to find out what they were missing.
  const SCROLL_FROM = 9;
  const scrolls = images.length > SCROLL_FROM;

  return (
    <>
      {scrolls ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 1 }}>
          {images.length} photos. Scroll the grid to see them all.
        </Typography>
      ) : null}

      {/* Three across on a desktop, two on a tablet, one on a phone. A fixed
          count rather than auto-fill so the tiles are the same size on every
          club, however many photos it has. */}
      <Box sx={{
        display: "grid", gap: 1.5,
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          sm: "repeat(2, minmax(0, 1fr))",
          md: "repeat(3, minmax(0, 1fr))",
        },
        ...(scrolls
          ? {
              maxHeight: { xs: 420, md: 560 },
              overflowY: "auto",
              // Padding and a rule so the cut-off edge reads as "more below"
              // rather than as the section simply ending here.
              pr: 1,
              py: 0.5,
              borderTop: `1px solid ${tokens.rule}`,
              borderBottom: `1px solid ${tokens.rule}`,
            }
          : {}),
      }}>
        {images.map((image, i) => (
          <Box
            key={image.src}
            component="button"
            type="button"
            ref={(el: HTMLButtonElement | null) => { openers.current[i] = el; }}
            onClick={() => setOpenAt(i)}
            aria-label={`${image.alt || `${name} photo`}, ${i + 1} of ${images.length}, open larger`}
            sx={{
              p: 0, border: `1px solid ${tokens.rule}`, borderRadius: 1,
              overflow: "hidden", cursor: "zoom-in", background: "none",
              display: "block", width: "100%", position: "relative",
              transition: "border-color 140ms ease",
              "&:hover": { borderColor: tokens.brass },
              "&:hover .zoom, &:focus-visible .zoom": { opacity: 1 },
              "&:focus-visible": { outline: `2px solid ${tokens.brand}`, outlineOffset: 2 },
            }}
          >
            <ClubArt slug={slug} name={name} image={image} ratio="16 / 10" showPlate={false} />

            {/* Says the photo opens. A cursor change alone never reaches touch. */}
            <Box className="zoom" aria-hidden
              sx={{ position: "absolute", right: 8, bottom: 8,
                    width: 32, height: 32, borderRadius: 1,
                    display: "grid", placeItems: "center",
                    backgroundColor: "rgba(16,27,45,0.72)", color: "#fff",
                    opacity: { xs: 1, md: 0 }, transition: "opacity 160ms ease" }}>
              <ZoomInIcon sx={{ fontSize: 17 }} />
            </Box>
          </Box>
        ))}
      </Box>

      <Dialog
        open={openAt !== null}
        onClose={close}
        maxWidth={false}
        // The photo is the subject, so the chrome gets out of its way.
        slotProps={{
          paper: {
            sx: { bgcolor: "transparent", boxShadow: "none", m: 2,
                  maxWidth: "min(1200px, 96vw)", overflow: "visible" },
          },
          backdrop: { sx: { backgroundColor: "rgba(9,15,26,0.88)" } },
        }}
        aria-label={current?.alt || `${name} photo`}
        // Focus back on the thumbnail that opened it, not the top of the page.
        onTransitionExited={() => openers.current[openAt ?? 0]?.focus()}
      >
        {current ? (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1}
              sx={{ alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                                letterSpacing: "0.1em", color: "rgba(255,255,255,0.72)" }}>
                {(openAt ?? 0) + 1} / {images.length}
              </Typography>
              <IconButton onClick={close} aria-label="Close"
                sx={{ width: 44, height: 44, color: "#fff",
                      backgroundColor: "rgba(255,255,255,0.12)",
                      "&:hover": { backgroundColor: "rgba(255,255,255,0.22)" } }}>
                <CloseIcon />
              </IconButton>
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              {images.length > 1 ? (
                <Arrow label="Previous photo" onClick={() => step(-1)}>
                  <ChevronLeftIcon />
                </Arrow>
              ) : null}

              <Box
                component="img"
                src={current.src}
                alt={current.alt || `${name} photo`}
                sx={{ flex: 1, minWidth: 0, display: "block", borderRadius: 1.5,
                      maxHeight: "78vh", width: "100%", objectFit: "contain",
                      backgroundColor: "rgba(255,255,255,0.04)" }}
              />

              {images.length > 1 ? (
                <Arrow label="Next photo" onClick={() => step(1)}>
                  <ChevronRightIcon />
                </Arrow>
              ) : null}
            </Stack>

            {current.alt ? (
              <Typography variant="body2"
                sx={{ color: "rgba(255,255,255,0.82)", textAlign: "center", px: 2 }}>
                {current.alt}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </Dialog>
    </>
  );
}

function Arrow({ label, onClick, children }: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <IconButton onClick={onClick} aria-label={label}
      sx={{ width: 48, height: 48, flexShrink: 0, color: "#fff",
            backgroundColor: "rgba(255,255,255,0.12)",
            "&:hover": { backgroundColor: "rgba(255,255,255,0.22)" } }}>
      {children}
    </IconButton>
  );
}
