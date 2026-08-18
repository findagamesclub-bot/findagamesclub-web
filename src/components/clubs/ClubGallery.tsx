import Box from "@mui/material/Box";
import ClubArt from "./ClubArt";
import type { ClubImage } from "@/types/clubDetail";

type Props = {
  images: ClubImage[];
  slug: string;
  name: string;
};

/**
 * The club's remaining photos. The first one is already the page banner, so
 * this starts from the second and renders nothing when there isn't one.
 *
 * Goes through ClubArt so these get the same faction tint as the banner —
 * untinted they came back the original blue and looked like another club's.
 */
export default function ClubGallery({ images, slug, name }: Props) {
  const rest = images.slice(1);
  if (rest.length === 0) return null;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        gap: 1.5,
      }}
    >
      {rest.map((image) => (
        <Box
          key={image.src}
          sx={{ borderRadius: 1, overflow: "hidden", border: "1px solid", borderColor: "divider" }}
        >
          <ClubArt slug={slug} name={name} image={image} ratio="16 / 10" showPlate={false} />
        </Box>
      ))}
    </Box>
  );
}
