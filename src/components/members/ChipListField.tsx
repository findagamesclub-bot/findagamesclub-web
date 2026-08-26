"use client";

import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";

/**
 * A free-text list of short values, entered one at a time.
 *
 * Posts as repeated form fields under one name, so the server action reads it
 * with `getAll` and never has to pick a separator. Game names contain commas
 * ("Warhammer 40,000") and that has already cost us once.
 */
export default function ChipListField({
  name, label, value, placeholder, helperText,
}: {
  name: string;
  label: string;
  value: string[];
  placeholder?: string;
  helperText?: string;
}) {
  const [items, setItems] = useState<string[]>(value);
  const [draft, setDraft] = useState("");

  const commit = (next: string[]) => {
    const seen = new Set<string>();
    setItems(
      next
        .map((v) => v.trim())
        .filter((v) => {
          if (!v || seen.has(v.toLowerCase())) return false;
          seen.add(v.toLowerCase());
          return true;
        }),
    );
    setDraft("");
  };

  return (
    <>
      {items.map((item) => (
        <input key={item} type="hidden" name={name} value={item} />
      ))}
      <Autocomplete
        multiple
        freeSolo
        disableClearable
        options={[]}
        value={items}
        inputValue={draft}
        onInputChange={(_, next, reason) => reason !== "reset" && setDraft(next)}
        onChange={(_, next) => commit(next as string[])}
        onBlur={() => draft.trim() && commit([...items, draft])}
        renderValue={(tags, getItemProps) =>
          tags.map((tag, i) => {
            const { key, ...rest } = getItemProps({ index: i });
            return <Chip key={key} label={tag} size="small" {...rest} />;
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            // The example only helps while the field is empty. Left in, it
            // repeats a value the person can already see as a chip.
            placeholder={items.length ? undefined : placeholder}
            helperText={helperText}
            fullWidth
          />
        )}
      />
    </>
  );
}
