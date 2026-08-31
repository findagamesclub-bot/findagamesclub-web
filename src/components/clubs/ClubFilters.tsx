"use client";

import { useState } from "react";
import { useDebouncedField } from "@/hooks/useDebouncedCallback";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import TuneIcon from "@mui/icons-material/Tune";
import ActiveFilters, { type ActiveFilter } from "./ActiveFilters";
import FacetSearchInput from "./FacetSearchInput";
import SmartSearchBar from "./SmartSearchBar";
import { tokens } from "@/lib/tokens";
import SearchModeToggle from "@/components/ui/SearchModeToggle";
import FindMyLocationButton from "@/components/ui/FindMyLocationButton";
import { joinFacets, splitFacets } from "@/utils/facets";
import type { ClubListFilters } from "@/lib/query/keys";

export type FilterOptions = {
  formats: { slug: string; label: string }[];
  cities: string[];
  days: string[];
  sorts: { value: string; label: string }[];
  withinMiles: string[];
  reviewRatings: string[];
  /** Games and facilities, for the type-ahead and the smart-search parser. */
  facets: string[];
};

type Props = {
  filters: ClubListFilters;
  options: FilterOptions;
  resultCount: number;
  page: number;
  pageCount: number;
  onChange: (next: Partial<ClubListFilters>) => void;
  onClear: () => void;
};

/**
 * Field labels are sentence case in a normal weight, matching the existing
 * site. The tracked caps treatment is reserved for the club stat line, where it
 * marks data rather than form controls.
 */
function Field({ label, hint, children, grow = 1, basis = 170 }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  grow?: number;
  basis?: number;
}) {
  return (
    <Stack spacing={0.75} sx={{ flex: `${grow} 1 ${basis}px`, minWidth: 150 }}>
      <Typography variant="body2" sx={{ color: "text.secondary", fontFamily: "var(--font-display)" }}>
        {label}
      </Typography>
      {children}
      {hint ? <Typography variant="caption" sx={{ color: "text.secondary" }}>{hint}</Typography> : null}
    </Stack>
  );
}

export default function ClubFilters({
  filters, options, resultCount, page, pageCount, onChange, onClear,
}: Props) {
  const [showFilters, setShowFilters] = useState(false);

  // Typing a place should not fire a request per keystroke.
  const [locationDraft, setLocationDraft] = useDebouncedField(
    filters.location ?? "",
    (location) => onChange({ location }),
  );

  const applied: ActiveFilter[] = [
    ...splitFacets(filters.q).map((term) => ({ key: "q" as const, label: term, value: term })),
    ...(filters.city ? [{ key: "city" as const, label: filters.city }] : []),
    ...(filters.format
      ? [{ key: "format" as const, label: options.formats.find((f) => f.slug === filters.format)?.label ?? filters.format }]
      : []),
    ...(filters.day ? [{ key: "day" as const, label: filters.day }] : []),
    ...(filters.location ? [{ key: "location" as const, label: `Near ${filters.location}` }] : []),
    // Only a real radius. Without a place the service ignores it, so showing the
    // chip would claim a filter that never ran.
    ...(filters.withinMiles && filters.location
      ? [{ key: "withinMiles" as const, label: `Within ${filters.withinMiles} miles` }]
      : []),
    ...(filters.reviewRating ? [{ key: "reviewRating" as const, label: `${filters.reviewRating}+ stars` }] : []),
  ];

  // So a collapsed panel still signals that something is narrowing results.
  const hiddenActive = showFilters
    ? 0
    : [filters.location, filters.city, filters.format, filters.day, filters.reviewRating, filters.withinMiles]
        .filter(Boolean).length;

  const removeFilter = (filter: ActiveFilter) => {
    if (filter.key === "q") {
      const kept = splitFacets(filters.q).filter((t) => t !== filter.value);
      onChange({ q: joinFacets(kept) });
      return;
    }
    // Clearing the place also clears the radius, which is meaningless without it.
    if (filter.key === "location") {
      onChange({ location: "", withinMiles: "" });
      return;
    }
    onChange({ [filter.key]: "" });
  };

  const select = (value: string | undefined, key: keyof ClubListFilters) => ({
    select: true,
    value: value ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ [key]: e.target.value }),
    fullWidth: true,
    // Without displayEmpty MUI treats "" as no selection and renders a blank box.
    slotProps: { select: { displayEmpty: true } },
  });

  return (
    <Box
      component="section"
      aria-label="Search and filter the directory"
      sx={{
        border: `1px solid ${tokens.rule}`,
        borderRadius: 1.5,
        backgroundColor: tokens.paper,
        p: { xs: 2, sm: 3 },
      }}
    >
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" } }}>
          <Stack spacing={0.5}>
            <Typography variant="h3" sx={{ fontSize: "1.5rem" }}>Search and filter the directory</Typography>
            {/* A status readout rather than prose, so it takes the UI face. */}
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "var(--font-display)" }}>
              {resultCount} {resultCount === 1 ? "club matches" : "clubs match"} these filters
              {pageCount > 1 ? `. Page ${page} of ${pageCount}` : ""}.
            </Typography>
          </Stack>

          <SearchModeToggle mode="clubs" />
        </Stack>

        {/* Always visible, whatever the toggle does. */}
        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", alignItems: "flex-start" }}>
          <Box sx={{ flex: "3 1 340px", minWidth: 240 }}>
            <SmartSearchBar
              options={{
                cities: options.cities,
                formats: options.formats,
                days: options.days,
                facets: options.facets,
                withinMiles: options.withinMiles,
                reviewRatings: options.reviewRatings,
              }}
              onApply={onChange}
            />
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <Badge badgeContent={hiddenActive} color="secondary">
              <Button
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                variant={showFilters ? "contained" : "outlined"}
                startIcon={<TuneIcon />}
              >
                {showFilters ? "Hide filters" : "Filters"}
              </Button>
            </Badge>
          </Box>
        </Stack>

        <Collapse in={showFilters}>
          <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, p: { xs: 1.75, sm: 2.25 } }}>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", alignItems: "flex-start" }}>
              <Field label="Featured games or facilities" hint="Press enter after each one" grow={2} basis={280}>
                <FacetSearchInput
                  value={filters.q ?? ""}
                  options={options.facets}
                  onChange={(q) => onChange({ q })}
                />
              </Field>

              <Field label="Location or postcode" basis={200}>
                <Stack direction="row" spacing={1}>
                  <FindMyLocationButton
                    onFound={(place) => {
                      setLocationDraft(place);
                      // Straight through rather than waiting on the debounce:
                      // pressing the button is the decision, not typing into it.
                      onChange({ location: place });
                    }}
                  />
                  <TextField
                    placeholder="Try E14, M1, or London"
                    value={locationDraft}
                    onChange={(e) => setLocationDraft(e.target.value)}
                    fullWidth
                  />
                </Stack>
              </Field>

              <Field label="City">
                <TextField {...select(filters.city, "city")}>
                  <MenuItem value="">All cities</MenuItem>
                  {options.cities.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
              </Field>

              <Field label="Format">
                <TextField {...select(filters.format, "format")}>
                  <MenuItem value="">All formats</MenuItem>
                  {options.formats.map((f) => <MenuItem key={f.slug} value={f.slug}>{f.label}</MenuItem>)}
                </TextField>
              </Field>

              <Field label="Review rating">
                <TextField {...select(filters.reviewRating, "reviewRating")}>
                  <MenuItem value="">Any rating</MenuItem>
                  {options.reviewRatings.map((r) => <MenuItem key={r} value={r}>{r}+ stars</MenuItem>)}
                </TextField>
              </Field>

              <Field label="Day">
                <TextField {...select(filters.day, "day")}>
                  <MenuItem value="">Any day</MenuItem>
                  {options.days.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </TextField>
              </Field>

              <Field label="Within miles" hint={filters.location ? undefined : "Enter a location first"}>
                <TextField {...select(filters.withinMiles, "withinMiles")} disabled={!filters.location}>
                  <MenuItem value="">Any distance</MenuItem>
                  {options.withinMiles.map((m) => <MenuItem key={m} value={m}>{m} miles</MenuItem>)}
                </TextField>
              </Field>

              {/* Sorting by distance needs somewhere to measure from. Without it
                  the service falls back to Recommended, so say so rather than
                  leave the control claiming an order the list is not in. */}
              <Field
                label="Sort results"
                basis={200}
                hint={
                  filters.sort === "distance" && !filters.location
                    ? "Enter a location to sort by distance"
                    : undefined
                }
              >
                <TextField {...select(filters.sort ?? "relevance", "sort")}>
                  {options.sorts.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                </TextField>
              </Field>

              <Box sx={{ pt: 3.5, flexShrink: 0 }}>
                <Button onClick={onClear} variant="outlined" disabled={applied.length === 0}>
                  Reset filters
                </Button>
              </Box>
            </Stack>
          </Box>
        </Collapse>

        {applied.length ? (
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}
          >
            <ActiveFilters filters={applied} onRemove={removeFilter} />
            <Button onClick={onClear} variant="text" size="small" sx={{ ml: "auto", flexShrink: 0 }}>
              Reset filters
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
