"use client";

import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import SearchIcon from "@mui/icons-material/Search";
import { mono, tokens } from "@/lib/tokens";

export type FilterTab<T extends string> = { value: T; label: string; count: number };
export type SortOption<S extends string> = { value: S; label: string };

/**
 * Search, group and order, over any list in the account.
 *
 * One component rather than one per page: memberships and coaching ask the
 * same three questions of a list, and two filter bars that drift apart is the
 * thing this codebase keeps having to undo.
 */
/**
 * A second axis, when a list is asked two different questions.
 *
 * Memberships needs "how do they pay" alongside "where do they stand", and
 * folding both into the tab row would mean choosing Yearly cleared Lapsed.
 */
export type SecondFilter = {
  label: string;
  value: string;
  options: SortOption<string>[];
  onChange: (value: string) => void;
};

export default function FilterBar<T extends string, S extends string>({
  query, onQuery, placeholder,
  tabs, filter, onFilter,
  sorts, sort, onSort,
  second,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  tabs: FilterTab<T>[];
  filter: T;
  onFilter: (value: T) => void;
  sorts: SortOption<S>[];
  sort: S;
  onSort: (value: S) => void;
  second?: SecondFilter;
}) {
  return (
    <Stack spacing={1.5}
      sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2,
            border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          size="small" fullWidth placeholder={placeholder}
          value={query} onChange={(event) => onQuery(event.target.value)}
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
          <TextField
            select size="small" label={second.label} value={second.value}
            onChange={(event) => second.onChange(event.target.value)}
            sx={{ minWidth: { sm: 170 } }}
          >
            {second.options.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>
        ) : null}

        <TextField
          select size="small" label="Sort" value={sort}
          onChange={(event) => onSort(event.target.value as S)}
          sx={{ minWidth: { sm: 190 } }}
        >
          {sorts.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>
      </Stack>

      <Tabs
        value={filter}
        onChange={(_event, value) => onFilter(value as T)}
        variant="scrollable" scrollButtons="auto"
        sx={{ minHeight: 40,
              "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontSize: "0.95rem" },
              "& .MuiTabs-indicator": { backgroundColor: tokens.brand } }}
      >
        {tabs.map((tab) => (
          <Tab key={tab.value} value={tab.value} disableRipple
            label={
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <span>{tab.label}</span>
                <Box component="span"
                  sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted }}>
                  {tab.count}
                </Box>
              </Stack>
            } />
        ))}
      </Tabs>
    </Stack>
  );
}
