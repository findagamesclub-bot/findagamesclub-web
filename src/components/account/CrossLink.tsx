import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { tokens } from "@/lib/tokens";

/**
 * A pointer from one account page to the one that continues the story.
 *
 * Bookings and games are two halves of the same thing, and so are memberships
 * and loyalty. Somebody who finishes reading one should not have to guess that
 * the other exists.
 */
export default function CrossLink({
  href, title, body, alert = false,
}: {
  href: string;
  title: string;
  body: string;
  /** Draws the eye when there is something waiting on the other side. */
  alert?: boolean;
}) {
  return (
    <NextLink href={href} style={{ textDecoration: "none" }}>
      <Stack direction="row" spacing={1.5}
        sx={{ mt: 2.5, px: 2, py: 1.75, borderRadius: 2, alignItems: "center",
              border: `1px solid ${alert ? tokens.brass : tokens.rule}`,
              backgroundColor: alert ? tokens.brassSoft : tokens.paper,
              transition: "border-color 140ms ease",
              "&:hover": { borderColor: tokens.brass } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ color: alert ? "#5c4310" : tokens.ink }}>
            {title}
          </Typography>
          <Typography variant="body2"
            sx={{ color: alert ? "#5c4310" : tokens.inkMuted }}>
            {body}
          </Typography>
        </Box>
        <ArrowForwardIcon sx={{ fontSize: 18, color: alert ? "#5c4310" : tokens.inkMuted,
                                flexShrink: 0 }} />
      </Stack>
    </NextLink>
  );
}
