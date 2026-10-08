"use client";

import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { tokens } from "@/lib/tokens";

/**
 * Who finished in this place.
 *
 * Offers the roster and takes free text, because a tournament sells tickets to
 * visitors and somebody who turned up from another club is still on the
 * results sheet. Picking a member links the placing to their profile, which is
 * also what puts their saved army lists in the picker underneath.
 *
 * Typed explicitly: a string `defaultValue` alongside object options makes the
 * inferred option type collapse to string.
 */
export default function PlacingPlayerField({
  roster, name, onPick,
}: {
  roster: { id: string; name: string }[];
  name: string;
  onPick: (profileId: string | null) => void;
}) {
  return (
    <Autocomplete<{ id: string; name: string }, false, false, true>
      freeSolo
      options={roster}
      defaultValue={name}
      slotProps={{
        paper: {
          sx: { mt: 0.5, border: `1px solid ${tokens.rule}`,
                boxShadow: "0 10px 30px rgba(16,27,45,0.18)" },
        },
      }}
      getOptionLabel={(option) => typeof option === "string" ? option : option.name}
      onChange={(_event, value) =>
        onPick(typeof value === "string" || !value ? null : value.id)}
      renderInput={(params) => (
        <TextField
          {...params}
          name="name" label="Player" required
          helperText={roster.length
            ? "Pick a member so it shows on their profile and their army lists appear below, or type any name."
            : "Whoever finished in this place."}
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...(params.slotProps?.htmlInput ?? {}), maxLength: 120 },
          }}
        />
      )}
    />
  );
}
