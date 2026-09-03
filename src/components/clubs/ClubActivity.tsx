import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/Lock";
import ActivityLine from "@/components/clubs/ActivityLine";
import MonoLabel from "@/components/ui/MonoLabel";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { ActivityItem } from "@/services/clubActivity.service";

/**
 * What has happened at the club lately.
 *
 * Legacy's activity feed (detail.js:4194). It builds this for everybody and
 * only strips the names for a visitor: "A new member joined the club" rather
 * than naming them. We showed a padlock instead, so anybody comparing a club
 * they had not joined found a living board there and an empty one here.
 *
 * The anonymised version is also the better answer on its own terms. Somebody
 * deciding whether this club is worth an evening wants to know it is busy, and
 * a fortnight of real lines says that in a way a locked panel never can.
 *
 * One line per item and no card per row: this is a list somebody scans, and a
 * feed of six bordered boxes is heavier than what it carries.
 */
export default function ClubActivity({
  items, clubName, faction, isMember,
}: {
  items: ActivityItem[];
  clubName: string;
  faction: Faction;
  isMember: boolean;
}) {
  if (!items.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        {isMember
          ? "Nothing in the last fortnight. Joining, booking, ordering and playing all show up here."
          : `Nothing at ${clubName} in the last fortnight.`}
      </Typography>
    );
  }

  // Past five rows the box stops growing and scrolls instead, so a busy club
  // does not push the rest of the page below the fold. Five rather than six
  // because a row can now carry a second line. Same treatment as the photos.
  const scrolls = items.length > 5;

  return (
    <Stack spacing={0.875}>
      <Stack direction="row" spacing={1}
        sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <MonoLabel mb={0}>Last 14 days</MonoLabel>
        {scrolls ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", color: tokens.inkMuted }}>
            {items.length} updates, scroll for more
          </Typography>
        ) : null}
      </Stack>

      <Box sx={{
        border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
        overflowX: "hidden",
        // A height that lands mid-row, so the cut edge reads as "more below"
        // rather than as the list simply ending.
        ...(scrolls ? { maxHeight: { xs: 300, md: 340 }, overflowY: "auto" } : {}),
      }}>
        {items.map((item, i) => (
          <ActivityLine key={item.id} item={item} faction={faction} first={i === 0} />
        ))}
      </Box>

      {/* Under the box rather than inside it, so it reads as a note about the
          list rather than as another thing that happened. */}
      {!isMember ? (
        <Stack direction="row" spacing={1}
          sx={{ alignItems: "center", pt: 0.25 }}>
          <LockIcon sx={{ fontSize: 15, color: tokens.inkMuted, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted, fontSize: "0.8rem" }}>
            Members see who did what, and can follow any of it through.
          </Typography>
        </Stack>
      ) : null}
    </Stack>
  );
}
