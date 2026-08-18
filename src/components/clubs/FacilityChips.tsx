import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { SvgIconComponent } from "@mui/icons-material";
import WifiIcon from "@mui/icons-material/Wifi";
import LocalParkingIcon from "@mui/icons-material/LocalParking";
import WcIcon from "@mui/icons-material/Wc";
import AccessibleIcon from "@mui/icons-material/Accessible";
import ElevatorIcon from "@mui/icons-material/Elevator";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import SportsBarIcon from "@mui/icons-material/SportsBar";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import BrushIcon from "@mui/icons-material/Brush";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import VideocamIcon from "@mui/icons-material/Videocam";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import WeekendIcon from "@mui/icons-material/Weekend";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import LanguageIcon from "@mui/icons-material/Language";
import NightlightIcon from "@mui/icons-material/Nightlight";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { tokens } from "@/lib/tokens";

/**
 * Matched on keywords rather than exact labels. Clubs write their own facility
 * text — there are 33 distinct strings across eleven clubs, and "Cafe bar",
 * "Cafe counter" and "Bar" all want the same glyph. First match wins, so order
 * matters: "accessible toilets" has to reach the toilet rule before the
 * broader access one.
 */
const RULES: [RegExp, SvgIconComponent][] = [
  [/wi-?fi/i, WifiIcon],
  [/parking/i, LocalParkingIcon],
  [/toilet/i, WcIcon],
  [/lift/i, ElevatorIcon],
  [/step-free|ground-floor|wheelchair|accessib/i, AccessibleIcon],
  [/bar\b/i, SportsBarIcon],
  [/cafe|coffee/i, LocalCafeIcon],
  [/terrain|table|campaign/i, TableRestaurantIcon],
  [/paint|workshop/i, BrushIcon],
  [/console|arcade|esport/i, SportsEsportsIcon],
  [/stream/i, VideocamIcon],
  [/quiet|low-sensory|sensory/i, VolumeOffIcon],
  [/tournament|bracket|league/i, EmojiEventsIcon],
  [/air con/i, AcUnitIcon],
  [/storage|shelves|binder/i, Inventory2Icon],
  [/seating|lounge|family/i, WeekendIcon],
  [/member/i, CardMembershipIcon],
  [/website/i, LanguageIcon],
  [/late-night|evening/i, NightlightIcon],
  [/swap|trade/i, SwapHorizIcon],
  [/session zero|kit|starter/i, AutoStoriesIcon],
  [/host|volunteer/i, SupportAgentIcon],
  [/room/i, MeetingRoomIcon],
];

function iconFor(label: string): SvgIconComponent {
  return RULES.find(([pattern]) => pattern.test(label))?.[1] ?? CheckCircleIcon;
}

export default function FacilityChips({ values }: { values: string[] }) {
  if (values.length === 0) return null;

  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
      {values.map((value) => {
        const Icon = iconFor(value);
        return (
          <Box
            key={value}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.625,
              backgroundColor: tokens.surface,
              border: `1px solid ${tokens.rule}`,
              borderRadius: "3px",
              px: 1,
              py: 0.5,
            }}
          >
            <Icon aria-hidden sx={{ fontSize: 16, color: tokens.brand, flexShrink: 0 }} />
            <Typography
              component="span"
              sx={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", fontWeight: 500, lineHeight: 1.2 }}
            >
              {value}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}
