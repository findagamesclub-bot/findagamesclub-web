import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { tokens } from "@/lib/tokens";

/**
 * Back to where this page hangs off.
 *
 * The club pages get theirs from ClubSectionHeader, which needs a club. Pages
 * in the owner workspace have no club, so they use this rather than a header
 * that would have to invent one.
 */
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <NextLink href={href} style={{ textDecoration: "none" }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.5 }}>
        <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
        <Typography variant="body2"
          sx={{ color: tokens.inkMuted, "&:hover": { color: tokens.ink } }}>
          {label}
        </Typography>
      </Stack>
    </NextLink>
  );
}
