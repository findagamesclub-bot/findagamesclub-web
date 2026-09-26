"use client";

import { useEffect, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import BadgeChip from "@/components/ui/BadgeChip";
import SubmitButton from "@/components/ui/SubmitButton";
import type { ClubBadgeRow } from "@/services/badges.service";
import { tokens } from "@/lib/tokens";

type Member = { id: string; name: string };

/**
 * Giving one out.
 *
 * Several people at once, because a club handing out a tournament badge is
 * handing it to everybody who placed, and doing that one at a time is six
 * dialogs. Somebody who already holds it is not an error: the service gives it
 * to the rest and says how many.
 *
 * Only the roster is offered. A badge is a club saying something about one of
 * its own, and the database refuses anybody else by name.
 */
export default function AwardDialog({
  open, badge, members, busy, onAward, onClose,
}: {
  open: boolean;
  badge: ClubBadgeRow | null;
  members: Member[];
  busy: boolean;
  onAward: (fields: { members: string[]; note: string }) => void;
  onClose: () => void;
}) {
  const small = useMediaQuery("(max-width:599px)");
  const [picked, setPicked] = useState<Member[]>([]);
  const [note, setNote] = useState("");
  // Kept for the exit transition, so the badge being given does not blank out
  // on the way off screen.
  const [shown, setShown] = useState<ClubBadgeRow | null>(null);

  useEffect(() => {
    if (!open) return;
    setShown(badge);
    setPicked([]);
    setNote("");
  }, [open, badge]);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose}
      fullWidth maxWidth="sm" fullScreen={small}>
      <DialogTitle sx={{ fontSize: "1.2rem" }}>Give out a badge</DialogTitle>
      <DialogContent>
        <Box component="form"
          onSubmit={(event) => {
            event.preventDefault();
            onAward({ members: picked.map((m) => m.id), note });
          }}>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Box sx={{ p: 2, borderRadius: 1.5, backgroundColor: tokens.surface,
                       display: "flex", justifyContent: "center" }}>
              <BadgeChip label={shown?.label ?? "Badge"}
                context={shown?.description || undefined}
                icon={shown?.icon} tone={shown?.tone} />
            </Box>

            {members.length === 0 ? (
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                Nobody is on the roster yet, so there is nobody to give it to.
                Approve a member first.
              </Typography>
            ) : (
              <Autocomplete
                multiple
                options={members}
                value={picked}
                onChange={(_, next) => setPicked(next)}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderValue={(value, getItemProps) =>
                  value.map((option, index) => (
                    <Chip {...getItemProps({ index })} key={option.id} label={option.name}
                      size="small" />
                  ))}
                renderInput={(params) => (
                  <TextField {...params} label="Who gets it" autoFocus
                    helperText="Pick as many as you like. Anybody who already has it is skipped." />
                )}
              />
            )}

            <TextField label="Why (optional)" value={note} multiline minRows={2}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              helperText="Shown with the badge, so it means something later." />

            <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end", pb: 1 }}>
              <Button variant="text" onClick={onClose} disabled={busy}>Cancel</Button>
              <SubmitButton
                label={picked.length > 1 ? `Give it to ${picked.length}` : "Give it out"}
                pendingLabel="Giving it out" variant="contained"
                blocked={picked.length === 0} pending={busy} />
            </Stack>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
