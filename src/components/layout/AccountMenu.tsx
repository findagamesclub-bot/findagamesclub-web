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
import SignOutConfirm from "./SignOutConfirm";
import { accountLinks, type ManageLink } from "./account-links";
import type { Viewer } from "./SiteHeader";

export default function AccountMenu({ viewer, unreadMessages = 0, manage = null }:
  { viewer: NonNullable<Viewer>; unreadMessages?: number; manage?: ManageLink }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [asking, setAsking] = useState(false);

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
        {accountLinks(viewer.id, manage, viewer.role === "admin").map((link) => (
          <MenuItem key={link.href} component={Link} href={link.href}
            onClick={() => setAnchor(null)}>
            {link.badge === "messages" && unreadMessages ? (
              <Stack direction="row" spacing={1.5}
                sx={{ alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <span>{link.label}</span>
                <Box sx={{ minWidth: 20, height: 20, px: 0.75, borderRadius: 999,
                           display: "grid", placeItems: "center",
                           backgroundColor: tokens.danger, color: "#fff" }}>
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                                    fontWeight: 700, lineHeight: 1 }}>
                    {unreadMessages}
                  </Typography>
                </Box>
              </Stack>
            ) : link.label}
          </MenuItem>
        ))}
        <Divider />
        {/* Closes the menu first: the dialog cannot live inside it, because a
            closed MUI menu unmounts its children. */}
        <MenuItem onClick={() => { setAnchor(null); setAsking(true); }}
          sx={{ width: "100%" }}>
          Sign out
        </MenuItem>
      </Menu>

      <SignOutConfirm open={asking} onClose={() => setAsking(false)} />
    </>
  );
}
