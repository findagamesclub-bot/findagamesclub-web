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
import { tokens, type Faction } from "@/lib/tokens";

/**
 * The club adds a coaching slot.
 *
 * A dialog, like every other create form in the app — a new thread, a review,
 * a kit order. An inline panel here was the odd one out, and consistency is
 * worth more than the one click it saved an owner adding several in a row.
 */
export default function NewSlotForm({
  slug, clubId, faction, busy, onSubmit,
}: {
  slug: string;
  clubId: number;
  faction: Faction;
  busy: boolean;
  onSubmit: (data: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(false);
  const fullScreen = useMediaQuery("(max-width:600px)");

  return (
    <>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}
        sx={{ alignSelf: "flex-start", backgroundColor: faction.base,
              "&:hover": { backgroundColor: faction.deep } }}>
        Add a coaching slot
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"
        fullScreen={fullScreen}>
        <DialogTitle sx={{ pr: 6 }}>
          Add a coaching slot
          <IconButton onClick={() => setOpen(false)} aria-label="Close"
            sx={{ position: "absolute", right: 12, top: 12 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Box
            component="form"
            action={(data: FormData) => { setOpen(false); onSubmit(data); }}
            sx={{ pt: 0.5 }}
          >
            <input type="hidden" name="intent" value="add-slot" />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="clubId" value={clubId} />

            <Stack spacing={2.25}>
              <TextField name="title" label="What is it?" required fullWidth
                placeholder="Warhammer 40k coaching" autoFocus />

              <TextField name="description" label="Description" fullWidth
                multiline minRows={4}
                placeholder="What you will work through together." />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField name="slotDate" type="date" label="Date" required fullWidth
                  slotProps={{ inputLabel: { shrink: true } }} />
                <TextField name="startTime" type="time" label="Starts" required fullWidth
                  slotProps={{ inputLabel: { shrink: true } }} />
                <TextField name="endTime" type="time" label="Ends" fullWidth
                  slotProps={{ inputLabel: { shrink: true } }} />
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                {/* The symbol is furniture, so the owner types the number only
                    and cannot end up storing "££30". */}
                <TextField name="price" label="Price" fullWidth placeholder="30"
                  helperText="Paid to the club on the day."
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">£</InputAdornment>,
                    },
                  }} />

                <TextField
                  name="coachingType" select label="Kind" fullWidth defaultValue="one-to-one"
                  onChange={(e) => setGroup(e.target.value !== "one-to-one")}
                >
                  <MenuItem value="one-to-one">One to one</MenuItem>
                  <MenuItem value="group">Group</MenuItem>
                </TextField>

                <TextField name="capacity" type="number" label="Places" fullWidth
                  defaultValue={1} disabled={!group}
                  helperText={group ? "How many can book" : "One to one is always 1"}
                  slotProps={{ htmlInput: { min: 1, max: 50 } }} />
              </Stack>

              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                Members book themselves in. You record payment against each booking once
                they have paid you.
              </Typography>

              <Button type="submit" variant="contained" size="large" fullWidth
                loading={busy} loadingPosition="start"
                sx={{ backgroundColor: faction.base,
                      "&:hover": { backgroundColor: faction.deep } }}>
                Add the slot
              </Button>
            </Stack>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
