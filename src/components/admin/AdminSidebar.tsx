"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LogoutIcon from "@mui/icons-material/Logout";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import NextLink from "next/link";
import { useState } from "react";
import SideNav from "@/components/ui/SideNav";
import SignOutConfirm from "@/components/layout/SignOutConfirm";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { adminGroups, type AdminCounts } from "./admin-nav";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * The admin console's navigation. Same shell as the account and the club.
 *
 * It carries more than those two because the console hides the site header:
 * who is signed in, and the way out, have nowhere else to be.
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
        {/* The one way out of the console, kept away from the sections so it
            does not read as one of them. */}
        <Box sx={{ px: 1.5 }}>
          <NextLink href="/clubs" style={{ textDecoration: "none" }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <TravelExploreIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
              <Typography variant="body2" sx={{ color: tokens.inkMuted,
                                                "&:hover": { color: tokens.ink } }}>
                Club directory
              </Typography>
            </Stack>
          </NextLink>
        </Box>
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
