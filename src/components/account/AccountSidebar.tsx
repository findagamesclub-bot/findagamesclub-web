"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { usePathname } from "next/navigation";
import CloseIcon from "@mui/icons-material/Close";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import AccountNavList from "./AccountNavList";
import { currentItem } from "./account-nav";
import { display, mono, tokens } from "@/lib/tokens";
import type { AccountCounts } from "@/services/dashboard.service";

/**
 * The account's own navigation.
 *
 * A sidebar rather than tabs: eleven sections do not fit a strip, and a tab bar
 * that scrolls sideways hides half of itself. It also keeps every section
 * inside one shell — tickets used to open a page with no account navigation on
 * it at all, so getting back meant the browser's back button.
 *
 * On a phone it is a drawer, opened from a row naming the section you are on.
 * Two earlier attempts were worse and both were the client's to spot: a 168px
 * box with its own scrollbar showing two and a half of eleven sections, then
 * an inline list that pushed the page a screen and a half down to make room
 * for itself. Navigation is not content; it should cost a row when shut and
 * cover the page when open, which is what the site header's own menu does.
 *
 * From the left, where the sidebar lives on a wide screen, rather than from
 * the right like the header's. They are different navigations and the side
 * they arrive from says which one you opened.
 */
export default function AccountSidebar({ counts }: { counts: AccountCounts }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Which page the drawer was opened on. Following a link changes the path
  // while this component stays mounted in the layout, so comparing the two
  // shuts it on navigation without an effect watching the router.
  const [openedAt, setOpenedAt] = useState(pathname);
  const showing = open && openedAt === pathname;

  const here = currentItem(counts, pathname);
  const Icon = here?.icon;

  return (
    <>
      <ButtonBase
        onClick={() => { setOpenedAt(pathname); setOpen(true); }}
        aria-haspopup="dialog"
        aria-expanded={showing}
        sx={{ display: { xs: "flex", md: "none" }, width: "100%",
              justifyContent: "flex-start", gap: 1.25, px: 1.5, py: 1.25,
              borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
              backgroundColor: tokens.paper, color: tokens.ink }}>
        {Icon ? <Icon sx={{ fontSize: 19, color: tokens.brass, flexShrink: 0 }} /> : null}
        <Typography sx={{ flex: 1, textAlign: "left", fontFamily: display,
                          fontSize: "0.95rem", fontWeight: 700 }}>
          {here?.label ?? "Your account"}
        </Typography>
        <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: tokens.inkMuted }}>
          SECTIONS
        </Typography>
        <MenuOpenIcon sx={{ fontSize: 20, color: tokens.inkMuted, flexShrink: 0 }} />
      </ButtonBase>

      <Drawer
        anchor="left"
        open={showing}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { width: 288, px: 2, py: 1.5 } } }}
      >
        <Stack direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                            letterSpacing: "0.12em", color: tokens.inkMuted, pl: 1.5 }}>
            YOUR ACCOUNT
          </Typography>
          <IconButton onClick={() => setOpen(false)} aria-label="Close sections">
            <CloseIcon />
          </IconButton>
        </Stack>
        <AccountNavList counts={counts} onNavigate={() => setOpen(false)} />
      </Drawer>

      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <AccountNavList counts={counts} />
      </Box>
    </>
  );
}
