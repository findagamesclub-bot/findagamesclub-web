"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { nextSearch, withSearch } from "@/utils/filter-url";
import { LENSES, DEFAULT_LENS } from "@/utils/meta-lens";
import { tokens } from "@/lib/tokens";

export type Scope = { clubId: number; name: string; tracked: number };

/**
 * Which slice of the meta, and how far back.
 *
 * Both live in the address, so a narrowed tracker is a link somebody can send
 * to the person they are playing on Thursday. Built on the address it finds
 * rather than from scratch, or changing the window would throw the open tab
 * away, which is the bug `filter-url.ts` exists to stop.
 *
 * The scope picker offers only the clubs this reader is in, which is legacy's
 * own rule and is enforced again in SQL: `meta_scope_allowed` refuses a club
 * you are not in, whatever the address says.
 */
export default function MetaFilters({
  scope, lens, scopes, onBusy,
}: {
  scope: string;
  lens: string;
  scopes: Scope[];
  onBusy?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [navigating, startNav] = useTransition();

  // From the transition, never from the click: a click that starts a
  // navigation has no idea when it ends, which is how an overlay once stayed
  // up for the rest of the session.
  const tell = useRef(onBusy);
  // Written in an effect, not during render: a ref assigned while rendering is
  // the thing React's own rule warns about, and it is not needed here. Both
  // effects run after the same render, in order, so this one is up to date
  // before the one below reads it.
  useEffect(() => { tell.current = onBusy; });
  useEffect(() => { tell.current?.(navigating); }, [navigating]);

  const go = (changes: Record<string, string>) => {
    const search = nextSearch(current, { scope, lens, ...changes },
      { scope: "", lens: DEFAULT_LENS });
    startNav(() => router.replace(withSearch(pathname, search), { scroll: false }));
  };

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
      sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2,
            border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      {/* `slotProps.inputLabel.shrink`, because the site-wide view is the empty
          value and MUI reads an empty select as unset: the label sat inside
          the box as a placeholder and "Every club" never showed, so the one
          scope most people are on looked like a field nobody had filled in. */}
      <TextField select size="small" label="Scope" value={scope} fullWidth
        onChange={(event) => go({ scope: event.target.value })}
        // Both halves are needed. `shrink` floats the label off an empty
        // value; `displayEmpty` is what makes the select render the matching
        // item rather than a blank box. With only the first, picking "Every
        // club" left the field looking unset, which is the one scope most
        // people are on.
        slotProps={{ inputLabel: { shrink: true },
                     select: { displayEmpty: true } }}
        sx={{ maxWidth: { sm: 320 } }}>
        <MenuItem value="">Every club</MenuItem>
        {scopes.map((one) => (
          <MenuItem key={one.clubId} value={String(one.clubId)}>
            {`${one.name} · ${one.tracked}`}
          </MenuItem>
        ))}
      </TextField>

      <TextField select size="small" label="Window" value={lens} fullWidth
        onChange={(event) => go({ lens: event.target.value })}
        sx={{ maxWidth: { sm: 220 } }}>
        {LENSES.map((one) => (
          <MenuItem key={one.value} value={one.value}>{one.label}</MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
