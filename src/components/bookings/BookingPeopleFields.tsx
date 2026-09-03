"use client";

import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MonoLabel from "@/components/ui/MonoLabel";
import { tokens } from "@/lib/tokens";
import type { Booking } from "@/types/booking";

export type Person = { id: string; name: string };

/** The list floats over the field below it, so it needs an edge of its own. */
const paper = {
  paper: { sx: { mt: 0.5, border: `1px solid ${tokens.rule}`,
                 boxShadow: "0 10px 30px rgba(16,27,45,0.18)" } },
};

/**
 * Who is on the table, for the club to change.
 *
 * The club's own controls, not a member's. A member fixing their own typo is
 * one thing; handing their table to somebody else, or taking one, is the
 * club's to do, and the database refuses these fields from anybody who cannot
 * manage the club.
 *
 * Same two controls as the booking form itself: a members-only picker for the
 * booker, because a table is a member benefit and everything about it is
 * priced off their tier; a picker that also takes typed text for the opponent,
 * because a guest is a real thing to have on a table and legacy allows it.
 */
export default function BookingPeopleFields({
  booking, people,
}: {
  booking: Booking;
  people: Person[];
}) {
  const [booker, setBooker] = useState<Person | null>(
    people.find((p) => p.id === booking.booker.profileId) ?? null);
  const [opponent, setOpponent] = useState<string | null>(
    booking.opponent?.profileId ?? null);

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

      {/* MUI 9 needs the generics spelled out on a freeSolo list, or the
          option type collapses to string and every accessor below breaks. */}
      <Autocomplete<Person, false, false, true>
        freeSolo
        // MUI hides the arrow on a freeSolo list, which leaves this reading as
        // a plain text box sitting under a picker that has one. The helper
        // text says a member can be chosen here; the control has to say so
        // too, and the two fields have to look like the same kind of thing.
        forcePopupIcon
        options={people}
        defaultValue={
          booking.opponent?.profileId
            ? people.find((p) => p.id === booking.opponent?.profileId) ?? null
            : booking.opponent?.name ?? ""
        }
        getOptionLabel={(option) => (typeof option === "string" ? option : option.name)}
        onChange={(_event, value) =>
          setOpponent(typeof value === "string" || !value ? null : value.id)}
        slotProps={paper}
        renderInput={(params) => (
          <TextField {...params} name="opponentName" label="Playing against"
            helperText="Pick a member so the game counts for both of them, or type a guest's name."
            slotProps={{
              ...params.slotProps,
              htmlInput: { ...(params.slotProps?.htmlInput ?? {}), maxLength: 120 },
            }} />
        )}
      />
      {/* Cleared whenever the field is typed into rather than picked from, so
          a member who is typed over becomes a guest instead of keeping a link
          to somebody who is no longer named on the booking. */}
      <input type="hidden" name="opponentId" value={opponent ?? ""} />
      <input type="hidden" name="setPeople" value="1" />
    </Stack>
  );
}
