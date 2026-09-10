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
import SideNavList from "./SideNavList";
import { currentItem, type NavGroup } from "./side-nav";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * A section list beside the page on a wide screen, a drawer on a phone.
 *
 * On a phone it costs one row shut and covers the page open, like the header's
 * own menu. Two earlier attempts were worse and the client caught both: a
 * 168px box with its own scrollbar showing two and a half of eleven sections,
 * then an inline list that pushed the page a screen and a half down to make
 * room for itself. A nested scroll is the wrong answer to "this list is long",
 * and so is pushing the content the reader came for off the bottom.
 *
 * From the left, where the sidebar lives on a wide screen, rather than from the
 * right like the header's. They are different navigations and the side they
 * arrive from says which one you opened.
 */
export default function SideNav({
  groups, heading, fallbackLabel, aside, footer,
}: {
  groups: NavGroup[];
  /** Names the whole navigation: "Your account", "Didcot Wargames". */
  heading: string;
  /** The trigger's label before any section matches. */
  fallbackLabel: string;
  /** Sits above the list on both widths. The console puts the club here. */
  aside?: React.ReactNode;
  /**
   * Sits under the list on both widths. The admin console puts signing out
   * here, because its header is hidden and there is nowhere else for it.
   */
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Which page the drawer was opened on. Following a link changes the path
  // while this component stays mounted in the layout, so comparing the two
  // shuts it on navigation without an effect watching the router.
  const [openedAt, setOpenedAt] = useState(pathname);
  const showing = open && openedAt === pathname;

  const here = currentItem(groups, pathname);
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
          {here?.label ?? fallbackLabel}
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
                            letterSpacing: "0.12em", color: tokens.inkMuted, pl: 1.5,
                            minWidth: 0, overflowWrap: "anywhere" }}>
            {heading.toUpperCase()}
          </Typography>
          <IconButton onClick={() => setOpen(false)} aria-label="Close sections">
            <CloseIcon />
          </IconButton>
        </Stack>
        {aside ? <Box sx={{ mb: 2 }}>{aside}</Box> : null}
        <SideNavList groups={groups} ariaLabel={heading} onNavigate={() => setOpen(false)} />
        {footer ? <Box sx={{ mt: 3 }}>{footer}</Box> : null}
      </Drawer>

      <Box sx={{ display: { xs: "none", md: "block" } }}>
        {aside ? <Box sx={{ mb: 2.5 }}>{aside}</Box> : null}
        <SideNavList groups={groups} ariaLabel={heading} />
        {footer ? <Box sx={{ mt: 3 }}>{footer}</Box> : null}
      </Box>
    </>
  );
}
