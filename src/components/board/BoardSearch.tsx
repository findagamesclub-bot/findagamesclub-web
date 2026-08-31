"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { tokens } from "@/lib/tokens";

/**
 * Search across the whole board, not just the page on screen.
 *
 * The term is a URL parameter because the query runs in the database: a club
 * with a thousand threads never has them all in the browser to filter. Which
 * also makes a search shareable and survivable by the back button.
 */
export default function BoardSearch({
  slug, category, initial,
}: {
  slug: string;
  category?: string | null;
  initial: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(initial);
  const [busy, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clears on unmount so a pending keystroke cannot navigate a page that has
  // already gone.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function go(next: string) {
    setTerm(next);
    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (next.trim()) params.set("q", next.trim());
      const query = params.toString();
      start(() => router.replace(`/clubs/${slug}/board${query ? `?${query}` : ""}`,
                                 { scroll: false }));
    }, 300);
  }

  return (
    <TextField
      size="small"
      fullWidth
      value={term}
      onChange={(event) => go(event.target.value)}
      placeholder="Search threads"
      aria-label="Search threads"
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: tokens.inkMuted }} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {busy ? <CircularProgress size={16} /> : null}
              {!busy && term ? (
                <IconButton size="small" aria-label="Clear the search" onClick={() => go("")}>
                  <CloseIcon sx={{ fontSize: 17 }} />
                </IconButton>
              ) : null}
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
