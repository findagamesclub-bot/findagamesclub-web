"use client";

import { useRef } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddPhotoIcon from "@mui/icons-material/AddPhotoAlternate";
import ArrowUpIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownIcon from "@mui/icons-material/ArrowDownward";
import BusyOverlay from "@/components/ui/BusyOverlay";
import RemoveRow from "@/components/ui/RemoveRow";
import { useClubPhotos, type ClubPhoto } from "@/hooks/useClubPhotos";
import { MAX_CLUB_IMAGES, clubImageUrl } from "@/utils/club-media";
import { publicUrl } from "@/lib/supabase/storage";
import { mono, tokens } from "@/lib/tokens";

/**
 * The club's photos, in the order they appear.
 *
 * Order is the point rather than a nicety: the first one is the header art on
 * the club page and the picture on its directory card, so "make this one first"
 * is the commonest thing anybody wants to do here. Buttons rather than
 * dragging, because dragging cannot be done with a keyboard and is miserable
 * on a phone.
 */
export default function PhotoEditor({
  clubId, initial,
}: {
  clubId: number;
  initial: ClubPhoto[];
}) {
  const { photos, removed, busy, error, room, add, remove, move, describe } =
    useClubPhotos(clubId, initial);
  const picker = useRef<HTMLInputElement>(null);

  return (
    <Stack spacing={1.5}>
      {/* Every photo posts as three fields in the same order they appear, so
          the action reads them with getAll and never has to sort. */}
      {photos.map((photo) => (
        <input key={`f-${photo.key}`} type="hidden" name="photo"
          value={JSON.stringify({ path: photo.path, src: photo.src, alt: photo.alt })} />
      ))}

      {/* And the files behind the ones taken off it, deleted by the save once
          the rows that pointed at them are gone. */}
      {removed.map((path) => (
        <input key={`r-${path}`} type="hidden" name="removedPhoto" value={path} />
      ))}

      <BusyOverlay busy={busy} variant="dim" label="Uploading">
        <Stack spacing={1}>
          {photos.length === 0 ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              No photos yet. The first one becomes your header and the picture on
              your card in the directory.
            </Typography>
          ) : null}

          {photos.map((photo, index) => (
            <Stack key={photo.key} direction="row" spacing={1.5}
              sx={{ alignItems: "center", p: 1, borderRadius: 1.5,
                    border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
              <Box sx={{ width: 84, height: 56, borderRadius: 1, flexShrink: 0,
                         overflow: "hidden", backgroundColor: tokens.surface,
                         border: `1px solid ${tokens.rule}` }}>
                {/* Not next/image: the source is a blob URL until the upload
                    lands, and half of these are on somebody else's domain. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {/* A photo still uploading has only a blob URL; a saved one has
                    a storage path or, if it came from the old site, a URL of
                    its own. */}
                <img src={photo.preview
                          || clubImageUrl({ src: photo.src, storagePath: photo.path }, publicUrl)}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </Box>

              <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                {index === 0 ? (
                  <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                                    letterSpacing: "0.1em", color: tokens.brass }}>
                    HEADER AND CARD
                  </Typography>
                ) : null}
                <TextField size="small" fullWidth label="What is in the photo"
                  value={photo.alt}
                  onChange={(event) => describe(photo.key, event.target.value)}
                  helperText={index === 0
                    ? "Read aloud to anybody using a screen reader."
                    : undefined} />
              </Stack>

              <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                <IconButton size="small" aria-label="Move up" disabled={index === 0}
                  onClick={() => move(photo.key, -1)}>
                  <ArrowUpIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton size="small" aria-label="Move down"
                  disabled={index === photos.length - 1}
                  onClick={() => move(photo.key, 1)}>
                  <ArrowDownIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <RemoveRow what="photo"
                  body={index === 0
                    ? "This is your header and the picture on your card in the "
                      + "directory, so the next photo takes its place. The file goes "
                      + "when you save."
                    : "It comes off your club page, and the file goes when you save."}
                  onRemove={() => remove(photo.key)} />
              </Stack>
            </Stack>
          ))}
        </Stack>
      </BusyOverlay>

      {error ? (
        <Typography variant="body2" sx={{ color: tokens.danger }}>{error}</Typography>
      ) : null}

      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Button variant="outlined" size="small" startIcon={<AddPhotoIcon />}
          disabled={busy || room < 1} onClick={() => picker.current?.click()}>
          Add photos
        </Button>
        <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", color: tokens.inkMuted }}>
          {photos.length} OF {MAX_CLUB_IMAGES}
        </Typography>
      </Stack>

      <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
        onChange={(event) => {
          void add(Array.from(event.target.files ?? []));
          event.target.value = "";
        }} />
    </Stack>
  );
}
