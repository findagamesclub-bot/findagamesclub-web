"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import { parseSmartSearch, type SmartSearchOptions } from "@/utils/smart-search";
import { tokens } from "@/lib/tokens";
import type { ClubListFilters } from "@/lib/query/keys";

type Props = {
  options: SmartSearchOptions;
  onApply: (filters: Partial<ClubListFilters>) => void;
};

/**
 * Describe what you want in a sentence and the box fills the filters in.
 *
 * Parsing runs locally — see `parseSmartSearch`. The summary underneath is not
 * decoration: a search box that silently rewrites six filters is alarming
 * unless it tells you what it did, and every filter it sets stays visible and
 * editable in the panel below.
 */
export default function SmartSearchBar({ options, onApply }: Props) {
  const [query, setQuery] = useState("");
  const [summary, setSummary] = useState<string | null>(null);

  const run = () => {
    const text = query.trim();
    if (!text) return;
    const { summary: readback, ...filters } = parseSmartSearch(text, options);
    setSummary(readback);
    onApply(filters);
  };

  const clear = () => {
    setQuery("");
    setSummary(null);
  };

  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ alignItems: "stretch" }}>
        <TextField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
          placeholder="Try &quot;Warhammer clubs near Oxford within 20 miles&quot;"
          fullWidth
          slotProps={{
            // aria-label on TextField lands on the wrapper, not the <input>, so
            // the field ends up with no accessible name.
            htmlInput: { "aria-label": "Describe the club you are looking for" },
            input: {
              startAdornment: (
                <AutoAwesomeIcon aria-hidden sx={{ fontSize: 18, color: tokens.brass, mr: 1, flexShrink: 0 }} />
              ),
            },
          }}
        />
        <Button variant="contained" onClick={run} disabled={!query.trim()} sx={{ flexShrink: 0 }}>
          Search
        </Button>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        Describe the club you want and we will set the filters for you.
      </Typography>

      {summary ? (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "flex-start",
            backgroundColor: tokens.brandSoft,
            border: `1px solid ${tokens.brand}33`,
            borderRadius: 1,
            px: 1.5,
            py: 1,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: tokens.brandDeep, fontFamily: "var(--font-display)" }}>
              {summary}
            </Typography>
          </Box>
          <IconButton size="small" onClick={clear} aria-label="Dismiss search summary" sx={{ mt: -0.5, mr: -0.5 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
      ) : null}
    </Stack>
  );
}
