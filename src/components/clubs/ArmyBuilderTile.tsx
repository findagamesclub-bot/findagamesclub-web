import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkButton from "@/components/ui/LinkButton";
import { tokens } from "@/lib/tokens";

/**
 * The way in to the builder from the club's own page.
 *
 * A reason rather than a hidden section when the reader cannot use it: the
 * whole point of a tier benefit is that somebody on the tier below can see
 * what they would be getting.
 */
export default function ArmyBuilderTile({
  slug, reason,
}: {
  slug: string;
  /** Null when they may build. Otherwise the rung they are stopped at. */
  reason: string | null;
}) {
  if (reason) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        {reason}
      </Typography>
    );
  }
  return (
    <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }} useFlexGap>
      <LinkButton variant="contained" endIcon={<ArrowForwardIcon />}
        href={`/clubs/${slug}/army-builder`}
        sx={{ width: { xs: "100%", sm: "auto" } }}>
        Open the army builder
      </LinkButton>
      <LinkButton variant="outlined" href={`/clubs/${slug}/army-builder/new`}
        sx={{ width: { xs: "100%", sm: "auto" } }}>
        Start a new list
      </LinkButton>
    </Stack>
  );
}
