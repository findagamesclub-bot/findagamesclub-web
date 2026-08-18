import Box from "@mui/material/Box";
import { tokens } from "@/lib/tokens";
import { clubIdentity } from "@/utils/club-identity";

type Props = {
  slug: string;
  name: string;
  image?: { src: string; alt: string } | null;
  /** CSS aspect-ratio. Cards use 16/9; the club page banner is wider. */
  ratio?: string;
  /** Corner monogram plate. Off for the club page, which has a real title. */
  showPlate?: boolean;
};

/**
 * A club's artwork, or a drawn plate when it has none.
 *
 * Only eight of eleven clubs supplied images. A missing-image placeholder would
 * make those three look broken, so the fallback is a battle mat instead — the
 * club's faction colour, a table grid, and its monogram. It reads as a
 * deliberate crest rather than an absence.
 */
export default function ClubArt({ slug, name, image, ratio = "16 / 9", showPlate = true }: Props) {
  const { faction, monogram } = clubIdentity(slug, name);
  // Only the supplied placeholder SVGs get recoloured. Didcot and a few others
  // uploaded real photographs, and tinting a photograph looks like a fault.
  const tintable = Boolean(image?.src.toLowerCase().endsWith(".svg"));

  return (
    <Box
      sx={{
        position: "relative",
        aspectRatio: ratio,
        overflow: "hidden",
        // Contains the blend below so it can't reach the page behind the card.
        isolation: "isolate",
        backgroundColor: faction.deep,
        // Faction colour reaches the card edge even while the image loads.
        backgroundImage: `linear-gradient(140deg, ${faction.deep} 0%, ${faction.base} 100%)`,
      }}
    >
      {image ? (
        <Box
          component="img"
          src={image.src}
          alt={image.alt || ""}
          loading="lazy"
          decoding="async"
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            // A gaming table's grid, 44px squares, held back to a whisper.
            backgroundImage: `
              repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 44px),
              repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 44px)`,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Box
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 7vw, 3.2rem)",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.9)",
              border: `2px solid ${tokens.brassOnDark}`,
              borderRadius: "2px",
              px: 2.25,
              py: 1,
              lineHeight: 1,
            }}
          >
            {monogram}
          </Box>
        </Box>
      )}

      {/* The supplied artwork is the same blue in all eight files, so a grid of
          cards read as one repeated image. Blending the faction colour over it
          keeps each club's illustration but gives it that club's hue. */}
      {tintable ? (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            backgroundColor: faction.base,
            mixBlendMode: "color",
            opacity: 0.85,
          }}
        />
      ) : null}

      {/* Scrim. Weighted to the bottom because the club page sets its title
          there, and the artwork's brightest shape lands in the same band. */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg,
            rgba(16,27,45,0.45) 0%,
            rgba(16,27,45,0.04) 28%,
            rgba(16,27,45,0.34) 60%,
            rgba(16,27,45,0.9) 100%)`,
        }}
      />

      {showPlate && image ? (
        <Box
          sx={{
            position: "absolute",
            top: 12,
            left: 12,
            display: "grid",
            placeItems: "center",
            width: 40,
            height: 40,
            backgroundColor: faction.base,
            border: `1.5px solid ${tokens.brassOnDark}`,
            borderRadius: "2px",
            fontFamily: "var(--font-display)",
            fontSize: "0.95rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "#FFFFFF",
          }}
        >
          {monogram}
        </Box>
      ) : null}

      {/* Faction bar. The card's one saturated edge, and it means something. */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 4,
          backgroundColor: faction.base,
        }}
      />
    </Box>
  );
}
