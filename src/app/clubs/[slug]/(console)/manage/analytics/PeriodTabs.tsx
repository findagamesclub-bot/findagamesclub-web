"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import LinkPending from "@/components/ui/LinkPending";
import { type PeriodKey } from "@/utils/analytics-period";
import { mono, tokens } from "@/lib/tokens";

/**
 * One range picker, used twice on the page.
 *
 * Legacy keeps a separate range for the trend so a club can read revenue over a
 * year while reading signups over three months. Collapsing them into one global
 * control would be simpler and would take that away, so each section owns its
 * own key in the address and this renders whichever one it is given.
 *
 * Links rather than state, like every other filter here, so a window is a URL
 * somebody can send and the back button works.
 *
 * The addresses arrive built, as plain strings. Taking a `(next) => string`
 * instead read better and threw at request time on every load: a function
 * cannot cross into a client component, and neither `tsc` nor `next build`
 * says so. Only opening the page does.
 *
 * The wait shows on the button that was pressed, through `useLinkStatus`, and
 * not as a `BusyOverlay`. Two reasons, both of them bugs this shipped with: the
 * overlay was driven by an `onClick` that set it true and nothing ever set it
 * false, so it stayed up for good; and it covered the tab row underneath rather
 * than the buttons it belonged to, because a pill centred on a 44px-tall strip
 * spills past it. Feedback belongs on the control you touched.
 */
export default function PeriodTabs({
  label, value, options,
}: {
  label: string;
  value: PeriodKey;
  /** Every window and the address that selects it, built on the server. */
  options: { key: string; label: string; href: string }[];
}) {
  return (
    <Stack direction="row" spacing={1.5}
      sx={{ alignItems: "center", flexWrap: "wrap", mb: 1.5 }} useFlexGap>
      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        {label}
      </Typography>

      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }} useFlexGap>
        {options.map((period) => {
          const on = period.key === value;
          return (
            <Box key={period.key} component={NextLink} href={period.href}
              scroll={false}
              aria-current={on ? "true" : undefined}
              sx={{
                // So the pending spinner can centre itself on this button.
                position: "relative",
                textDecoration: "none",
                // 44px is the floor a finger needs, and these sit in a row
                // of five on a 360px screen, which is exactly where a 34px
                // target gets missed.
                minHeight: 44, display: "inline-flex", alignItems: "center",
                px: 1.5, borderRadius: 1,
                fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                border: `1px solid ${on ? tokens.brass : tokens.rule}`,
                backgroundColor: on ? tokens.brass : tokens.paper,
                color: on ? "#FFFFFF" : tokens.inkMuted,
                "&:hover": { borderColor: tokens.brass },
              }}>
              <LinkPending overlay size={14} colour={on ? "#FFFFFF" : tokens.brass}>
                {period.label}
              </LinkPending>
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}
