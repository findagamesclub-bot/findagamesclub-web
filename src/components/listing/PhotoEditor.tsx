"use client";

import { useRef, type ReactNode } from "react";
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
import {
  MAX_CLUB_IMAGES, clubImageUrl, type MediaKind, type MediaOwner,
} from "@/utils/club-media";
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
/**
 * What differs between a club's photos and an event's.
 *
 * The behaviour does not: uploading, reordering, the cap, the alt text and
 * what a removal promises are the same job in both places, and a second copy
 * of this component would drift the first time either was touched. Only the
 * words change, so only the words are props.
 */
export type PhotoCopy = {
  /** Shown when there are none, and it has to say what the first one does. */
  empty: string;
  /** The mono badge on the first row, naming what being first means. */
  lead: string;
  /** Why taking the first one off is different from taking any other off. */
  leadRemove: string;
  remove: string;
};

const CLUB_COPY: PhotoCopy = {
  empty: "No photos yet. The first one becomes your header and the picture on "
    + "your card in the directory.",
  lead: "HEADER AND CARD",
  leadRemove: "This is your header and the picture on your card in the "
    + "directory, so the next photo takes its place. The file goes when you save.",
  remove: "It comes off your club page, and the file goes when you save.",
};

export default function PhotoEditor({
  owner, initial, max = MAX_CLUB_IMAGES, kind = "photos",
  field = "photo", removedField = "removedPhoto", copy = CLUB_COPY, renderLead,
}: {
  /** The club, or the listing being written when there is no club yet. */
  owner: MediaOwner;
  initial: ClubPhoto[];
  /** Ten for a club (0087), five for an event (0173). */
  max?: number;
  /** Which folder the files land in. */
  kind?: MediaKind;
  /** The form field each picture posts as. */
  field?: string;
  removedField?: string;
  copy?: PhotoCopy;
  /**
   * Drawn above the list, given whichever picture is currently first.
   *
   * It has to live here rather than beside this component, because only this
   * component knows the live list: an event's banner preview drawn from the
   * saved event went on showing the club's borrowed photo, under a caption
   * saying the event had no picture of its own, while three the club had just
   * uploaded sat underneath. That reads as an upload that failed.
   */
  renderLead?: (lead: ClubPhoto | null) => ReactNode;
}) {
  const { photos, removed, busy, error, room, add, remove, move, describe } =
    useClubPhotos(owner, initial, max);
  const picker = useRef<HTMLInputElement>(null);

  return (
    <Stack spacing={1.5}>
      {/* Every photo posts as three fields in the same order they appear, so
          the action reads them with getAll and never has to sort. */}
      {photos.map((photo) => (
        <input key={`f-${photo.key}`} type="hidden" name={field}
          value={JSON.stringify({ path: photo.path, src: photo.src, alt: photo.alt })} />
      ))}

      {/* And the files behind the ones taken off it, deleted by the save once
          the rows that pointed at them are gone. */}
      {removed.map((path) => (
        <input key={`r-${path}`} type="hidden" name={removedField} value={path} />
      ))}

      {renderLead ? renderLead(photos[0] ?? null) : null}

      <BusyOverlay busy={busy} variant="dim" label="Uploading">
        <Stack spacing={1}>
          {/* Empty on purpose where `renderLead` already draws the empty case
              and explains it: two sentences about the same nothing, with the
              louder one second, is what an event's panel read as. */}
          {photos.length === 0 && copy.empty ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {copy.empty}
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
                {/* A photo still uploading has only a blob URL; a saved one has
                    a storage path or, if it came from the old site, a URL of
                    its own. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.preview
                          || clubImageUrl({ src: photo.src, storagePath: photo.path }, publicUrl)}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </Box>

              <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                {index === 0 ? (
                  <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                                    letterSpacing: "0.1em", color: tokens.brass }}>
                    {copy.lead}
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
                  body={index === 0 ? copy.leadRemove : copy.remove}
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
          {photos.length} OF {max}
        </Typography>
      </Stack>

      <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
        onChange={(event) => {
          void add(Array.from(event.target.files ?? []), kind);
          event.target.value = "";
        }} />
    </Stack>
  );
}
