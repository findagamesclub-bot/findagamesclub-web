"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import SearchIcon from "@mui/icons-material/Search";
import { useDebouncedField } from "@/hooks/useDebouncedCallback";
import { nextSearch, withSearch } from "@/utils/filter-url";
import { mono, tokens } from "@/lib/tokens";

export type UrlTab = { value: string; label: string; count: number };
export type UrlOption = { value: string; label: string };

/**
 * The same bar as `account/FilterBar`, for a list the server filters.
 *
 * A club a few seasons in has a thousand event bookings, and shipping all of
 * them to the browser so it can hide nine hundred is what `CLAUDE.md` says not
 * to do. So the filters live in the URL, the query runs in SQL, and this
 * writes the address rather than local state.
 *
 * Which also means a filtered list is a link: an owner can send "everybody who
 * still owes me for the Winter Open" to whoever is chasing it.
 */
export default function UrlFilterBar({
  query, placeholder, tabs, tab, sorts, sort, second, defaults, onBusy,
}: {
  query: string;
  placeholder: string;
  tabs: UrlTab[];
  tab: string;
  sorts: UrlOption[];
  sort: string;
  /** A second axis, such as which event. Optional. */
  second?: { label: string; value: string; options: UrlOption[]; param: string };
  /**
   * What each param means when it is absent, so a plain list has a plain URL
   * and the pager's links match the ones this writes.
   */
  defaults?: Record<string, string>;
  /**
   * So the page can dim what is going out of date while the query runs. Driven
   * by the transition rather than by the click, because a click that starts a
   * navigation has no idea when it ends.
   */
  onBusy?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [navigating, startNav] = useTransition();

  // React already knows when the navigation is in flight, so it says so rather
  // than the click guessing. Setting it true on the press and never setting it
  // false left the overlay up for good: the rows underneath had already been
  // replaced and the page still read as working.
  const tell = useRef(onBusy);
  tell.current = onBusy;
  useEffect(() => { tell.current?.(navigating); }, [navigating]);

  const go = (changes: Record<string, string>) => {
    // Built on top of the address as it stands, so anything this bar does not
    // own survives. Rebuilding it from the filters alone dropped `tab=bookings`
    // and threw the reader back to the events list on every tab press.
    //
    // `query` and not the draft: the draft is what is being typed, and only a
    // committed value belongs in the address.
    const search = nextSearch(current, {
      q: query, state: tab, sort,
      ...(second ? { [second.param]: second.value } : {}),
      ...changes,
    }, defaults);

    // `replace`, not `push`: changing a filter is not a place you go back to.
    startNav(() => router.replace(withSearch(pathname, search), { scroll: false }));
  };

  // Typing goes to the server, so the field stays responsive locally and the
  // query waits for a pause. The hook also syncs the other way, which matters
  // when a filter is cleared from somewhere else.
  const [typed, setTyped] = useDebouncedField(query, (value) => go({ q: value }));

  return (
    <Stack spacing={1.5}
      sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2,
            border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          size="small" fullWidth placeholder={placeholder} value={typed}
          onChange={(event) => setTyped(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: tokens.inkMuted }} />
                </InputAdornment>
              ),
            },
          }}
        />

        {second ? (
          <TextField select size="small" label={second.label} value={second.value}
            onChange={(event) => go({ [second.param]: event.target.value })}
            sx={{ minWidth: { sm: 220 } }}>
            {second.options.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>
        ) : null}

        <TextField select size="small" label="Sort" value={sort}
          onChange={(event) => go({ sort: event.target.value })}
          sx={{ minWidth: { sm: 190 } }}>
          {sorts.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_event, value) => go({ state: String(value) })}
        variant="scrollable" scrollButtons="auto"
        sx={{ minHeight: 40,
              "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontSize: "0.95rem" },
              "& .MuiTabs-indicator": { backgroundColor: tokens.brand } }}
      >
        {tabs.map((one) => (
          <Tab key={one.value} value={one.value} disableRipple
            label={
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <span>{one.label}</span>
                <Box component="span"
                  sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted }}>
                  {one.count}
                </Box>
              </Stack>
            } />
        ))}
      </Tabs>
    </Stack>
  );
}
