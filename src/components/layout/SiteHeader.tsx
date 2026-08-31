"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import AccountMenu from "./AccountMenu";
import NotificationBell from "./NotificationBell";
import BrandMark from "./BrandMark";
import { headerHeight, tokens } from "@/lib/tokens";

export type Viewer = { id: string; fullName: string; email: string; role: string } | null;

/**
 * The full navigation the finished product has. Sections that are not built yet
 * are shown but not clickable, so the shape of the site is visible without
 * offering links that go nowhere.
 */
type NavItem = {
  label: string;
  href?: string;
  milestone?: number;
  /**
   * Extra paths this item owns. An event lives at /clubs/x/events/y, so on path
   * alone it lights Directory — but it is an event, and Events is where you
   * came from.
   */
  owns?: RegExp;
  /** Hidden from people who run no club, rather than shown and empty. */
  ownerOnly?: boolean;
};

const NAV: NavItem[] = [
  { label: "Directory", href: "/clubs" },
  { label: "Events", href: "/events", owns: /\/events(\/|$)/ },
  { label: "Map", href: "/clubs?view=map" },
  { label: "Meta Tracker", milestone: 3 },
  { label: "My Clubs", href: "/my-clubs", ownerOnly: true },
];

const linkSx = (active: boolean) => ({
  fontFamily: "var(--font-display)",
  fontSize: "1rem",
  fontWeight: 600,
  whiteSpace: "nowrap",
  textDecoration: "none",
  color: active ? tokens.ink : tokens.inkMuted,
  py: 0.5,
  // Brass marks where you are. It still encodes information rather than decorating.
  borderBottom: `2px solid ${active ? tokens.brass : "transparent"}`,
  "&:hover": { color: tokens.ink },
});

/**
 * A section that exists in the plan but isn't built yet. The muted colour and
 * the tooltip carry that on their own — the "Soon" badge beside every one of
 * them made the header look like a construction site.
 */
function ComingSoon({ label, milestone }: { label: string; milestone: number }) {
  return (
    <Tooltip title={`Arriving in milestone ${milestone}`} placement="bottom">
      <Box
        aria-disabled="true"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          fontFamily: "var(--font-display)",
          fontSize: "1rem",
          fontWeight: 600,
          whiteSpace: "nowrap",
          color: "#9AA8BC",
          py: 0.5,
          cursor: "default",
        }}
      >
        {label}
      </Box>
    </Tooltip>
  );
}

export default function SiteHeader({
  viewer, unreadMessages = 0, ownerTasks = 0, ownsClubs = false, notifications = 0,
}: {
  viewer: Viewer; unreadMessages?: number; ownerTasks?: number;
  ownsClubs?: boolean; notifications?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  /**
   * Directory and Map share the /clubs path and differ only by ?view=map, so a
   * path-only check lit Directory on both. Compare the query too, and only the
   * keys the link itself names — filters in the URL must not unlight the tab.
   */
  const isActive = (item: NavItem) => {
    if (!item.href) return false;

    // A claimed path wins outright, so an event page lights Events rather than
    // Directory even though it sits under /clubs.
    const claimed = NAV.find((n) => n.owns?.test(pathname));
    if (claimed) return claimed.label === item.label;

    const [path, query] = item.href.split("?");
    if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;

    const wanted = new URLSearchParams(query ?? "");
    for (const [key, value] of wanted) {
      if (searchParams.get(key) !== value) return false;
    }
    // Directory and Map share /clubs and differ only by ?view=map.
    if (!query && path === "/clubs" && searchParams.get("view") === "map") return false;
    return true;
  };

  const renderNav = (onNavigate?: () => void) =>
    NAV
      // My Clubs is meaningless to somebody who runs none, so it is absent
      // rather than present and permanently empty.
      .filter((item) => !item.ownerOnly || ownsClubs)
      .map((item) =>
        item.href ? (
          <Box
            key={item.label}
            component={Link}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive(item) ? "page" : undefined}
            sx={linkSx(isActive(item))}
          >
            {item.label}
            {item.ownerOnly && ownerTasks ? (
              <Box component="span" aria-label={`${ownerTasks} waiting`}
                sx={{ ml: 0.75, px: 0.7, py: 0.1, borderRadius: 999, fontSize: "0.68rem",
                      fontFamily: "var(--font-mono)", fontWeight: 700,
                      backgroundColor: tokens.danger, color: "#fff" }}>
                {ownerTasks}
              </Box>
            ) : null}
          </Box>
        ) : (
          <ComingSoon key={item.label} label={item.label} milestone={item.milestone!} />
        ),
      );

  return (
    <AppBar>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ gap: 2, minHeight: headerHeight }}>
          <Box
            component={Link}
            href="/"
            aria-label="FindAGamesClub, home"
            sx={{ display: "inline-flex", alignItems: "center", gap: 1.25, textDecoration: "none" }}
          >
            <BrandMark size={{ xs: 40, md: 56 }} />
            {/* Mixed case with tight tracking, so it reads as a wordmark rather
                than the tracked caps used for labels elsewhere. */}
            <Box
              component="span"
              sx={{
                display: { xs: "none", sm: "block" },
                fontFamily: "var(--font-display)",
                fontSize: "1.32rem",
                fontWeight: 700,
                letterSpacing: "-0.018em",
                color: tokens.brandDeep,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              FindAGamesClub
            </Box>
          </Box>

          <Stack direction="row" spacing={5} sx={{ ml: 4.5, display: { xs: "none", lg: "flex" } }}>
            {renderNav()}
          </Stack>

          <Box sx={{ flex: 1 }} />

          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            {viewer ? (
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <NotificationBell viewerId={viewer.id} initialUnread={notifications} />
                <AccountMenu viewer={viewer} unreadMessages={unreadMessages} />
              </Stack>
            ) : (
              <Stack direction="row" spacing={1}>
                <Button component={Link} href="/auth/sign-in" variant="text">Sign in</Button>
                <Button component={Link} href="/auth/sign-up" variant="contained">Create account</Button>
              </Stack>
            )}
          </Box>

          <IconButton
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            sx={{ display: { xs: "inline-flex", lg: "none" } }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </Container>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 270, p: 2 }}>
          <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 1 }}>
            <IconButton onClick={() => setOpen(false)} aria-label="Close menu"><CloseIcon /></IconButton>
          </Stack>
          <Stack spacing={2}>
            {renderNav(() => setOpen(false))}
            {viewer ? (
              <>
                <Typography variant="overline" color="text.secondary">{viewer.fullName}</Typography>
                <Box component="form" action="/auth/sign-out" method="post">
                  <Button type="submit" variant="outlined" fullWidth>Sign out</Button>
                </Box>
              </>
            ) : (
              <Stack spacing={1}>
                <Button component={Link} href="/auth/sign-in" variant="outlined" fullWidth>Sign in</Button>
                <Button component={Link} href="/auth/sign-up" variant="contained" fullWidth>Create account</Button>
              </Stack>
            )}
          </Stack>
        </Box>
      </Drawer>
    </AppBar>
  );
}
