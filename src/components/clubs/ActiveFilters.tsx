"use client";

import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ClubListFilters } from "@/lib/query/keys";

export type ActiveFilter = { key: keyof ClubListFilters; label: string; value?: string };

/**
 * Every applied filter as a removable chip, so one can be dropped without
 * resetting the lot. Sort is excluded: it is always set, so it never narrows
 * results. Clearing everything is a separate button that is always present.
 */
export default function ActiveFilters({
  filters,
  onRemove,
}: {
  filters: ActiveFilter[];
  onRemove: (filter: ActiveFilter) => void;
}) {
  if (filters.length === 0) return null;

  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      sx={{ flexWrap: "wrap", alignItems: "center" }}
      aria-live="polite"
      aria-label="Active filters"
    >
      <Typography variant="overline" sx={{ color: "text.secondary" }}>Filtering by</Typography>

      {filters.map((filter) => (
        <Chip
          key={`${filter.key}:${filter.value ?? filter.label}`}
          label={filter.label}
          size="small"
          onDelete={() => onRemove(filter)}
          sx={{ fontFamily: "var(--font-display)" }}
        />
      ))}
    </Stack>
  );
}
