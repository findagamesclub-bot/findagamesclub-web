"use client";

import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens } from "@/lib/theme";
import { initialsOf } from "@/utils/format";
import type { Viewer } from "./SiteHeader";

export default function AccountMenu({ viewer }: { viewer: NonNullable<Viewer> }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Button
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        sx={{ gap: 1, color: tokens.ink }}
      >
        <Avatar sx={{ width: 28, height: 28, fontSize: "0.75rem", bgcolor: tokens.brand }}>
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
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
            {viewer.email}
          </Typography>
        </Stack>
        <Divider />
        {viewer.role === "admin" ? (
          <MenuItem disabled sx={{ fontSize: "0.85rem" }}>Admin tools · milestone 3</MenuItem>
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
