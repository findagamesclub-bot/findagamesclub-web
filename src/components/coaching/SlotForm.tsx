"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { slotPrice } from "@/utils/coaching-pricing";
import { tokens, type Faction } from "@/lib/tokens";
import type { CoachingSlot } from "@/types/clubExtras";

/**
 * The club adds a coaching session, or changes one.
 *
 * A dialog, like every other create form in the app. One component for both,
 * because "cannot be edited" was the client's complaint and a second form that
 * drifts from this one is how the two end up offering different fields.
 *
 * Adding renders its own button. Editing is opened from the session card, so
 * the dialog is controlled from outside and there is no second trigger.
 */
export default function SlotForm({
  slug, clubId, faction, busy, onSubmit, slot, open: told, onClose,
}: {
  slug: string;
  clubId: number;
  faction: Faction;
  busy: boolean;
  onSubmit: (data: FormData) => void;
  /** Present when changing one. Absent when adding. */
  slot?: CoachingSlot;
  open?: boolean;
  onClose?: () => void;
}) {
  const editing = Boolean(slot);
  const [own, setOwn] = useState(false);
  const open = editing ? Boolean(told) : own;
  const close = () => (editing ? onClose?.() : setOwn(false));

  const [group, setGroup] = useState(
    Boolean(slot && slot.coachingType !== "one-to-one"));
  const fullScreen = useMediaQuery("(max-width:600px)");

  // The stored price is free text the club typed ("GBP 10", "£10"), and the
  // field holds the number only because the symbol is furniture on it.
  const price = slot ? slotPrice(slot.price) : 0;

  return (
    <>
      {editing ? null : (
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOwn(true)}
          sx={{ alignSelf: "flex-start", backgroundColor: faction.base,
                "&:hover": { backgroundColor: faction.deep } }}>
          Add a coaching slot
        </Button>
      )}

      <Dialog open={open} onClose={close} fullWidth maxWidth="sm"
        fullScreen={fullScreen}>
        <DialogTitle sx={{ pr: 6 }}>
          {editing ? "Change this session" : "Add a coaching slot"}
          <IconButton onClick={close} aria-label="Close"
            sx={{ position: "absolute", right: 12, top: 12 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Box
            component="form"
            action={(data: FormData) => { close(); onSubmit(data); }}
            sx={{ pt: 0.5 }}
          >
            <input type="hidden" name="intent"
              value={editing ? "edit-slot" : "add-slot"} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="clubId" value={clubId} />
            {slot ? <input type="hidden" name="slotId" value={slot.id} /> : null}

            <Stack spacing={2.25}>
              <TextField name="title" label="What is it?" required fullWidth
                defaultValue={slot?.title ?? ""}
                placeholder="Warhammer 40k coaching" autoFocus />

              <TextField name="description" label="Description" fullWidth
                multiline minRows={4} defaultValue={slot?.description ?? ""}
                placeholder="What you will work through together." />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField name="slotDate" type="date" label="Date" required fullWidth
                  defaultValue={slot?.date ?? ""}
                  slotProps={{ inputLabel: { shrink: true } }} />
                <TextField name="startTime" type="time" label="Starts" required fullWidth
                  defaultValue={slot?.startTime ?? ""}
                  slotProps={{ inputLabel: { shrink: true } }} />
                <TextField name="endTime" type="time" label="Ends" fullWidth
                  defaultValue={slot?.endTime ?? ""}
                  slotProps={{ inputLabel: { shrink: true } }} />
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                {/* The symbol is furniture, so the owner types the number only
                    and cannot end up storing "££30". */}
                <TextField name="price" label="Price" fullWidth placeholder="30"
                  defaultValue={price > 0 ? String(price) : ""}
                  helperText="Paid to the club on the day."
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">£</InputAdornment>,
                    },
                  }} />

                <TextField
                  name="coachingType" select label="Kind" fullWidth
                  defaultValue={slot?.coachingType ?? "one-to-one"}
                  onChange={(e) => setGroup(e.target.value !== "one-to-one")}
                >
                  <MenuItem value="one-to-one">One to one</MenuItem>
                  <MenuItem value="group">Group</MenuItem>
                </TextField>

                <TextField name="capacity" type="number" label="Places" fullWidth
                  defaultValue={slot?.capacity ?? 1} disabled={!group}
                  helperText={group ? "How many can book" : "One to one is always 1"}
                  slotProps={{ htmlInput: { min: 1, max: 50 } }} />
              </Stack>

              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                {editing
                  ? "Changing the price does not re-price anybody already booked on: a booking keeps what it was worth on the day."
                  : "Members book themselves in. You record payment against each booking once they have paid you."}
              </Typography>

              <Button type="submit" variant="contained" size="large" fullWidth
                loading={busy} loadingPosition="start"
                sx={{ backgroundColor: faction.base,
                      "&:hover": { backgroundColor: faction.deep } }}>
                {editing ? "Save changes" : "Add the slot"}
              </Button>
            </Stack>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
