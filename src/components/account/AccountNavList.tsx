"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { accountGroups, isOn } from "./account-nav";
import { display, mono, tokens } from "@/lib/tokens";
import type { AccountCounts } from "@/services/dashboard.service";

/**
 * The clicked item, while the section it points at is still coming.
 *
 * Has to be a child of the Link to read its status. It replaces the count
 * rather than sitting beside it, so the row does not change width mid-click.
 */
function Pending({ fallback }: { fallback: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return pending
    ? <CircularProgress size={14} thickness={5} sx={{ color: tokens.brass, flexShrink: 0 }} />
    : <>{fallback}</>;
}

/** The grouped list itself. Rendered in the desktop column and in the phone drawer. */
export default function AccountNavList({
  counts, onNavigate,
}: {
  counts: AccountCounts;
  /** Shuts the drawer the moment a section is chosen. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <Stack component="nav" aria-label="Your account" spacing={2.5}>
      {accountGroups(counts).map((group) => (
        <Box key={group.title}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                            letterSpacing: "0.12em", color: tokens.inkMuted,
                            px: 1.5, pb: 0.875 }}>
            {group.title.toUpperCase()}
          </Typography>

          <Stack spacing={0.25}>
            {group.items.map((item) => {
              const on = isOn(item.href, pathname);
              const Icon = item.icon;

              const badge = item.count ? (
                <Box sx={{ minWidth: 20, px: 0.75, height: 19, borderRadius: 999,
                           display: "grid", placeItems: "center", flexShrink: 0,
                           backgroundColor: item.alert ? tokens.danger : tokens.rule,
                           color: item.alert ? "#fff" : tokens.inkMuted }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                                    fontWeight: 700, lineHeight: 1 }}>
                    {item.count}
                  </Typography>
                </Box>
              ) : null;

              return (
                <NextLink key={item.label} href={item.href} onClick={onNavigate}
                  style={{ textDecoration: "none", color: "inherit" }}>
                  <Stack direction="row" spacing={1.25}
                    sx={{
                      alignItems: "center", px: 1.5, py: 1, borderRadius: 1.5,
                      color: tokens.ink,
                      backgroundColor: on ? tokens.brassSoft : "transparent",
                      cursor: "pointer",
                      "&:hover": { backgroundColor: on ? tokens.brassSoft : tokens.surface },
                    }}>
                    <Icon sx={{ fontSize: 19, flexShrink: 0,
                                color: on ? tokens.brass : "inherit" }} />
                    <Typography sx={{ flex: 1, fontFamily: display, fontSize: "0.95rem",
                                      letterSpacing: "0.005em",
                                      fontWeight: on ? 700 : 500 }}>
                      {item.label}
                    </Typography>
                    <Pending fallback={badge} />
                  </Stack>
                </NextLink>
              );
            })}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
