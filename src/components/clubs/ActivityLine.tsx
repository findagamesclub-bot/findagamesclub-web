import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import PersonAddIcon from "@mui/icons-material/PersonAddAlt";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import SportsScoreIcon from "@mui/icons-material/SportsScore";
import SportsKabaddiIcon from "@mui/icons-material/SportsKabaddi";
import HandshakeIcon from "@mui/icons-material/Handshake";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import SchoolIcon from "@mui/icons-material/School";
import ForumIcon from "@mui/icons-material/Forum";
import ReplyIcon from "@mui/icons-material/Reply";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import ScoreboardIcon from "@mui/icons-material/Scoreboard";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { sinceLabel } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { ActivityItem, ActivityKind } from "@/services/clubActivity.service";

/**
 * One glyph per kind, so a reader can pick the line they care about out of a
 * fortnight of them without reading every word. Same icon family as the rest
 * of the app, and the same glyph a section uses for the thing it lists: the
 * shop bag here is the shop bag there.
 */
const ICONS: Record<ActivityKind, typeof PersonAddIcon> = {
  join: PersonAddIcon,
  tier: CardMembershipIcon,
  rival: LocalFireDepartmentIcon,
  booking: TableRestaurantIcon,
  result: SportsScoreIcon,
  "rivalry-result": SportsKabaddiIcon,
  lfg: HandshakeIcon,
  "lfg-matched": HandshakeIcon,
  waitlist: EventAvailableIcon,
  ticket: ConfirmationNumberIcon,
  order: ShoppingBagIcon,
  coaching: SchoolIcon,
  post: ForumIcon,
  reply: ReplyIcon,
  results: EmojiEventsIcon,
  league: MilitaryTechIcon,
  round: ScoreboardIcon,
  table: LeaderboardIcon,
};

/**
 * One line of the feed.
 *
 * Two lines where the kind has something worth adding: a score under a result,
 * the podium under a set of standings, the night under a booking. The sentence
 * stays short enough to scan and the specifics sit under it, which is legacy's
 * own title-and-summary card without the card.
 */
export default function ActivityLine({
  item, faction, first,
}: {
  item: ActivityItem;
  faction: Faction;
  first: boolean;
}) {
  const Icon = ICONS[item.kind];

  const line = (
    <Stack direction="row" spacing={1.5}
      sx={{ px: 2, py: 1.4, alignItems: "flex-start",
            borderTop: first ? "none" : `1px solid ${tokens.rule}`,
            // A row that goes somewhere has to say so before it is hovered: a
            // chevron that only appears on hover is invisible on a touch
            // screen, where there is no hover at all.
            ...(item.href ? {
              cursor: "pointer",
              transition: "background-color 150ms ease",
              "&:hover": { backgroundColor: faction.soft },
              "&:hover .go": { color: faction.deep, transform: "translateX(2px)" },
            } : {}) }}>
      <Box sx={{ width: 28, height: 28, borderRadius: 1, flexShrink: 0, mt: 0.125,
                 display: "grid", placeItems: "center",
                 backgroundColor: faction.soft, color: faction.deep }}>
        <Icon sx={{ fontSize: 16 }} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2">
          {item.who ? (
            <>
              <Box component="span" sx={{ fontWeight: 700 }}>{item.who}</Box>{" "}
            </>
          ) : null}
          {item.what}
        </Typography>
        {item.detail ? (
          // Clamped rather than trimmed in the query: a club's own update can
          // run to a paragraph, and cutting it here keeps whole words.
          <Typography variant="body2"
            sx={{ mt: 0.25, color: tokens.inkMuted, fontSize: "0.8rem",
                  display: "-webkit-box", WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {item.detail}
          </Typography>
        ) : null}
      </Box>

      <Stack direction="row" spacing={0.5}
        sx={{ alignItems: "center", flexShrink: 0, mt: 0.125 }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", letterSpacing: "0.06em",
                          color: tokens.inkMuted, whiteSpace: "nowrap" }}>
          {(sinceLabel(item.at) ?? "").toUpperCase()}
        </Typography>
        {item.href ? (
          <ChevronRightIcon className="go"
            sx={{ fontSize: 17, color: tokens.rule,
                  transition: "color 150ms ease, transform 150ms ease" }} />
        ) : (
          // Keeps the dates in a column whether a row links or not.
          <Box sx={{ width: 17, flexShrink: 0 }} />
        )}
      </Stack>
    </Stack>
  );

  return item.href ? (
    <NextLink href={item.href}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      {line}
    </NextLink>
  ) : (
    line
  );
}
