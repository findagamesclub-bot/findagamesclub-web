"use client";

import { useRef } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CloseIcon from "@mui/icons-material/Close";
import type { usePostPhotos } from "@/hooks/usePostPhotos";
import { IMAGE_TYPES, MAX_POST_IMAGES } from "@/utils/post-images";
import { tokens } from "@/lib/tokens";

/**
 * Up to two photos on a new thread, uploaded as they are picked.
 *
 * The state lives in the form rather than here, so the form can hold its
 * submit button back while an upload is still in flight.
 */
export default function PhotoPicker({
  photos, busy, error, room, add, remove, describe,
}: ReturnType<typeof usePostPhotos>) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, p: 2 }}>
      <Stack spacing={1.75}>
        <Stack direction="row" spacing={1.5}
          sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700,
                              fontSize: "0.95rem" }}>
              Photos
            </Typography>
            <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
              {MAX_POST_IMAGES} at most. JPEG, PNG, WebP or GIF, up to 5MB each.
            </Typography>
          </Box>

          <Button
            variant="outlined"
            startIcon={busy ? <CircularProgress size={16} /> : <AddPhotoAlternateIcon />}
            disabled={busy || room < 1}
            onClick={() => input.current?.click()}
            sx={{ flexShrink: 0 }}
          >
            {photos.length ? "Add another" : "Add photos"}
          </Button>
        </Stack>

        <input
          ref={input}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          multiple
          hidden
          onChange={(e) => {
            void add(Array.from(e.target.files ?? []));
            // Cleared so picking the same file twice still fires a change.
            e.target.value = "";
          }}
        />

        {error ? <Alert severity="warning" sx={{ py: 0.25 }}>{error}</Alert> : null}

        {photos.length ? (
          <Box sx={{ display: "grid", gap: 1.5,
                     gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" } }}>
            {photos.map((photo) => (
              <Stack key={photo.key} spacing={1}>
                <Box sx={{ position: "relative", borderRadius: 1.5, overflow: "hidden",
                           border: `1px solid ${tokens.rule}`, bgcolor: tokens.surface }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.preview}
                    alt=""
                    style={{ display: "block", width: "100%", aspectRatio: "4 / 3",
                             objectFit: "cover",
                             // Half-visible until it has actually landed, so a
                             // slow upload does not look finished.
                             opacity: photo.path ? 1 : 0.45 }}
                  />
                  {!photo.path ? (
                    <CircularProgress size={22}
                      sx={{ position: "absolute", top: "calc(50% - 11px)",
                            left: "calc(50% - 11px)", color: "#fff" }} />
                  ) : null}

                  <IconButton
                    onClick={() => remove(photo.key)}
                    aria-label="Remove this photo"
                    sx={{ position: "absolute", top: 6, right: 6, width: 34, height: 34,
                          bgcolor: "rgba(16,27,45,0.78)", color: "#fff",
                          "&:hover": { bgcolor: "rgba(16,27,45,0.92)" } }}
                  >
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>

                <TextField
                  size="small"
                  label="Describe it"
                  value={photo.alt}
                  onChange={(e) => describe(photo.key, e.target.value)}
                  helperText="Read aloud to anyone who cannot see it."
                  slotProps={{ htmlInput: { maxLength: 160 } }}
                />

                {photo.path ? (
                  <>
                    <input type="hidden" name="image" value={photo.path} />
                    <input type="hidden" name="imageAlt" value={photo.alt} />
                  </>
                ) : null}
              </Stack>
            ))}
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}
