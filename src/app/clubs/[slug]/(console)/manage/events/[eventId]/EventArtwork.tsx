"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ImageIcon from "@mui/icons-material/Image";
import Panel from "@/components/members/Panel";
import PhotoEditor, { type PhotoCopy } from "@/components/listing/PhotoEditor";
import { MAX_EVENT_IMAGES, clubImageUrl } from "@/utils/club-media";
import { publicUrl } from "@/lib/supabase/storage";
import { tokens } from "@/lib/tokens";
import type { EditableEvent } from "@/types/eventEditor";

/**
 * The event's pictures.
 *
 * One for the whole event until 0173, which the client asked about: "do we
 * only allow upload of one image for an event? Could we allow up to 5?" It is
 * five now, as a list where the first is the hero, which is how the club's own
 * photos already work. The same editor draws both, so uploading, reordering
 * and the alt text behave identically in the two places a club meets them.
 *
 * Without any, the event borrows the club's own artwork, which is what every
 * imported event relies on and is not going to change. That used to be a line
 * of grey text inside an empty frame, so a club that uploaded nothing saw
 * nothing here and a picture on the public page, and had no way to tell where
 * it had come from. The borrowed picture is drawn and named. The client asked
 * that in those words too: "I did not upload a logo or picture, and it still
 * added one. Where does this pull from?"
 */
const EVENT_COPY: PhotoCopy = {
  // Nothing: the frame above says the empty case, and whichever sentence
  // follows it says what the first picture becomes.
  empty: "",
  lead: "BANNER AND CARD",
  leadRemove: "This is the event's banner and the picture on its card, so the "
    + "next one takes its place. The file goes when you save.",
  remove: "It comes off the event page, and the file goes when you save.",
};

export default function EventArtwork({
  clubId, event, clubArt,
}: {
  clubId: number;
  event: EditableEvent;
  /** The club's first photo, which is what an event with none shows. */
  clubArt: { src: string; alt: string } | null;
}) {
  return (
    <Panel title="Pictures" icon={ImageIcon}>
      <PhotoEditor
        owner={{ kind: "club", id: clubId }}
        initial={event.images.map((image) => ({
          key: String(image.id),
          preview: "",
          path: image.storagePath,
          src: image.src || null,
          alt: image.alt,
        }))}
        max={MAX_EVENT_IMAGES}
        kind="events"
        field="eventPhoto"
        removedField="removedEventPhoto"
        copy={EVENT_COPY}
        // Drawn from the live list rather than the saved event, so a picture
        // just added is the one in the frame. Reading the saved event meant a
        // club uploaded a poster and went on seeing its clubhouse photo under
        // a caption saying the event had no picture of its own.
        renderLead={(lead) => {
          const borrowed = !lead && clubArt !== null;
          const src = lead
            ? (lead.preview
               || clubImageUrl({ src: lead.src, storagePath: lead.path }, publicUrl))
            : clubArt?.src ?? "";

          return (
            <Stack spacing={1}>
              {/* 21:9, the shape the event page uses, so a club cropping a
                  poster sees what will actually survive rather than finding
                  out afterwards. */}
              <Box sx={{ aspectRatio: "21 / 9", borderRadius: 1.5, overflow: "hidden",
                         border: `1px solid ${tokens.rule}`,
                         backgroundColor: tokens.surface,
                         display: "grid", placeItems: "center" }}>
                {src ? (
                  // A plain img: the source is a blob URL until the upload
                  // lands, and the rest are bucket or third-party URLs
                  // next/image has no loader for.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={borrowed ? clubArt!.alt : ""}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Typography variant="body2" sx={{ color: tokens.inkMuted, px: 2,
                                                    textAlign: "center" }}>
                    No picture yet, and your club has none either, so the event
                    shows a plate with your club&apos;s initials on it. The
                    first one you add becomes the banner and the card.
                  </Typography>
                )}
              </Box>

              {borrowed ? (
                // Named rather than implied. A club seeing its clubhouse photo
                // here knows at a glance that the event has none of its own,
                // which is the thing a grey empty box could not tell them.
                <Typography sx={{ display: "block", fontSize: "0.75rem",
                                  lineHeight: 1.5, color: tokens.inkMuted }}>
                  This is your club&apos;s photo, borrowed because the event has
                  no picture of its own. The first one you add takes over here,
                  on the event page and on its card.
                </Typography>
              ) : null}
            </Stack>
          );
        }}
      />
    </Panel>
  );
}
