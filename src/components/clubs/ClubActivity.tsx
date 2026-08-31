import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import PersonAddIcon from "@mui/icons-material/PersonAddAlt";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LockIcon from "@mui/icons-material/Lock";
import { sinceLabel } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { ActivityItem, ActivityKind } from "@/services/clubActivity.service";

const ICONS: Record<ActivityKind, typeof PersonAddIcon> = {
  join: PersonAddIcon,
  booking: TableRestaurantIcon,
  rival: LocalFireDepartmentIcon,
  result: EmojiEventsIcon,
};

/**
 * What has happened at the club lately.
 *
 * Legacy's activity feed (detail.js:4194), which is gated on member content
 * there and here. A club page without it reads as a listing; with it, it reads
 * as somewhere people actually go.
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
  if (!isMember) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <LockIcon sx={{ fontSize: 17, color: tokens.inkMuted, flexShrink: 0 }} />
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Members see who has joined, who is booking tables and how {clubName} did at
          its last events.
        </Typography>
      </Stack>
    );
  }

  if (!items.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Nothing yet. Activity appears here as members join, book tables and play events.
      </Typography>
    );
  }

  // Past six rows the box stops growing and scrolls instead, so a busy club
  // does not push the rest of the page below the fold. Same treatment as the
  // photo grid.
  const scrolls = items.length > 6;

  return (
    <Stack spacing={0.875}>
      <Stack direction="row" spacing={1}
        sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", letterSpacing: "0.12em",
                          fontWeight: 700, color: tokens.inkMuted }}>
          LAST 14 DAYS
        </Typography>
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
        ...(scrolls ? { maxHeight: { xs: 268, md: 300 }, overflowY: "auto" } : {}),
      }}>
      {items.map((item, i) => {
        const Icon = ICONS[item.kind];
        const line = (
          <Stack direction="row" spacing={1.5}
            sx={{ px: 2, py: 1.4, alignItems: "flex-start",
                  borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}`,
                  ...(item.href ? { "&:hover": { backgroundColor: faction.soft } } : {}) }}>
            <Box sx={{ width: 28, height: 28, borderRadius: 1, flexShrink: 0, mt: 0.125,
                       display: "grid", placeItems: "center",
                       backgroundColor: faction.soft, color: faction.deep }}>
              <Icon sx={{ fontSize: 16 }} />
            </Box>

            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
              <Box component="span" sx={{ fontWeight: 700 }}>{item.who}</Box> {item.what}
            </Typography>

            <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", letterSpacing: "0.06em",
                              color: tokens.inkMuted, flexShrink: 0, mt: 0.25 }}>
              {(sinceLabel(item.at) ?? "").toUpperCase()}
            </Typography>
          </Stack>
        );

        return item.href ? (
          <NextLink key={item.id} href={item.href}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            {line}
          </NextLink>
        ) : (
          <Box key={item.id}>{line}</Box>
        );
      })}
      </Box>
    </Stack>
  );
}
