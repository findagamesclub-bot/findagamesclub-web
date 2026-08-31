import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import ShieldIcon from "@mui/icons-material/Shield";
import MapIcon from "@mui/icons-material/Map";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import type { SvgIconComponent } from "@mui/icons-material";
import { display, tokens } from "@/lib/tokens";
import type { Badge, BadgeTone } from "@/utils/competition-badges";

/**
 * Legacy's five tones, kept: a champion's badge should not look like a
 * participation one. Colours are ours rather than theirs, so a row of badges
 * still belongs to this site.
 */
const TONES: Record<BadgeTone, { bg: string; fg: string; Icon: SvgIconComponent }> = {
  champion: { bg: "#FBF0D5", fg: "#7A5A12", Icon: EmojiEventsIcon },
  leader:   { bg: tokens.brassSoft, fg: "#5c4310", Icon: WorkspacePremiumIcon },
  podium:   { bg: "#EFE7DE", fg: "#6B4A2E", Icon: MilitaryTechIcon },
  streak:   { bg: "#E7F3E8", fg: "#1B5E20", Icon: ShieldIcon },
  campaign: { bg: "#E9ECF6", fg: "#2E3A63", Icon: MapIcon },
};

/** What a member has won. Earned from standings, never stored. */
export default function MemberBadges({ badges }: { badges: Badge[] }) {
  if (!badges.length) return null;

  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
      {badges.map((badge) => {
        const tone = TONES[badge.tone];
        return (
          <Stack key={badge.key} direction="row" spacing={0.875}
            title={badge.context}
            sx={{ alignItems: "center", px: 1.5, py: 0.875, borderRadius: 999,
                  backgroundColor: tone.bg, color: tone.fg }}>
            <tone.Icon sx={{ fontSize: 17 }} />
            <Stack sx={{ minWidth: 0 }}>
              <Typography sx={{ fontFamily: display, fontSize: "0.85rem", fontWeight: 700,
                                lineHeight: 1.2 }}>
                {badge.label}
              </Typography>
              <Typography sx={{ fontSize: "0.7rem", opacity: 0.8, lineHeight: 1.2 }} noWrap>
                {badge.context}
              </Typography>
            </Stack>
          </Stack>
        );
      })}
    </Stack>
  );
}
