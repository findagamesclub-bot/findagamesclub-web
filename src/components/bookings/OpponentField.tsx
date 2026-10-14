"use client";

import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { tokens } from "@/lib/tokens";
import type { Booking } from "@/types/booking";

export type Person = { id: string; name: string };

/** The list floats over whatever is under it, so it needs an edge of its own. */
const paper = {
  paper: { sx: { mt: 0.5, border: `1px solid ${tokens.rule}`,
                 boxShadow: "0 10px 30px rgba(16,27,45,0.18)" } },
};

/**
 * Who somebody is playing: a member picked off the roster, or a guest typed in.
 *
 * One control for both the club's form and the member's own. It is the same
 * question asked by two people, and a second copy would drift the first time
 * either was touched, which is the rule the status chips already learned.
 *
 * What differs is which seat flag rides with it. The club's form posts
 * `setPeople` and owns both seats; a member owns only this one, so their form
 * sets `setsSeat` and the flag is rendered here rather than left as a loose
 * hidden input in the dialog's spaced Stack.
 */
export default function OpponentField({
  booking, people, label, helperText, setsSeat = false,
}: {
  booking: Booking;
  /** Approved members who may be named. The viewer is already filtered out. */
  people: Person[];
  label: string;
  helperText: string;
  /** True on the member's own form, which is the only seat they may set. */
  setsSeat?: boolean;
}) {
  // Null whenever the field holds typed text rather than a picked member, so
  // somebody typed over becomes a guest instead of keeping a link to an
  // account that is no longer named on the booking.
  const [opponent, setOpponent] = useState<string | null>(
    booking.opponent?.profileId ?? null);

  return (
    <>
      {/* MUI 9 needs the generics spelled out on a freeSolo list, or the
          option type collapses to string and every accessor below breaks.

          Uncontrolled, with the saved opponent as the key. The dialog stays
          mounted across a save, so a changed `defaultValue` would otherwise be
          ignored and MUI warns about exactly that. Controlling it instead was
          tried and is worse: clearing `value` on a keystroke makes MUI reset
          the input, which ate the first letter of every typed guest. */}
      <Autocomplete<Person, false, false, true>
        key={`${booking.opponent?.profileId ?? ""}:${booking.opponent?.name ?? ""}`}
        freeSolo
        // MUI hides the arrow on a freeSolo list, which leaves this reading as
        // a plain text box. The helper says a member can be chosen here, so
        // the control has to say so too.
        forcePopupIcon
        options={people}
        defaultValue={
          booking.opponent?.profileId
            // A name that is not on the roster is still what the club recorded,
            // so it is shown rather than blanked. Same call `ArmyPicker` makes
            // about a faction the catalogue does not hold.
            ? people.find((p) => p.id === booking.opponent?.profileId)
              ?? booking.opponent?.name ?? ""
            : booking.opponent?.name ?? ""
        }
        getOptionLabel={(option) => (typeof option === "string" ? option : option.name)}
        onChange={(_event, value) =>
          setOpponent(typeof value === "string" || !value ? null : value.id)}
        // Typing unlinks. `onChange` fires when an option is picked or cleared
        // and NEVER on a keystroke, so without this the id survived being typed
        // over: picking Joe, typing "Dave from work" and saving posted Joe's
        // id, the database took the name from his profile, and the row still
        // read Joe. Measured, not read: the hidden field still held the uuid.
        // "input" is a keystroke; picking reports "reset" and the clear button
        // reports "clear", so only real typing unlinks.
        onInputChange={(_event, _value, reason) => {
          if (reason === "input") setOpponent(null);
        }}
        slotProps={paper}
        renderInput={(params) => (
          <TextField {...params} name="opponentName" label={label}
            helperText={helperText}
            slotProps={{
              ...params.slotProps,
              htmlInput: { ...(params.slotProps?.htmlInput ?? {}), maxLength: 120 },
            }} />
        )}
      />
      <input type="hidden" name="opponentId" value={opponent ?? ""} />
      {setsSeat ? <input type="hidden" name="setOpponent" value="1" /> : null}
    </>
  );
}
