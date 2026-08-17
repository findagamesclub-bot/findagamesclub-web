"use client";

import { useState } from "react";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

/**
 * Token input for the games-and-facilities search.
 *
 * Terms accumulate as removable chips rather than sitting in one comma string,
 * which is how the existing site behaves and why the API splits on commas. The
 * value handed back is still comma-joined, so the query contract is unchanged.
 */
export default function FacetSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState("");

  const facets = value.split(",").map((v) => v.trim()).filter(Boolean);

  const commit = (raw: string) => {
    const term = raw.trim().replace(/,+$/, "");
    if (!term) return;
    // Case-insensitive dedupe: "Parking" and "parking" are the same filter.
    if (facets.some((f) => f.toLowerCase() === term.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...facets, term].join(", "));
    setDraft("");
  };

  const remove = (term: string) =>
    onChange(facets.filter((f) => f !== term).join(", "));

  return (
    <Stack spacing={1}>
      <TextField
        placeholder={facets.length ? "Add another game or facility" : "Warhammer 40,000, terrain library"}
        value={draft}
        onChange={(e) => {
          // Typing or pasting a comma commits the term, same as pressing Enter.
          if (e.target.value.includes(",")) commit(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && facets.length) {
            // Backspace on an empty box removes the last chip.
            remove(facets[facets.length - 1]);
          }
        }}
        onBlur={() => commit(draft)}
        fullWidth
      />

      {facets.length ? (
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          {facets.map((facet) => (
            <Chip
              key={facet}
              label={facet}
              size="small"
              onDelete={() => remove(facet)}
              sx={{ fontFamily: "var(--font-display)" }}
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
