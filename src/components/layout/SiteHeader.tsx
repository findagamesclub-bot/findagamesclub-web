"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import BrandMark from "./BrandMark";
import { headerHeight, tokens } from "@/lib/tokens";

export type Viewer = { fullName: string; email: string; role: string } | null;

/**
 * The full navigation the finished product has. Sections that are not built yet
 * are shown but not clickable, so the shape of the site is visible without
 * offering links that go nowhere.
 */
type NavItem = { label: string; href?: string; milestone?: number };

const NAV: NavItem[] = [
  { label: "Directory", href: "/clubs" },
  { label: "Events", milestone: 2 },
  { label: "Map", milestone: 2 },
  { label: "Meta Tracker", milestone: 3 },
  { label: "My Clubs", milestone: 3 },
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

export default function SiteHeader({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const renderNav = (onNavigate?: () => void) =>
    NAV.map((item) =>
      item.href ? (
        <Box
          key={item.label}
          component={Link}
          href={item.href}
          onClick={onNavigate}
          aria-current={isActive(item.href) ? "page" : undefined}
          sx={linkSx(isActive(item.href))}
        >
          {item.label}
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
              <AccountMenu viewer={viewer} />
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
