"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import TuneIcon from "@mui/icons-material/Tune";
import SearchIcon from "@mui/icons-material/Search";
import { useDebouncedField } from "@/hooks/useDebouncedCallback";
import SaveAlertButton from "./SaveAlertButton";
import FindMyLocationButton from "@/components/ui/FindMyLocationButton";
import { useEventsBusy } from "./EventsBusy";
import { WITHIN_MILES } from "@/utils/event-filters";
import { tokens } from "@/lib/tokens";
import type { EventFilterOptions } from "@/types/eventList";

/** Everything the bar can put in the URL. Empty means "not applied". */
export type EventQuery = Record<string, string>;

const SORTS = [
  { value: "date", label: "Soonest date" },
  { value: "distance", label: "Nearest first" },
];

/** Field labels are sentence case, matching the club directory. */
function Field({ label, children, basis = 170 }: {
  label: string;
  children: React.ReactNode;
  basis?: number;
}) {
  return (
    <Stack spacing={0.75} sx={{ flex: `1 1 ${basis}px`, minWidth: 150 }}>
      <Typography variant="body2" sx={{ color: "text.secondary", fontFamily: "var(--font-display)" }}>
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

export default function EventFilters({
  options, resultCount, canSaveAlert,
}: {
  options: EventFilterOptions;
  resultCount: number;
  /** Signed out, the alert button explains itself rather than disappearing. */
  canSaveAlert: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Shared, so the spinner lands over the results rather than in here.
  const { run } = useEventsBusy();
  const [open, setOpen] = useState(false);

  const value = useCallback((key: string) => params.get(key) ?? "", [params]);

  const update = useCallback(
    (patch: EventQuery) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, v] of Object.entries(patch)) {
        if (v) next.set(key, v);
        else next.delete(key);
      }
      const query = next.toString();
      // scroll: false — the results are below the bar, and jumping to the top
      // to see a change that happened where you were looking is disorienting.
      run(() =>
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    },
    [params, pathname, router, run],
  );

  const [place, setPlace] = useDebouncedField(value("location"), (location) => update({ location }));
  const [text, setText] = useDebouncedField(value("q"), (q) => update({ q }));

  // `when` and `view` are the tabs above, not filters — they do not count.
  const applied = ["q", "location", "city", "format", "day", "eventType",
    "featuredGame", "facility", "withinMiles", "dateFrom", "dateTo", "sort"]
    .filter((key) => value(key)).length;

  const clear = () =>
    update({
      q: "", location: "", city: "", format: "", day: "", eventType: "",
      featuredGame: "", facility: "", withinMiles: "", dateFrom: "", dateTo: "", sort: "",
    });

  const select = (key: string, placeholder: string, values: string[]) => (
    <TextField select size="small" fullWidth value={value(key)}
      onChange={(e) => update({ [key]: e.target.value })}
      slotProps={{ select: { displayEmpty: true } }}>
      <MenuItem value="">{placeholder}</MenuItem>
      {values.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
    </TextField>
  );

  return (
    <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 2, p: { xs: 2, md: 2.5 },
               backgroundColor: tokens.paper, mb: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}
        sx={{ alignItems: { md: "center" } }}>
        <TextField
          fullWidth size="small" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Search events, games, clubs"
          aria-label="Search events"
          slotProps={{
            input: {
              startAdornment: <SearchIcon sx={{ fontSize: 19, color: tokens.inkMuted, mr: 1 }} />,
            },
          }}
        />

        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <SaveAlertButton canSave={canSaveAlert} />
          <Badge badgeContent={applied} color="primary">
            <Button variant="outlined" startIcon={<TuneIcon />} onClick={() => setOpen(!open)}
              sx={{ borderColor: tokens.rule, color: tokens.ink, whiteSpace: "nowrap" }}>
              {open ? "Hide filters" : "Filters"}
            </Button>
          </Badge>
        </Stack>
      </Stack>

      <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 1.25 }}>
        {resultCount} {resultCount === 1 ? "event matches" : "events match"} these filters.
      </Typography>

      <Collapse in={open}>
        <Stack spacing={2} sx={{ pt: 2.5 }}>
          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Field label="Location or postcode">
              <Stack direction="row" spacing={1}>
                <FindMyLocationButton
                  onFound={(found) => {
                    setPlace(found);
                    // Straight through rather than waiting on the debounce.
                    update({ location: found });
                  }}
                />
                <TextField size="small" fullWidth value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="Try E14, M1, or London"
                  slotProps={{ htmlInput: { "aria-label": "Location or postcode" } }} />
              </Stack>
            </Field>
            <Field label="City">{select("city", "All cities", options.cities)}</Field>
            <Field label="Event type">{select("eventType", "Any event type", options.eventTypes)}</Field>
            <Field label="Featured game">{select("featuredGame", "Any featured game", options.featuredGames)}</Field>
            <Field label="Event facilities">{select("facility", "Any event facility", options.facilities)}</Field>
          </Stack>

          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Field label="Format">{select("format", "All formats", options.formats)}</Field>
            <Field label="Day">{select("day", "Any day", options.days)}</Field>
            <Field label="Within miles">
              <TextField select size="small" fullWidth value={value("withinMiles")}
                onChange={(e) => update({ withinMiles: e.target.value })}
                helperText={!value("location") ? "Needs a location" : undefined}
                slotProps={{ select: { displayEmpty: true } }}>
                <MenuItem value="">Any distance</MenuItem>
                {WITHIN_MILES.map((m) => <MenuItem key={m} value={m}>{m} miles</MenuItem>)}
              </TextField>
            </Field>
            <Field label="Sort results">
              <TextField select size="small" fullWidth value={value("sort") || "date"}
                onChange={(e) => update({ sort: e.target.value === "date" ? "" : e.target.value })}>
                {SORTS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
            </Field>
          </Stack>

          <Stack direction="row" spacing={2} useFlexGap
            sx={{ flexWrap: "wrap", alignItems: "flex-end" }}>
            <Field label="From date" basis={150}>
              <TextField type="date" size="small" fullWidth value={value("dateFrom")}
                onChange={(e) => update({ dateFrom: e.target.value })}
                slotProps={{ htmlInput: { "aria-label": "Events from this date" } }} />
            </Field>
            <Field label="To date" basis={150}>
              <TextField type="date" size="small" fullWidth value={value("dateTo")}
                onChange={(e) => update({ dateTo: e.target.value })}
                slotProps={{ htmlInput: { "aria-label": "Events up to this date" } }} />
            </Field>
            <Box sx={{ flex: "1 1 150px", minWidth: 150 }}>
              <Button fullWidth variant="text" onClick={clear} disabled={!applied}
                sx={{ color: tokens.inkMuted }}>
                Reset filters
              </Button>
            </Box>
          </Stack>
        </Stack>
      </Collapse>
    </Box>
  );
}
