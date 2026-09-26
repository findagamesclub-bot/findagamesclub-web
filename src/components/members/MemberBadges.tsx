import Stack from "@mui/material/Stack";
import BadgeChip from "@/components/ui/BadgeChip";
import type { Badge } from "@/utils/competition-badges";

/**
 * What a member has, however they got it.
 *
 * Three sources land here and a reader does not care which: a club's own
 * badge, a year badge from the join date, and a competition badge from the
 * standings. `BadgeChip` draws all three the same way, and a badge with no
 * icon of its own takes the one its tone implies.
 */
export default function MemberBadges({
  badges,
}: {
  badges: (Badge & { icon?: string })[];
}) {
  if (!badges.length) return null;

  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
      {badges.map((badge) => (
        <BadgeChip key={badge.key} label={badge.label} context={badge.context}
          icon={badge.icon} tone={badge.tone} />
      ))}
    </Stack>
  );
}
