"use client";

import { useState } from "react";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import BadgeChip, { BadgeIconGlyph, ToneSwatch } from "@/components/ui/BadgeChip";
import SubmitButton from "@/components/ui/SubmitButton";
import {
  BADGE_DESCRIPTION_MAX, BADGE_ICONS, BADGE_LABEL_MAX, CLUB_TONES,
  DEFAULT_ICON, DEFAULT_TONE,
} from "@/utils/badge-style";
import type { ClubBadgeRow } from "@/services/badges.service";
import { tokens } from "@/lib/tokens";

const TONE_NAMES: Record<string, string> = {
  club: "Club", service: "Service", podium: "Bronze",
  streak: "Green", campaign: "Blue",
};

/**
 * Making or renaming a badge.
 *
 * A dialog rather than an inline expander, per UI rule 5: this sits in a grid
 * and growing one card stretches its whole row. Full screen under 600.
 *
 * The preview is the point. A club picking an icon and a colour from two
 * dropdowns cannot tell what it will look like, and the thing they are making
 * is a small coloured chip.
 */
export default function BadgeDialog({
  open, badge, busy, onSave, onClose,
}: {
  open: boolean;
  /** Null when making a new one. */
  badge: ClubBadgeRow | null;
  busy: boolean;
  onSave: (fields: Record<string, string>) => void;
  onClose: () => void;
}) {
  const small = useMediaQuery("(max-width:599px)");
  // Held while the dialog is on screen, because MUI keeps it mounted through
  // its exit transition. Reading `badge` straight through meant the heading
  // flipped from "Edit badge" to "New badge" for half a second on the way out,
  // as the board cleared what was being edited.
  const [shown, setShown] = useState<ClubBadgeRow | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string>(DEFAULT_ICON);
  const [tone, setTone] = useState<string>(DEFAULT_TONE);
  const [active, setActive] = useState(true);

  // Filled from whichever badge was opened. In an effect rather than during
  // render because this dialog is mounted once and reopened, so there is no
  // previous badge's values to flash.
  useWhenChanged([open, badge], () => {
    if (!open) return;
    setShown(badge);
    setLabel(badge?.label ?? "");
    setDescription(badge?.description ?? "");
    setIcon(badge?.icon ?? DEFAULT_ICON);
    setTone(badge?.tone ?? DEFAULT_TONE);
    setActive(badge?.active ?? true);
  });

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose}
      fullWidth maxWidth="sm" fullScreen={small}>
      <DialogTitle sx={{ fontSize: "1.2rem" }}>
        {shown ? "Edit badge" : "New badge"}
      </DialogTitle>
      <DialogContent>
        <Box component="form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              badge: String(shown?.id ?? 0), label, description, icon, tone,
              active: String(active),
            });
          }}>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Box sx={{ p: 2, borderRadius: 1.5, backgroundColor: tokens.surface,
                       display: "flex", justifyContent: "center" }}>
              <BadgeChip label={label.trim() || "Your badge"}
                context={description.trim() || undefined} icon={icon} tone={tone} />
            </Box>

            <TextField label="Name" value={label} required autoFocus
              onChange={(e) => setLabel(e.target.value.slice(0, BADGE_LABEL_MAX))}
              helperText={`What it is called. ${BADGE_LABEL_MAX - label.length} left.`} />

            <TextField label="What it is for" value={description} multiline minRows={2}
              onChange={(e) => setDescription(e.target.value.slice(0, BADGE_DESCRIPTION_MAX))}
              helperText="Shown under the name, so somebody knows why they have it." />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField select label="Icon" value={icon} fullWidth
                onChange={(e) => setIcon(e.target.value)}>
                {BADGE_ICONS.map((one) => (
                  <MenuItem key={one} value={one}>
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                      <BadgeIconGlyph icon={one} />
                      <span>{one[0]!.toUpperCase() + one.slice(1)}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </TextField>

              <TextField select label="Colour" value={tone} fullWidth
                onChange={(e) => setTone(e.target.value)}>
                {CLUB_TONES.map((one) => (
                  <MenuItem key={one} value={one}>
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                      <ToneSwatch tone={one} />
                      <span>{TONE_NAMES[one] ?? one}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            {shown ? (
              <Stack spacing={0.5}>
                <TextField select label="Still giving it out" value={String(active)}
                  onChange={(e) => setActive(e.target.value === "true")}>
                  <MenuItem value="true">Yes</MenuItem>
                  <MenuItem value="false">No, retire it</MenuItem>
                </TextField>
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  Retiring stops it being given out. Anybody who already has it
                  keeps it.
                </Typography>
              </Stack>
            ) : null}

            <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end", pb: 1 }}>
              <Button variant="text" onClick={onClose} disabled={busy}>Cancel</Button>
              <SubmitButton label={shown ? "Save changes" : "Add the badge"}
                pendingLabel="Saving" variant="contained"
                blocked={!label.trim()} pending={busy} />
            </Stack>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
