"use client";

import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import { createFilterOptions } from "@mui/material/Autocomplete";

/**
 * Type-ahead for the games-and-facilities search.
 *
 * Suggestions come from the directory's own taxonomy, so you can pick "Warhammer
 * 40,000" without guessing the spelling — the legacy app did this with a
 * `<datalist>`. Free text is still allowed, because clubs list facilities the
 * taxonomy hasn't caught up with yet.
 *
 * Terms accumulate as chips and the value handed back stays comma-joined, so
 * the query contract is unchanged.
 */

const filter = createFilterOptions<string>({ limit: 8, trim: true });

export default function FacetSearchInput({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const facets = value.split(",").map((v) => v.trim()).filter(Boolean);

  const commit = (terms: string[]) => {
    const seen = new Set<string>();
    const kept: string[] = [];
    for (const term of terms) {
      const clean = term.trim().replace(/,+$/, "");
      // Case-insensitive dedupe: "Parking" and "parking" are the same filter.
      if (!clean || seen.has(clean.toLowerCase())) continue;
      seen.add(clean.toLowerCase());
      kept.push(clean);
    }
    onChange(kept.join(", "));
    setDraft("");
  };

  return (
    <Autocomplete
      multiple
      freeSolo
      disableClearable
      value={facets}
      inputValue={draft}
      options={options}
      // Already-chosen terms shouldn't reappear in the list.
      filterOptions={(opts, state) =>
        filter(opts.filter((o) => !facets.some((f) => f.toLowerCase() === o.toLowerCase())), state)
      }
      onInputChange={(_, next, reason) => {
        // A pasted or typed comma commits, same as picking a suggestion.
        if (reason === "input" && next.includes(",")) commit([...facets, next]);
        else if (reason !== "reset") setDraft(next);
      }}
      onChange={(_, next) => commit(next as string[])}
      onBlur={() => draft.trim() && commit([...facets, draft])}
      // MUI 9 renamed renderTags to renderValue and changed its signature.
      renderValue={(tags, getItemProps) =>
        tags.map((tag, i) => {
          const { key, ...rest } = getItemProps({ index: i });
          return <Chip key={key} label={tag} size="small" sx={{ fontFamily: "var(--font-display)" }} {...rest} />;
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={facets.length ? "Add another" : "Warhammer 40,000, terrain library"}
        />
      )}
    />
  );
}
