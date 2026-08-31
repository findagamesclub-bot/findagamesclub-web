import Stack from "@mui/material/Stack";
import MuiLink from "@mui/material/Link";
import type { SvgIconComponent } from "@mui/icons-material";
import FacebookIcon from "@mui/icons-material/Facebook";
import InstagramIcon from "@mui/icons-material/Instagram";
import XIcon from "@mui/icons-material/X";
import YouTubeIcon from "@mui/icons-material/YouTube";
import LanguageIcon from "@mui/icons-material/Language";
import { DiscordIcon, TwitchIcon, TikTokIcon, MeetupIcon } from "@/components/ui/BrandIcons";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";

type Props = {
  links: { label: string; url: string }[];
  /** A club's identity, for the hover colour. Members pass their own. */
  slug: string;
  name: string;
  size?: "small" | "medium";
};

/**
 * Social links as icons.
 *
 * Monochrome at rest, the club's faction colour on hover. Deliberately not the
 * brands' own colours: hue means "which club" everywhere else in this app, and
 * a row of Discord blurple, Instagram magenta and YouTube red on a crimson
 * club's card is exactly the noise that got the first design rejected. It is
 * also one of the most reliable signs of a template.
 */

const ICONS: Record<string, SvgIconComponent | typeof DiscordIcon> = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  x: XIcon,
  twitter: XIcon,
  youtube: YouTubeIcon,
  discord: DiscordIcon,
  twitch: TwitchIcon,
  tiktok: TikTokIcon,
  meetup: MeetupIcon,
};

export default function SocialLinks({ links, slug, name, size = "medium" }: Props) {
  if (links.length === 0) return null;

  const { faction } = clubIdentity(slug, name);
  const box = size === "medium" ? 40 : 32;
  const glyph = size === "medium" ? 20 : 18;

  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", ml: -1 }}>
      {links.map((link) => {
        // A label we don't recognise still gets a link, as a globe.
        const Icon = ICONS[link.label.trim().toLowerCase()] ?? LanguageIcon;
        return (
            <MuiLink
              key={link.label}
              href={link.url}
              // A plain title rather than MUI's Tooltip: this renders on the
              // server, and Tooltip clones its child with event handlers, which
              // hydrated differently and blew up the whole club page.
              title={link.label}
              target="_blank"
              rel="noopener noreferrer"
              // Screen readers get the club and the network, not just "Instagram".
              aria-label={`${name} on ${link.label}`}
              sx={{
                display: "inline-grid",
                placeItems: "center",
                width: box,
                height: box,
                borderRadius: "3px",
                color: tokens.inkMuted,
                transition: "color 140ms ease, background-color 140ms ease",
                "&:hover, &:focus-visible": {
                  color: faction.base,
                  backgroundColor: faction.soft,
                },
              }}
            >
              <Icon sx={{ fontSize: glyph }} />
            </MuiLink>
        );
      })}
    </Stack>
  );
}
