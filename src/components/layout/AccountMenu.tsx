"use client";

import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "next/link";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens } from "@/lib/theme";
import { initialsOf } from "@/utils/format";
import type { Viewer } from "./SiteHeader";

export default function AccountMenu({ viewer, unreadMessages = 0 }:
  { viewer: NonNullable<Viewer>; unreadMessages?: number }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Button
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        sx={{ gap: 1, color: tokens.ink }}
      >
        <Avatar sx={{ width: 30, height: 30, fontSize: "0.82rem", bgcolor: tokens.brand }}>
          {initialsOf(viewer.fullName || viewer.email)}
        </Avatar>
        Account
      </Button>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 220, mt: 1 } } }}
      >
        <Stack sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">{viewer.fullName || "Your account"}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.9rem" }}>
            {viewer.email}
          </Typography>
        </Stack>
        <Divider />
        {/* The way in. Everything the account holds is one click inside it,
            so listing those sections here as well only makes two places to
            keep in step. */}
        <MenuItem component={Link} href="/account" onClick={() => setAnchor(null)}>
          Dashboard
        </MenuItem>
        {/* Not in the sidebar, and not the same thing as the profile editor:
            this is the page other members see. */}
        <MenuItem component={Link} href={`/members/${viewer.id}`} onClick={() => setAnchor(null)}>
          Your public profile
        </MenuItem>
        {/* Kept for its unread count, which is the one thing worth knowing
            from a page that is nothing to do with the account. */}
        <MenuItem component={Link} href="/account/messages" onClick={() => setAnchor(null)}>
          <Stack direction="row" spacing={1.5}
            sx={{ alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <span>Messages</span>
            {unreadMessages ? (
              <Box sx={{ minWidth: 20, height: 20, px: 0.75, borderRadius: 999,
                         display: "grid", placeItems: "center",
                         backgroundColor: tokens.danger, color: "#fff" }}>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                                  fontWeight: 700, lineHeight: 1 }}>
                  {unreadMessages}
                </Typography>
              </Box>
            ) : null}
          </Stack>
        </MenuItem>
        <Divider />
        {viewer.role === "admin" ? (
          <MenuItem disabled sx={{ fontSize: "0.95rem" }}>Admin tools · milestone 3</MenuItem>
        ) : null}
        {/* MenuItem's own `action` prop is a ref, so the form wraps it instead. */}
        <Box component="form" action="/auth/sign-out" method="post">
          <MenuItem component="button" type="submit" sx={{ width: "100%" }}>
            Sign out
          </MenuItem>
        </Box>
      </Menu>
    </>
  );
}
