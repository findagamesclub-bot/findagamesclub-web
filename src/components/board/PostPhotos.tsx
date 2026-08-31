import Box from "@mui/material/Box";
import Image from "next/image";
import { tokens } from "@/lib/tokens";

/**
 * The photos on a thread.
 *
 * Each opens full size in a new tab. A lightbox would be nicer and is a
 * milestone's worth of work on its own; the browser already has one.
 */
export default function PostPhotos({
  images,
}: {
  images: { url: string; alt: string }[];
}) {
  if (!images.length) return null;

  return (
    <Box
      sx={{
        mt: 2.5, display: "grid", gap: 1.5,
        gridTemplateColumns: images.length > 1 ? { xs: "1fr", sm: "repeat(2, 1fr)" } : "1fr",
      }}
    >
      {images.map((image) => (
        <Box
          key={image.url}
          component="a"
          href={image.url}
          target="_blank"
          rel="noreferrer"
          sx={{
            position: "relative", display: "block", borderRadius: 1.5, overflow: "hidden",
            border: `1px solid ${tokens.rule}`, bgcolor: tokens.surface,
            // The box is sized before the file arrives, so the thread does not
            // jump when it lands.
            aspectRatio: images.length > 1 ? "4 / 3" : "16 / 10",
            "&:hover": { borderColor: tokens.brass },
          }}
        >
          <Image
            src={image.url}
            alt={image.alt || "Photo on this thread"}
            fill
            sizes={images.length > 1 ? "(max-width: 600px) 100vw, 320px" : "(max-width: 900px) 100vw, 660px"}
            style={{ objectFit: "cover" }}
          />
        </Box>
      ))}
    </Box>
  );
}
