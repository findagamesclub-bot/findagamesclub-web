"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LogoutIcon from "@mui/icons-material/Logout";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import EventIcon from "@mui/icons-material/Event";
import InsightsIcon from "@mui/icons-material/Insights";
import NextLink from "next/link";
import { useState } from "react";
import SideNav from "@/components/ui/SideNav";
import SignOutConfirm from "@/components/layout/SignOutConfirm";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { adminGroups, type AdminCounts } from "./admin-nav";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * The site as everybody else sees it, from inside the console.
 *
 * The same three the client named ("directory, events, meta tracker"), which
 * are three of the items the header offers everywhere the header is drawn.
 * Map is left off: it is the directory in another view and the directory is
 * one press away from it.
 */
const PUBLIC_LINKS = [
  { href: "/clubs", label: "Directory", Icon: TravelExploreIcon },
  { href: "/events", label: "Events", Icon: EventIcon },
  { href: "/meta-tracker", label: "Meta Tracker", Icon: InsightsIcon },
];

/**
 * The admin console's navigation. Same shell as the account and the club.
 *
 * It carries more than those two because the console hides the site header:
 * who is signed in, and the way back out to the public site, have nowhere
 * else to be on this screen.
 */
export default function AdminSidebar({
  counts, viewerId, viewerName,
}: {
  counts: AdminCounts;
  viewerId: string;
  viewerName: string;
}) {
  // The rail is the only place an admin sees either number, and both change
  // while it is on screen: a message arrives, or they read one and the notice
  // about it clears under the page they are already on.
  const [asking, setAsking] = useState(false);
  const live = useUnreadCounts(viewerId, {
    notifications: counts.unreadNotifications ?? 0,
    messages: counts.unreadMessages ?? 0,
  });

  return (
    <>
    <SideNav
      groups={adminGroups(
        { ...counts, unreadNotifications: live.notifications, unreadMessages: live.messages },
      )}
      heading="Site admin"
      fallbackLabel="Site admin"
      aside={
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", px: 1.5 }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 1, flexShrink: 0,
                     display: "grid", placeItems: "center",
                     backgroundColor: tokens.brand, color: "#fff" }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.78rem", fontWeight: 700 }}>
              {initials(viewerName)}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 700,
                              lineHeight: 1.25, overflowWrap: "anywhere" }}>
              {viewerName}
            </Typography>
            <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                              letterSpacing: "0.1em", color: tokens.inkMuted }}>
              SITE ADMIN
            </Typography>
          </Box>
        </Stack>
      }
      footer={
        <Stack spacing={1.25}>
        {/* The way out of the console, and the one place on the site where
            the header is hidden, so this is where its links have to be.

            Three rather than one. The header carries Directory, Events and the
            Meta Tracker for an admin now, the way it does for everybody else;
            leaving the rail offering only the directory would make the console
            the single screen in the app with less of the site reachable from
            it, which is the gap the client found from the other side.

            Written in the rail's own shape, a heading and its rows, rather
            than squeezed onto one line: at 248px "Directory · Events · Meta
            Tracker" wraps mid-list and the separators disappear. Its heading
            names where they go, so three site links at the foot of a console
            rail cannot read as three more console sections. */}
        <Stack spacing={0.9} sx={{ px: 1.5 }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                            letterSpacing: "0.12em", color: tokens.inkMuted }}>
            THE PUBLIC SITE
          </Typography>
          {PUBLIC_LINKS.map((link) => (
            <NextLink key={link.href} href={link.href} style={{ textDecoration: "none" }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <link.Icon sx={{ fontSize: 17, color: tokens.inkMuted, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: tokens.inkMuted,
                                                  "&:hover": { color: tokens.ink } }}>
                  {link.label}
                </Typography>
              </Stack>
            </NextLink>
          ))}
        </Stack>
        <Box sx={{ px: 1.5 }}>
          <Button onClick={() => setAsking(true)} fullWidth variant="outlined" size="small"
            startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
            sx={{ color: tokens.inkMuted, borderColor: tokens.rule,
                  "&:hover": { borderColor: tokens.ink, color: tokens.ink } }}>
            Sign out
          </Button>
        </Box>
        </Stack>
      }
    />
    <SignOutConfirm open={asking} onClose={() => setAsking(false)} />
    </>
  );
}

/** Two letters, so a long name still fits the plate. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "SA";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}
