import GalleryLightbox from "./GalleryLightbox";
import type { ClubImage } from "@/types/clubDetail";

type Props = {
  images: ClubImage[];
  slug: string;
  name: string;
};

/**
 * Every photo the club has, openable full size.
 *
 * This used to start at the second, on the reasoning that the first is already
 * the page banner and showing it twice is clutter. It read as photos going
 * missing: a club with four uploaded counted three here, the editor said
 * "4 OF 10" on the same photos, and the client reported it as a bug. The
 * banner was also the one picture nobody could open full size, because the
 * lightbox only ever held the tiles.
 *
 * A club whose only photo IS the banner still shows no grid, which is the case
 * the old slice was really protecting: one tile directly under the identical
 * banner is the clutter worth avoiding.
 *
 * Goes through ClubArt so these get the same faction tint as the banner —
 * untinted they came back the original blue and looked like another club's.
 */
export default function ClubGallery({ images, slug, name }: Props) {
  if (images.length < 2) return null;

  return <GalleryLightbox images={images} slug={slug} name={name} />;
}
