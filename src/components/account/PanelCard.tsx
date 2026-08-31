import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import type { SvgIconComponent } from "@mui/icons-material";
import { mono, tokens } from "@/lib/tokens";

/**
 * One panel of the dashboard.
 *
 * Every panel is the same object: a labelled head, one figure that answers the
 * panel's question at a glance, the detail under it, and a way through to the
 * full page. A dashboard where each card invents its own shape is a collage.
 */
export default function PanelCard({
  title, icon: Icon, figure, caption, href, linkLabel, span = 1, children,
}: {
  title: string;
  icon: SvgIconComponent;
  /** The single number this panel is about. */
  figure?: number | string;
  caption?: string;
  href?: string;
  linkLabel?: string;
  /** Columns to take on a wide screen. */
  span?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <Stack
      component="section"
      sx={{
        gridColumn: { md: `span ${span}` },
        borderRadius: 2,
        border: `1px solid ${tokens.rule}`,
        backgroundColor: tokens.paper,
        overflow: "hidden",
      }}
    >
      <Stack direction="row" spacing={1.5}
        sx={{ px: 2.25, py: 1.75, alignItems: "center",
              borderBottom: `1px solid ${tokens.rule}` }}>
        <Icon aria-hidden sx={{ fontSize: 18, color: tokens.brass, flexShrink: 0 }} />
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                          letterSpacing: "0.12em", color: tokens.inkMuted, flex: 1 }}>
          {title.toUpperCase()}
        </Typography>
        {figure !== undefined ? (
          <Typography sx={{ fontFamily: mono, fontSize: "1.1rem", fontWeight: 700,
                            lineHeight: 1, color: tokens.ink }}>
            {figure}
          </Typography>
        ) : null}
      </Stack>

      <Box sx={{ px: 2.25, py: 2, flex: 1 }}>
        {caption ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 1.5 }}>
            {caption}
          </Typography>
        ) : null}
        {children}
      </Box>

      {href ? (
        <NextLink href={href} style={{ textDecoration: "none" }}>
          <Stack direction="row" spacing={0.75}
            sx={{ px: 2.25, py: 1.5, alignItems: "center",
                  borderTop: `1px solid ${tokens.rule}`,
                  backgroundColor: tokens.surface,
                  "&:hover": { backgroundColor: tokens.brassSoft } }}>
            <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
              {linkLabel ?? "Open"}
            </Typography>
            <ArrowForwardIcon sx={{ fontSize: 16, color: tokens.brand }} />
          </Stack>
        </NextLink>
      ) : null}
    </Stack>
  );
}
