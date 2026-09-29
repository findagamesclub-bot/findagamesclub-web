import NextLink from "next/link";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";

export type Crumb = {
  label: string;
  /** Absent on the last one, which is where you already are. */
  href?: string;
};

/**
 * Where you are, and every way back up.
 *
 * `BackLink` goes up exactly one level, which is right two levels deep and
 * wrong at three: from a list's history the club was two presses away with
 * nothing on the page saying so, and the console rail that would otherwise
 * carry you is only drawn for the club's own team.
 *
 * Plain `next/link` wrapping the type rather than MUI's `component` prop,
 * because this renders from Server Components and a function cannot cross
 * that boundary.
 */
export default function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <Box component="nav" aria-label="Breadcrumb">
      <Stack direction="row" spacing={0.75}
        sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
        {items.map((item, index) => (
          <Stack key={`${item.label}-${index}`} direction="row" spacing={0.75}
            sx={{ alignItems: "center", minWidth: 0 }}>
            {index > 0 ? (
              <Typography aria-hidden
                sx={{ fontFamily: mono, fontSize: "0.8rem", color: tokens.rule }}>
                /
              </Typography>
            ) : null}
            {item.href ? (
              <NextLink href={item.href} style={{ textDecoration: "none" }}>
                <Typography
                  sx={{ fontSize: "0.85rem", color: tokens.inkMuted,
                        "&:hover": { color: tokens.ink, textDecoration: "underline" } }}>
                  {item.label}
                </Typography>
              </NextLink>
            ) : (
              <Typography aria-current="page"
                sx={{ fontSize: "0.85rem", fontWeight: 600, color: tokens.ink,
                      overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap" }}>
                {item.label}
              </Typography>
            )}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
