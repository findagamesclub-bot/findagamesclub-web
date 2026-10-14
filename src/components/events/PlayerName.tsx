import Link from "next/link";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";
import { tokens } from "@/lib/tokens";

/**
 * A player's name on a result, linked to their profile when there is one.
 *
 * The client asked for it on placings and on round results, so it is one
 * component rather than two: the same fact drawn the same way in both halves
 * of a tournament, which is the rule the status chips already learned.
 *
 * Only when the row is attached to an account. A tournament sheet is mostly
 * typed names, and a name with no profile behind it has nowhere to go; a link
 * that leads to a 404 is worse than plain text.
 *
 * A plain `next/link` with inline styles, not `component={NextLink}`: that
 * form throws from a Server Component and this renders inside both.
 *
 * The underline is always there rather than on hover. A link whose only
 * affordance is a hover state does not exist on a phone, which is the rule
 * this codebase already wrote down about the board's own controls, and colour
 * alone would be carrying it otherwise.
 */
export default function PlayerName({
  name, profileId, bold = false, sx,
}: {
  name: string;
  profileId?: string | null;
  bold?: boolean;
  sx?: SxProps<Theme>;
}) {
  const text = name.trim() || "—";

  const body = (
    <Typography
      variant="body2"
      component="span"
      sx={[
        { minWidth: 0, fontWeight: bold ? 700 : 400 },
        profileId ? {
          color: "inherit",
          textDecoration: "underline",
          textDecorationColor: tokens.rule,
          textUnderlineOffset: 3,
          "&:hover": { textDecorationColor: "currentColor" },
        } : {},
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {text}
    </Typography>
  );

  if (!profileId) return body;

  return (
    <Link href={`/members/${profileId}`}
      style={{ color: "inherit", textDecoration: "none", minWidth: 0 }}
      aria-label={`${text}, open their profile`}>
      {body}
    </Link>
  );
}
