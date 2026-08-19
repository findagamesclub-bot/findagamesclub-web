"use client";

import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import { createFilterOptions } from "@mui/material/Autocomplete";
import { joinFacets, splitFacets } from "@/utils/facets";

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
  const facets = splitFacets(value);

  const commit = (terms: string[]) => {
    const seen = new Set<string>();
    const kept: string[] = [];
    // One entry is one term, commas and all. Splitting on commas is what broke
    // "Warhammer 40,000", and matching it against the catalogue first only
    // protected the names we happen to know: any other game with a comma, or a
    // half-typed one, still came apart. Two terms means pressing enter twice,
    // which is what the hint under the field says.
    for (const term of terms.map((t) => t.trim()).filter(Boolean)) {
      // Case-insensitive dedupe: "Parking" and "parking" are the same filter.
      if (seen.has(term.toLowerCase())) continue;
      seen.add(term.toLowerCase());
      kept.push(term);
    }
    onChange(joinFacets(kept));
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
        // Deliberately not committing on comma: typing "Warhammer 40,000" would
        // break at the comma. Enter, blur or picking a suggestion commits.
        if (reason !== "reset") setDraft(next);
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
