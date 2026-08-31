import Box from "@mui/material/Box";
import { clubIdentity } from "@/utils/club-identity";

/**
 * The club's mark: its logo, or its monogram when it has none.
 *
 * Legacy stores a logo, lets an owner upload one, and then never paints it —
 * `_normalise_logo_image` (club_store.py:15575) even falls back to the first
 * gallery image, so the two were never told apart. Here they have separate
 * jobs: the logo says who the club is, the images say what it is like.
 *
 * Only one club has uploaded one, so the fallback is not an edge case: the
 * monogram plate the directory already draws for image-less clubs does the same
 * work here, and a club with no logo looks deliberate rather than empty.
 */
export default function ClubLogo({
  slug, name, logoUrl, size = 44, ring = "rgba(255,255,255,0.92)",
}: {
  slug: string;
  name: string;
  logoUrl?: string | null;
  size?: number;
  /** The band around the plate. White over artwork, page colour on a card. */
  ring?: string;
}) {
  const { faction, monogram } = clubIdentity(slug, name);
  const border = Math.max(2, Math.round(size / 22));

  return (
    <Box
      sx={{
        width: size, height: size, flexShrink: 0,
        borderRadius: "22%",
        overflow: "hidden",
        border: `${border}px solid ${ring}`,
        boxShadow: "0 4px 14px rgba(6,14,28,0.28)",
        backgroundColor: faction.deep,
        backgroundImage: `linear-gradient(140deg, ${faction.deep} 0%, ${faction.base} 100%)`,
        display: "grid",
        placeItems: "center",
      }}
    >
      {logoUrl ? (
        <Box component="img" src={logoUrl} alt={`${name} logo`}
          loading="lazy" decoding="async"
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <Box aria-hidden sx={{
          fontFamily: "var(--font-display)",
          fontSize: size * 0.4,
          fontWeight: 700,
          letterSpacing: "0.04em",
          lineHeight: 1,
          color: "rgba(255,255,255,0.94)",
        }}>
          {monogram}
        </Box>
      )}
    </Box>
  );
}
