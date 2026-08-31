import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { mono, tokens } from "@/lib/tokens";

/**
 * A link into one of the owner's cross-club views.
 *
 * A count only appears when there is something in it: a zero badge next to
 * "Score approvals" reads as a broken counter rather than as good news.
 */
export default function WorkspaceLink({
  href, label, count = 0,
}: {
  href: string;
  label: string;
  count?: number;
}) {
  return (
    <NextLink href={href} style={{ textDecoration: "none" }}>
      <Stack direction="row" spacing={1}
        sx={{ px: 1.75, py: 1, borderRadius: 999, alignItems: "center",
              border: `1px solid ${count ? tokens.brass : tokens.rule}`,
              backgroundColor: count ? tokens.brassSoft : tokens.paper,
              transition: "border-color 140ms ease",
              "&:hover": { borderColor: tokens.brass } }}>
        <Typography variant="body2"
          sx={{ fontWeight: 600, color: count ? "#5c4310" : tokens.ink }}>
          {label}
        </Typography>
        {count ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", fontWeight: 700,
                            color: "#5c4310" }}>
            {count}
          </Typography>
        ) : null}
      </Stack>
    </NextLink>
  );
}
