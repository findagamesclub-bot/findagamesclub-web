"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import NextLink from "next/link";
import { tokens } from "@/lib/tokens";

export type NavTabItem = {
  value: string;
  label: string;
  href: string;
  /** Shown after the label in muted type. Zero renders nothing. */
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
  /** Native tooltip, for a tab somebody is not allowed to open. */
  title?: string;
};

/**
 * Tab navigation, one implementation for the whole site.
 *
 * Everything here used to be hand-rolled per page, and each copy drifted
 * smaller: the board's categories were 11px in a 40px-tall strip, well under
 * the 44px minimum a finger needs and below the 16px a phone needs to avoid
 * zooming. MUI's Tabs bring the keyboard handling, the roving tabindex and the
 * scroll buttons with them, none of which the hand-rolled versions had.
 *
 * Links, not buttons: each tab is a real URL, so it can be shared, opened in a
 * new tab and reached by a back button. `scroll={false}` because a tab changes
 * what is on the page, not which page you are on.
 */
export default function NavTabs({
  tabs, value, accent = tokens.brass, ariaLabel, dense = false,
}: {
  tabs: NavTabItem[];
  value: string;
  /** Indicator and selected colour. Clubs pass their faction. */
  accent?: string;
  ariaLabel: string;
  /** Slightly tighter, for a strip sitting inside a panel. */
  dense?: boolean;
}) {
  return (
    <Tabs
      value={value}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      aria-label={ariaLabel}
      sx={{
        borderBottom: `1px solid ${tokens.rule}`,
        minHeight: dense ? 46 : 52,
        "& .MuiTabs-indicator": { backgroundColor: accent, height: 3 },
        "& .MuiTabs-scrollButtons.Mui-disabled": { opacity: 0.3 },
      }}
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.value}
          value={tab.value}
          component={NextLink}
          href={tab.href}
          scroll={false}
          disabled={tab.disabled}
          title={tab.title}
          icon={tab.icon as never}
          iconPosition={tab.icon ? "start" : undefined}
          label={
            tab.count ? (
              <Box component="span">
                {tab.label}{" "}
                <Box component="span" sx={{ color: tokens.inkMuted, fontWeight: 500 }}>
                  {tab.count}
                </Box>
              </Box>
            ) : (
              tab.label
            )
          }
          sx={{
            // 44px is the floor a finger needs; 48 leaves room for the label to
            // sit on the type scale rather than being squeezed to fit.
            minHeight: dense ? 46 : 52,
            px: { xs: 1.75, sm: 2.25 },
            textTransform: "none",
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: { xs: "0.95rem", sm: "1rem" },
            color: tokens.inkMuted,
            "&.Mui-selected": { color: tokens.ink },
            "&:hover": { color: tokens.ink },
            "&.Mui-disabled": { color: tokens.rule },
          }}
        />
      ))}
    </Tabs>
  );
}
