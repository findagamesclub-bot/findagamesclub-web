import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import ShieldIcon from "@mui/icons-material/Shield";
import StarIcon from "@mui/icons-material/Star";
import BrushIcon from "@mui/icons-material/Brush";
import HandymanIcon from "@mui/icons-material/Handyman";
import HandshakeIcon from "@mui/icons-material/Handshake";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import type { SvgIconComponent } from "@mui/icons-material";
import { display, tokens } from "@/lib/tokens";
import { readIcon, readTone, type BadgeIcon, type BadgeToneKey } from "@/utils/badge-style";

/**
 * One badge, however it was earned.
 *
 * The competition tones are the five `MemberBadges` already had, so a badge a
 * club invents sits beside a Champion without either looking out of place. The
 * two extra tones exist because a club needs something that does not read as
 * "won the league": `club` is the neutral one and `service` is for the jobs
 * nobody volunteers for.
 */
const ICONS: Record<BadgeIcon, SvgIconComponent> = {
  trophy: EmojiEventsIcon,
  medal: MilitaryTechIcon,
  shield: ShieldIcon,
  star: StarIcon,
  brush: BrushIcon,
  hammer: HandymanIcon,
  handshake: HandshakeIcon,
  spark: AutoAwesomeIcon,
};

/**
 * The icon a tone implies, for a badge that did not choose one.
 *
 * Competition and tenure badges are derived, so nobody picks their icon: it
 * comes from what they are. A club badge names its own and this is ignored.
 */
const TONE_ICONS: Record<BadgeToneKey, BadgeIcon> = {
  champion: "trophy", leader: "medal", podium: "medal",
  streak: "shield", campaign: "star", club: "star", service: "handshake",
};

const TONES: Record<BadgeToneKey, { bg: string; fg: string }> = {
  champion: { bg: "#FBF0D5", fg: "#7A5A12" },
  leader: { bg: tokens.brassSoft, fg: "#5c4310" },
  podium: { bg: "#EFE7DE", fg: "#6B4A2E" },
  streak: { bg: "#E7F3E8", fg: "#1B5E20" },
  campaign: { bg: "#E9ECF6", fg: "#2E3A63" },
  club: { bg: tokens.brandSoft, fg: "#123A6B" },
  service: { bg: "#F2E2EE", fg: "#5A2450" },
};

export default function BadgeChip({
  label, context, icon, tone, size = "normal",
}: {
  label: string;
  /** What earned it, under the name. Left out on a compact chip. */
  context?: string;
  icon?: string | null;
  tone?: string | null;
  size?: "normal" | "compact";
}) {
  const key = readTone(tone);
  // A badge with no icon of its own takes the one its tone implies, so a
  // Champion is a trophy without anybody having chosen that.
  const Icon = ICONS[icon ? readIcon(icon) : TONE_ICONS[key]];
  const colours = TONES[key];
  const compact = size === "compact";

  return (
    <Stack direction="row" spacing={compact ? 0.625 : 0.875}
      title={context || label}
      sx={{ alignItems: "center", borderRadius: 999,
            px: compact ? 1 : 1.5, py: compact ? 0.5 : 0.875,
            backgroundColor: colours.bg, color: colours.fg }}>
      <Icon aria-hidden sx={{ fontSize: compact ? 14 : 17 }} />
      <Stack sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: display, fontWeight: 700, lineHeight: 1.2,
                          fontSize: compact ? "0.72rem" : "0.85rem" }}>
          {label}
        </Typography>
        {context && !compact ? (
          <Typography sx={{ fontSize: "0.7rem", opacity: 0.8, lineHeight: 1.2 }} noWrap>
            {context}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  );
}

/** The icon on its own, for a picker. */
export function BadgeIconGlyph({ icon, size = 20 }: { icon: string; size?: number }) {
  const Icon = ICONS[readIcon(icon)];
  return <Icon aria-hidden sx={{ fontSize: size }} />;
}

/** So a picker can render every choice without knowing the list. */
export { ICONS as BADGE_ICON_COMPONENTS };

export function toneColours(tone: string) {
  return TONES[readTone(tone)];
}

export const ToneSwatch = ({ tone }: { tone: string }) => {
  const c = toneColours(tone);
  return <Box aria-hidden sx={{ width: 18, height: 18, borderRadius: "50%",
                                backgroundColor: c.bg, border: `2px solid ${c.fg}` }} />;
};
