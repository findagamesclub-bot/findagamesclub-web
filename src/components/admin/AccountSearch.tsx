"use client";

import { useTransition } from "react";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import SearchIcon from "@mui/icons-material/Search";
import { usePathname, useRouter } from "next/navigation";
import BusyOverlay from "@/components/ui/BusyOverlay";
import { useDebouncedField } from "@/hooks/useDebouncedCallback";
import { tokens } from "@/lib/tokens";

const TABS = [
  { value: "all", label: "Everyone" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "admin", label: "Admins" },
  // Facts about the club rather than the account, in one bar with the rest
  // because the question is asked from this screen either way. The cost is
  // that they cannot be combined: there is no way to ask for suspended
  // managers. If that is ever wanted, role comes out into its own control.
  { value: "owner", label: "Owners" },
  { value: "manager", label: "Managers" },
  { value: "helper", label: "Helpers" },
  { value: "member", label: "Members" },
];

/**
 * Search and filter, held in the URL.
 *
 * The list is paged on the server, so the query has to live somewhere the
 * server can read it. That also makes a search shareable and survivable: an
 * admin who opens an account and presses back lands on the same page of the
 * same search rather than at the top of everything.
 *
 * The overlay is not decoration. Every filter in this app shows one, because
 * without it a slow query looks like a filter that did nothing.
 */
export default function AccountSearch({
  query, status, children,
}: {
  query: string;
  status: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const go = (nextQuery: string, nextStatus: string) => {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextStatus !== "all") params.set("status", nextStatus);
    const rest = params.toString();
    startTransition(() => router.replace(`${pathname}${rest ? `?${rest}` : ""}`));
  };

  // The hook holds the draft and syncs it back when the URL changes from
  // somewhere else, such as the back button.
  const [typed, setTyped] = useDebouncedField(query, (next) => go(next, status));

  return (
    <>
      <Stack spacing={2} sx={{ mb: 2.5 }}>
        <TextField
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Search by name or email"
          fullWidth
          slotProps={{
            htmlInput: { "aria-label": "Search accounts" },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: tokens.inkMuted }} />
                </InputAdornment>
              ),
            },
          }}
        />

        <Box>
          <Tabs
            value={status}
            onChange={(_, next) => go(typed, String(next))}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="Filter accounts"
            sx={{ borderBottom: `1px solid ${tokens.rule}`,
                  "& .MuiTabs-indicator": { backgroundColor: tokens.brass } }}
          >
            {TABS.map((tab) => (
              <Tab key={tab.value} value={tab.value} label={tab.label}
                sx={{ textTransform: "none" }} />
            ))}
          </Tabs>
        </Box>
      </Stack>

      <BusyOverlay busy={pending} label="Searching" variant="dim">
        {children}
      </BusyOverlay>
    </>
  );
}
