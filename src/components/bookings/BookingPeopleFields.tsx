"use client";

import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MonoLabel from "@/components/ui/MonoLabel";
import OpponentField, { type Person } from "./OpponentField";
import { tokens } from "@/lib/tokens";
import type { Booking } from "@/types/booking";

export type { Person };

/** The list floats over the field below it, so it needs an edge of its own. */
const paper = {
  paper: { sx: { mt: 0.5, border: `1px solid ${tokens.rule}`,
                 boxShadow: "0 10px 30px rgba(16,27,45,0.18)" } },
};

/**
 * Who is on the table, for the club to change.
 *
 * Both seats, which is the club's own control: handing a member's table to
 * somebody else is the club's to do, and the database refuses `setPeople` from
 * anybody who cannot manage the club. The member's half of this question is
 * `OpponentField` on its own, which is all 0178 lets them set.
 *
 * The booker is a members-only picker, because a table is a member benefit and
 * everything about it is priced off their tier.
 */
export default function BookingPeopleFields({
  booking, people,
}: {
  booking: Booking;
  people: Person[];
}) {
  const [booker, setBooker] = useState<Person | null>(
    people.find((p) => p.id === booking.booker.profileId) ?? null);

  return (
    <Stack spacing={2.5}>
      <MonoLabel mb={0}>People on this table</MonoLabel>

      <Autocomplete<Person, false, false, false>
        options={people}
        value={booker}
        onChange={(_event, value) => setBooker(value)}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        slotProps={paper}
        renderInput={(params) => (
          <TextField {...params} label="Booked for" required
            helperText="Approved members only, because the table is priced off their tier." />
        )}
      />
      <input type="hidden" name="bookedBy" value={booker?.id ?? ""} />

      <OpponentField
        booking={booking} people={people} label="Playing against"
        helperText="Pick a member so the game counts for both of them, or type a guest's name." />

      <input type="hidden" name="setPeople" value="1" />
    </Stack>
  );
}
