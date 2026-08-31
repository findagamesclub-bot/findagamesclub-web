import GalleryLightbox from "./GalleryLightbox";
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
  // The first image is already the page banner, so the grid starts at the
  // second and renders nothing when there is not one.
  const rest = images.slice(1);
  if (rest.length === 0) return null;

  return <GalleryLightbox images={rest} slug={slug} name={name} />;
}
