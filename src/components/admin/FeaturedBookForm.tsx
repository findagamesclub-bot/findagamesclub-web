"use client";

import { useState, useTransition } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import StarIcon from "@mui/icons-material/StarBorder";
import Panel from "@/components/members/Panel";
import SubmitButton from "@/components/ui/SubmitButton";

/**
 * Booking a dated slot on the homepage.
 *
 * Its own file because `FeaturedBoard` went past the 200-line rule once the
 * slots became a grid, and because the tabs made the split obvious: the form
 * and the list are two screens now, not two halves of one.
 *
 * The action is dispatched from `onSubmit` inside a transition rather than
 * through the form's `action` prop, so React 19 does not reset the five fields
 * on a refusal and tell somebody to try again with the form emptied.
 */
export default function FeaturedBookForm({
  clubs, today, defaultPricePence, defaultDays, act, working,
}: {
  clubs: { id: number; name: string; city: string }[];
  today: string;
  defaultPricePence: number;
  defaultDays: number;
  /** The board owns the action state, because booking and removing share it. */
  act: (data: FormData) => void;
  working: boolean;
}) {
  const [, start] = useTransition();
  const [club, setClub] = useState<{ id: number; name: string; city: string } | null>(null);

  return (
    <Panel title="Book a slot" icon={StarIcon}>
      <Box component="form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          data.set("intent", "book");
          data.set("club", String(club?.id ?? 0));
          start(() => act(data));
        }}>
        <Stack spacing={2}>
          <Autocomplete
            options={clubs}
            value={club}
            onChange={(_, next) => setClub(next)}
            getOptionLabel={(option) => `${option.name}, ${option.city}`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField {...params} label="Club" required={false}
                helperText="Only clubs that are live in the directory can be featured." />
            )}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField name="from" label="From" type="date" fullWidth
              defaultValue={today}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Inclusive." />
            <TextField name="to" label="To" type="date" fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              helperText={`Inclusive. Left empty it runs ${defaultDays} days.`} />
            <TextField name="price" label="Price" fullWidth
              defaultValue={(defaultPricePence / 100).toFixed(2)}
              helperText="In pounds, for the record." />
          </Stack>

          <TextField name="note" label="Note" fullWidth
            helperText="Who agreed it, or what it was for." />

          <SubmitButton label="Book the slot" pendingLabel="Booking the slot"
            variant="contained" blocked={!club} pending={working}
            sx={{ alignSelf: "flex-start" }} />
        </Stack>
      </Box>
    </Panel>
  );
}
