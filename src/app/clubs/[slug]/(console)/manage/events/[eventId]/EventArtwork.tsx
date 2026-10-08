"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ImageIcon from "@mui/icons-material/Image";
import Panel from "@/components/members/Panel";
import { useClubImage } from "@/hooks/useClubImage";
import { tokens } from "@/lib/tokens";
import type { EditableEvent } from "@/types/eventEditor";

/**
 * The event's own picture.
 *
 * Shown at 21:9, which is the shape the event page uses, so a club cropping a
 * poster can see what will actually survive rather than finding out afterwards.
 *
 * Without one the event borrows the club's own artwork, which is what every
 * imported event relies on and is not going to change. What was wrong is that
 * this box said so in a line of grey text inside an empty frame, so a club
 * that uploaded nothing saw nothing here and a picture on the public page, and
 * had no way to tell where it had come from. The borrowed picture is drawn,
 * named and labelled now. The client asked the question in those words: "I did
 * not upload a logo or picture, and it still added one. Where does this pull
 * from?"
 */
export default function EventArtwork({
  clubId, event, clubArt,
}: {
  clubId: number;
  event: EditableEvent;
  /** The club's first photo, which is what an event with none shows. */
  clubArt: { src: string; alt: string } | null;
}) {
  const image = useClubImage(clubId, "events", event.logoSrc);
  const borrowed = !image.src && clubArt !== null;

  return (
    <Panel title="Artwork" icon={ImageIcon}>
      <Stack spacing={2}>
        <input type="hidden" name="logoSrc" value={image.src} />

        <Box sx={{ aspectRatio: "21 / 9", borderRadius: 1.5, overflow: "hidden",
                   border: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface,
                   display: "grid", placeItems: "center" }}>
          {image.src || borrowed ? (
            // A plain img: the file has just been uploaded to Storage and the
            // URL is not one next/image has a loader configured for.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.src || clubArt!.src} alt={image.src ? "" : clubArt!.alt}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Typography variant="body2" sx={{ color: tokens.inkMuted, px: 2,
                                              textAlign: "center" }}>
              No picture yet, and your club has none either, so the event shows
              a plate with your club&apos;s initials on it.
            </Typography>
          )}
        </Box>

        {borrowed ? (
          // Named rather than implied. A club seeing its clubhouse photo here
          // knows at a glance that the event has none of its own, which is the
          // thing a grey empty box could not tell them.
          <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
            This is your club&apos;s photo, borrowed because the event has no
            picture of its own. Add one and it takes over here and on the event
            page.
          </Typography>
        ) : null}

        {image.error ? (
          <Typography variant="body2" sx={{ color: tokens.danger }}>{image.error}</Typography>
        ) : null}

        <Stack direction="row" spacing={1}>
          <Button component="label" variant="outlined" size="small"
            loading={image.busy} loadingPosition="start"
            aria-label={image.busy ? "Uploading the picture" : undefined}>
            {image.src ? "Replace picture" : "Add a picture"}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void image.upload(file);
                // Cleared so choosing the same file twice still fires.
                e.target.value = "";
              }} />
          </Button>
          {image.src ? (
            <Button size="small" onClick={image.clear} sx={{ color: tokens.inkMuted }}>
              Remove
            </Button>
          ) : null}
        </Stack>

        <TextField name="logoAlt" label="Describe the picture" fullWidth
          defaultValue={event.logoAlt}
          helperText="For anybody using a screen reader. The event's name is used if you leave it." />
      </Stack>
    </Panel>
  );
}
